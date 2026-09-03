import { describe, expect, it } from "bun:test";
import { VirtualDeviceAdapter } from "@/domain/device/virtual-adapter";
import { InMemoryExperimentStore } from "@/domain/experiment/store";
import { ExperimentRunner } from "@/domain/experiment/runner";
import { TelemetryEventBus } from "@/domain/telemetry/bus";
import { InMemoryHypothesisStore } from "@/domain/hypothesis/store";
import { InMemoryModelContext } from "@/infrastructure/webmcp/in-memory-model-context";
import { CapabilityRegistry } from "@/infrastructure/webmcp/capability-registry";
import { DeviceToolRegistrar } from "@/infrastructure/webmcp/device-tool-registrar";
import { registerEvidenceTools } from "@/infrastructure/webmcp/evidence-tools";
import { registerHypothesisTools } from "@/infrastructure/webmcp/hypothesis-tools";

const DEVICE_TOOLS = [
  "read_device_info",
  "read_reset_history",
  "read_system_health",
  "measure_supply_voltage",
  "scan_i2c_bus",
  "read_sensor_status",
  "read_i2c_line_state",
  "run_relay_stress_test",
] as const;

describe("production WebMCP tool lifecycle", () => {
  it("keeps investigation tools and adds all virtual-DUT instruments on activation", async () => {
    const context = new InMemoryModelContext();
    const runner = new ExperimentRunner({
      eventBus: new TelemetryEventBus(),
      store: new InMemoryExperimentStore(),
    });
    const hypotheses = new InMemoryHypothesisStore(runner.getEvidenceStore());
    await registerEvidenceTools(context, runner.getEvidenceStore());
    await registerHypothesisTools(context, hypotheses);

    const before = (await context.getTools()).map((tool) => tool.name);
    expect(before).toHaveLength(11);
    expect(before).toContain("list_evidence");
    expect(before).toContain("request_human_intervention");
    expect(before).not.toContain("read_device_info");

    const adapter = new VirtualDeviceAdapter();
    const registrar = new DeviceToolRegistrar(context, new CapabilityRegistry(runner));
    await adapter.connect();
    await registrar.registerDevice(adapter);

    const active = (await context.getTools()).map((tool) => tool.name);
    expect(active).toHaveLength(19);
    for (const name of DEVICE_TOOLS) expect(active).toContain(name);
    const stressTool = (await context.getTools()).find((tool) => tool.name === "run_relay_stress_test");
    expect(stressTool?.description).toContain("virtual brownout reset");
    expect(stressTool?.description).not.toContain("physical reset");

    registrar.unregisterDevice(adapter);
    const disconnected = (await context.getTools()).map((tool) => tool.name);
    expect(disconnected).toEqual(before);

    await registrar.registerDevice(adapter);
    const fresh = (await context.getTools()).map((tool) => tool.name);
    expect(fresh).toHaveLength(19);
    for (const name of DEVICE_TOOLS) expect(fresh).toContain(name);
  });
});
