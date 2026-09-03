import { describe, expect, it } from "bun:test";
import { VirtualDeviceAdapter } from "@/domain/device/virtual-adapter";
import { InMemoryExperimentStore } from "@/domain/experiment/store";
import { ExperimentRunner } from "@/domain/experiment/runner";
import { TelemetryEventBus } from "@/domain/telemetry/bus";
import { CapabilityRegistry } from "@/infrastructure/webmcp/capability-registry";
import { DeviceToolRegistrar } from "@/infrastructure/webmcp/device-tool-registrar";
import { WebMCPExecutionCoordinator } from "@/infrastructure/webmcp/execution-coordinator";
import { InMemoryModelContext } from "@/infrastructure/webmcp/in-memory-model-context";

async function createGatedWorkbench() {
  const coordinator = new WebMCPExecutionCoordinator();
  const context = new InMemoryModelContext(coordinator);
  const adapter = new VirtualDeviceAdapter();
  const runner = new ExperimentRunner({
    eventBus: new TelemetryEventBus(),
    store: new InMemoryExperimentStore(),
  });

  await adapter.connect();
  await new DeviceToolRegistrar(context, new CapabilityRegistry(runner)).registerDevice(adapter);
  return { adapter, context, coordinator };
}

async function waitForGate(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

async function readResetCount(adapter: VirtualDeviceAdapter): Promise<number> {
  const result = await adapter.executeCapability<{ count: number }>("read_reset_history");
  return result.data.count;
}

describe("ToolApprovalGate integration", () => {
  it("keeps Amber execution pending and the relay open until the matching request is approved", async () => {
    const { adapter, context, coordinator } = await createGatedWorkbench();
    let settled = false;
    const execution = context
      .executeTool("run_relay_stress_test", { cycles: 1, duration_ms: 10 }, { origin: "external" })
      .finally(() => {
        settled = true;
      });

    await waitForGate();
    const request = coordinator.approvalGate.getPendingApproval();
    expect(request).toMatchObject({
      toolName: "run_relay_stress_test",
      input: { cycles: 1, duration_ms: 10 },
    });
    expect(request?.whatWillHappen).toContain("virtual relay");
    expect(settled).toBe(false);
    expect(adapter.getRelayState()).toBe("open");
    expect(await readResetCount(adapter)).toBe(1);
    expect(coordinator.approvalGate.approve("not-the-active-request")).toBe(false);
    expect(settled).toBe(false);
    expect(adapter.getRelayState()).toBe("open");

    expect(coordinator.approvalGate.approve(request?.id)).toBe(true);
    const result = JSON.parse(await execution) as {
      unexpected_resets: number;
      supply_voltage: { minimum_v: number };
    };
    expect(result.unexpected_resets).toBe(1);
    expect(result.supply_voltage.minimum_v).toBeLessThan(2.8);
    expect(adapter.getRelayState()).toBe("open");
  });

  it("denial settles explicitly without actuating hardware or creating reset evidence", async () => {
    const { adapter, context, coordinator } = await createGatedWorkbench();
    const execution = context.executeTool(
      "run_relay_stress_test",
      { cycles: 2, duration_ms: 100 },
      { origin: "external" },
    );

    await waitForGate();
    const request = coordinator.approvalGate.getPendingApproval();
    expect(request).not.toBeNull();
    expect(adapter.getRelayState()).toBe("open");

    expect(coordinator.approvalGate.deny(request?.id, "Unsafe fixture configuration")).toBe(true);
    const denied = JSON.parse(await execution) as { status: string; error: string };
    expect(denied).toEqual(expect.objectContaining({
      status: "DENIED",
      error: "Unsafe fixture configuration",
    }));
    expect(coordinator.approvalGate.hasPendingApproval()).toBe(false);
    expect(adapter.getRelayState()).toBe("open");
    expect(await readResetCount(adapter)).toBe(1);
    expect(coordinator.toolLedger.getEntries().map((entry) => ({
      toolName: entry.toolName,
      origin: entry.origin,
      status: entry.status,
    }))).toEqual([
      {
        toolName: "run_relay_stress_test",
        origin: "external",
        status: "denied",
      },
    ]);
  });

  it("caller abort clears the pending gate and rejects without ever closing the relay", async () => {
    const { adapter, context, coordinator } = await createGatedWorkbench();
    const abortController = new AbortController();
    const execution = context.executeTool(
      "run_relay_stress_test",
      { cycles: 3, duration_ms: 500 },
      { signal: abortController.signal, origin: "external" },
    );

    await waitForGate();
    expect(coordinator.approvalGate.hasPendingApproval()).toBe(true);
    expect(adapter.getRelayState()).toBe("open");
    abortController.abort();

    await expect(execution).rejects.toMatchObject({ name: "AbortError" });
    expect(coordinator.approvalGate.hasPendingApproval()).toBe(false);
    expect(adapter.getRelayState()).toBe("open");
    expect(await readResetCount(adapter)).toBe(1);
    expect(coordinator.toolLedger.getEntries().map((entry) => ({
      toolName: entry.toolName,
      origin: entry.origin,
      status: entry.status,
    }))).toEqual([
      {
        toolName: "run_relay_stress_test",
        origin: "external",
        status: "failed",
      },
    ]);
  });
});
