import { describe, expect, it } from "bun:test";
import { VirtualDeviceAdapter } from "../../src/domain/device/virtual-adapter";
import { CapabilityRegistry } from "../../src/infrastructure/webmcp/capability-registry";
import { InMemoryModelContext } from "../../src/infrastructure/webmcp/in-memory-model-context";
import { DeviceToolRegistrar } from "../../src/infrastructure/webmcp/device-tool-registrar";
import { ExperimentRunner } from "../../src/domain/experiment/runner";
import { InMemoryExperimentStore } from "../../src/domain/experiment/store";
import { TelemetryEventBus } from "../../src/domain/telemetry/bus";
import { registerEvidenceTools } from "../../src/infrastructure/webmcp/evidence-tools";
import { registerHypothesisTools } from "../../src/infrastructure/webmcp/hypothesis-tools";
import { InMemoryHypothesisStore } from "../../src/domain/hypothesis/store";
import { createScenarioSession, matchDiagnosis } from "../../src/domain/scenario";

describe("Phase 15 — Performance & Memory Leak Verification", () => {
  it("executes 25 sequential mystery investigations without listener, subscriber, or tool registration leaks", async () => {
    const NUM_RUNS = 25;
    const scenarioIds = ["brownout", "i2c_address", "sda_fault"] as const;

    for (let run = 0; run < NUM_RUNS; run++) {
      const scenarioId = scenarioIds[run % scenarioIds.length];
      const session = createScenarioSession({ scenarioId });

      const adapter = new VirtualDeviceAdapter(session.getInitialDeviceConfig());
      await adapter.connect();

      const eventBus = new TelemetryEventBus();
      const experimentStore = new InMemoryExperimentStore();
      const runner = new ExperimentRunner({ eventBus, store: experimentStore });
      const evidenceStore = runner.getEvidenceStore();
      const hypothesisStore = new InMemoryHypothesisStore(evidenceStore);

      const modelContext = new InMemoryModelContext();
      const capabilityRegistry = new CapabilityRegistry(runner);
      const registrar = new DeviceToolRegistrar(modelContext, capabilityRegistry);

      // Register all WebMCP tools
      await registrar.registerDevice(adapter);
      await registerEvidenceTools(modelContext, evidenceStore);
      await registerHypothesisTools(modelContext, hypothesisStore);

      // Tools should be exactly 19 (no duplicates)
      const tools = await modelContext.getTools();
      expect(tools.length).toBe(19);

      // Subscribe telemetry and device listeners
      const unsubs: Array<() => void> = [];
      let eventCount = 0;
      unsubs.push(
        eventBus.subscribe(() => {
          eventCount++;
        })
      );
      unsubs.push(
        adapter.subscribe(() => {
          eventCount++;
        })
      );

      expect(eventBus.subscriberCount()).toBe(1);
      expect(adapter.subscriberCount()).toBe(1);

      // Execute investigation tool
      const scanTool = tools.find((t) => t.name === "read_device_info");
      expect(scanTool).toBeDefined();
      if (scanTool) {
        const resStr = await modelContext.executeTool(scanTool, {});
        expect(resStr).toBeDefined();
      }

      // Cleanup listeners
      for (const unsub of unsubs) {
        unsub();
      }

      // Assert zero lingering subscribers
      expect(eventBus.subscriberCount()).toBe(0);
      expect(adapter.subscriberCount()).toBe(0);

      // Disconnect adapter
      await adapter.disconnect();
      expect(adapter.isConnected()).toBe(false);
      expect(adapter.getRelayState()).toBe("open");
    }
  });

  it("ensures TelemetryEventBus idempotent unsubscription works safely", () => {
    const bus = new TelemetryEventBus();
    const unsub = bus.subscribe(() => {});
    expect(bus.subscriberCount()).toBe(1);

    unsub();
    expect(bus.subscriberCount()).toBe(0);

    // Repeated calls must be safe and no-op
    unsub();
    unsub();
    expect(bus.subscriberCount()).toBe(0);
  });
});
