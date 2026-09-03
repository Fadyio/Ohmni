import { describe, expect, it } from "bun:test";
import type { DeviceAdapter } from "@/domain/device/adapter";
import type { DeviceDescriptor } from "@/domain/device/descriptor";
import { VirtualDeviceAdapter } from "@/domain/device/virtual-adapter";
import { InMemoryExperimentStore } from "@/domain/experiment/store";
import { ExperimentRunner } from "@/domain/experiment/runner";
import { InMemoryHypothesisStore } from "@/domain/hypothesis/store";
import { TelemetryEventBus } from "@/domain/telemetry/bus";
import { CapabilityRegistry } from "@/infrastructure/webmcp/capability-registry";
import { DeviceToolRegistrar } from "@/infrastructure/webmcp/device-tool-registrar";
import { registerEvidenceTools } from "@/infrastructure/webmcp/evidence-tools";
import { WebMCPExecutionCoordinator } from "@/infrastructure/webmcp/execution-coordinator";
import { registerHypothesisTools } from "@/infrastructure/webmcp/hypothesis-tools";
import { InMemoryModelContext } from "@/infrastructure/webmcp/in-memory-model-context";

async function createExternalWorkbench() {
  const coordinator = new WebMCPExecutionCoordinator();
  const context = new InMemoryModelContext(coordinator);
  const runner = new ExperimentRunner({
    eventBus: new TelemetryEventBus(),
    store: new InMemoryExperimentStore(),
  });
  const hypotheses = new InMemoryHypothesisStore(runner.getEvidenceStore());
  const adapter = new VirtualDeviceAdapter();

  await registerEvidenceTools(context, runner.getEvidenceStore());
  await registerHypothesisTools(context, hypotheses);
  await adapter.connect();
  await new DeviceToolRegistrar(context, new CapabilityRegistry(runner)).registerDevice(adapter);

  const invoke = async <T>(name: string, input: Record<string, unknown> = {}): Promise<T> =>
    JSON.parse(await context.executeTool(name, input, { origin: "external" })) as T;

  return { adapter, context, coordinator, hypotheses, invoke };
}

async function settleApprovalRequest(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

describe("external WebMCP agent flow", () => {
  it("runs one shared, human-gated investigation from observation through verified repair", async () => {
    const { adapter, coordinator, hypotheses, invoke } = await createExternalWorkbench();

    const resetHistory = await invoke<{ count: number; resets: unknown[] }>("read_reset_history");
    const voltage = await invoke<{ voltage: number; status: string }>("measure_supply_voltage");
    expect(resetHistory.count).toBeGreaterThanOrEqual(1);
    expect(resetHistory.resets[0]).toMatchObject({ reason: "POWER_ON" });
    expect(voltage.voltage).toBeCloseTo(3.31, 2);
    expect(voltage.status).toBe("normal");
    expect(coordinator.toolLedger.getEntries().map((entry) => [entry.toolName, entry.status, entry.origin])).toEqual([
      ["read_reset_history", "completed", "external"],
      ["measure_supply_voltage", "completed", "external"],
    ]);

    let firstStressSettled = false;
    const firstStressPromise = invoke<{
      experiment_id: string;
      status: string;
      unexpected_resets: number;
      supply_voltage: { minimum_v: number };
      evidence_ids: string[];
    }>("run_relay_stress_test", { cycles: 1, duration_ms: 10 }).finally(() => {
      firstStressSettled = true;
    });
    await settleApprovalRequest();

    expect(firstStressSettled).toBe(false);
    expect(coordinator.approvalGate.getPendingApproval()?.toolName).toBe("run_relay_stress_test");
    expect(coordinator.toolLedger.getActiveEntry()?.status).toBe("waiting-approval");
    expect(adapter.getRelayState()).toBe("open");

    coordinator.approvalGate.approve();
    const failedStress = await firstStressPromise;
    expect(failedStress.status).toBe("completed");
    expect(failedStress.unexpected_resets).toBeGreaterThan(0);
    expect(failedStress.supply_voltage.minimum_v).toBeLessThan(2.8);
    expect(failedStress.evidence_ids.length).toBeGreaterThan(0);
    expect(adapter.getRelayState()).toBe("open");

    const proposed = await invoke<{ hypothesis: { id: string } }>("propose_hypothesis", {
      title: "Relay-induced supply brownout",
      description: "Relay coil inrush collapses the shared MCU rail below its brownout threshold.",
      confidence: "MEDIUM",
      rationale: "The controlled relay test reproduced the reset and captured the voltage sag.",
      evidence_ids: failedStress.evidence_ids,
    });
    expect(proposed.hypothesis.id).toBe("H-001");

    await invoke("update_hypothesis", {
      hypothesis_id: proposed.hypothesis.id,
      confidence: "HIGH",
      evidence_ids: failedStress.evidence_ids,
      reason: "Relay actuation reproduced both a sub-threshold supply sag and a BROWNOUT reset.",
    });

    let requestedIntervention: { target: string; instruction: string } | undefined;
    coordinator.onHumanInterventionRequested((details) => {
      requestedIntervention = details;
    });
    await invoke("request_human_intervention", {
      target: "relay_power_jumper",
      instruction: "Move JP1 from the shared 3.3 V rail to the isolated 5 V rail.",
      rationale: "Isolate relay inrush current from the MCU supply before verification.",
      evidence_ids: failedStress.evidence_ids,
    });
    expect(requestedIntervention).toMatchObject({
      target: "relay_power_jumper",
      instruction: "Move JP1 from the shared 3.3 V rail to the isolated 5 V rail.",
    });
    expect(adapter.getInterventionPoint("relay_power_jumper")).toBe("3v3");

    adapter.setInterventionPoint("relay_power_jumper", "5v");
    let retestSettled = false;
    const retestPromise = invoke<{
      experiment_id: string;
      unexpected_resets: number;
      supply_voltage: { minimum_v: number };
      evidence_ids: string[];
    }>("run_relay_stress_test", { cycles: 1, duration_ms: 10 }).finally(() => {
      retestSettled = true;
    });
    await settleApprovalRequest();
    expect(retestSettled).toBe(false);
    expect(adapter.getRelayState()).toBe("open");

    coordinator.approvalGate.approve();
    const stableStress = await retestPromise;
    expect(stableStress.unexpected_resets).toBe(0);
    expect(stableStress.supply_voltage.minimum_v).toBeGreaterThanOrEqual(3.18);
    expect(stableStress.evidence_ids.length).toBeGreaterThan(0);

    const confirmation = await invoke<{
      hypothesis: { status: string; verificationStatus: string; verifiedExperimentId?: string };
    }>("confirm_hypothesis", {
      hypothesis_id: proposed.hypothesis.id,
      rationale: "After moving JP1 to 5 V, the approved relay retest completed with no reset and a stable MCU rail.",
      evidence_ids: stableStress.evidence_ids,
      verified_experiment_id: stableStress.experiment_id,
    });
    expect(confirmation.hypothesis).toMatchObject({
      status: "CONFIRMED",
      verificationStatus: "VERIFIED",
    });
    expect(hypotheses.get("H-001")).toMatchObject({
      status: "CONFIRMED",
      verificationStatus: "VERIFIED",
    });
    expect(adapter.getInterventionPoint("relay_power_jumper")).toBe("5v");
    expect(adapter.getRelayState()).toBe("open");
  });

  it("does not expose red or unknown device capabilities to an external agent", async () => {
    const coordinator = new WebMCPExecutionCoordinator();
    const context = new InMemoryModelContext(coordinator);
    const descriptor: DeviceDescriptor = {
      id: "hostile-device",
      name: "Hostile Device",
      firmwareVersion: "0.0.1",
      protocolVersion: 1,
      capabilities: [
        { name: "read_device_info", description: "Read identity", safety: "green", readOnly: true },
        { name: "erase_flash", description: "Erase firmware", safety: "red", readOnly: false },
        { name: "arbitrary_gpio_write", description: "Drive arbitrary pins", safety: "red", readOnly: false },
        { name: "unknown_actuator", description: "Unreviewed actuator", safety: "amber", readOnly: false },
      ],
    };
    const adapter: DeviceAdapter = {
      connect: async () => {},
      disconnect: async () => {},
      isConnected: () => true,
      getDescriptor: () => descriptor,
      executeCapability: async <T>() => ({ ok: true, data: {} as T }),
      subscribe: () => () => {},
    };

    const session = await new DeviceToolRegistrar(context, new CapabilityRegistry()).registerDevice(adapter);
    const names = (await context.getTools()).map((tool) => tool.name);

    expect(session.registeredToolNames).toEqual(["read_device_info"]);
    expect(names).toEqual(["read_device_info"]);
    expect(names).not.toContain("erase_flash");
    expect(names).not.toContain("arbitrary_gpio_write");
    expect(names).not.toContain("unknown_actuator");
  });
});
