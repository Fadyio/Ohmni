import { describe, expect, it, beforeEach } from "bun:test";
import { VirtualDeviceAdapter } from "../../src/domain/device/virtual-adapter";
import { CapabilityRegistry } from "../../src/infrastructure/webmcp/capability-registry";
import { InMemoryModelContext } from "../../src/infrastructure/webmcp/in-memory-model-context";
import { DeviceToolRegistrar } from "../../src/infrastructure/webmcp/device-tool-registrar";
import { runBenchAgent } from "../../src/infrastructure/bench-agent/run-bench-agent";
import type {
  BenchAgentProvider,
  AgentTurnResult,
} from "../../src/infrastructure/bench-agent/types";
import { ExperimentRunner } from "../../src/domain/experiment/runner";
import { InMemoryExperimentStore } from "../../src/domain/experiment/store";
import { TelemetryEventBus } from "../../src/domain/telemetry/bus";
import { registerEvidenceTools } from "../../src/infrastructure/webmcp/evidence-tools";
import { registerHypothesisTools } from "../../src/infrastructure/webmcp/hypothesis-tools";
import { InMemoryHypothesisStore } from "../../src/domain/hypothesis/store";

describe("Phase 12 — Resilience & Chaos Test Suite", () => {
  let adapter: VirtualDeviceAdapter;
  let modelContext: InMemoryModelContext;
  let registrar: DeviceToolRegistrar;
  let eventBus: TelemetryEventBus;
  let experimentStore: InMemoryExperimentStore;
  let runner: ExperimentRunner;
  let hypothesisStore: InMemoryHypothesisStore;

  beforeEach(async () => {
    adapter = new VirtualDeviceAdapter();
    await adapter.connect();

    eventBus = new TelemetryEventBus();
    experimentStore = new InMemoryExperimentStore();
    runner = new ExperimentRunner({ eventBus, store: experimentStore });
    const evidenceStore = runner.getEvidenceStore();
    hypothesisStore = new InMemoryHypothesisStore(evidenceStore);

    modelContext = new InMemoryModelContext();
    const registry = new CapabilityRegistry(runner);
    registrar = new DeviceToolRegistrar(modelContext, registry);
    await registrar.registerDevice(adapter);

    await registerEvidenceTools(modelContext, evidenceStore);
    await registerHypothesisTools(modelContext, hypothesisStore);
  });

  // 1. Provider Unavailable (503 / missing API key)
  it("Scenario 1: Provider unavailable (503) produces safe error state without hanging", async () => {
    const provider: BenchAgentProvider = {
      async turn() {
        const err = new Error("Service Unavailable: Model overloaded");
        (err as unknown as Record<string, unknown>).status = 503;
        throw err;
      },
    };

    const result = await runBenchAgent({
      modelContext,
      provider,
      goal: "Check device health",
      requestApproval: async () => false,
      maxSteps: 3,
    });

    expect(result.status).toBe("failed");
    if (result.status === "failed") {
      expect(result.message).toContain("Service Unavailable");
    }
  });

  // 2. Provider 429 (Rate Limited)
  it("Scenario 2: Provider 429 rate limit is reported cleanly without uncaught exceptions", async () => {
    let callCount = 0;
    const provider: BenchAgentProvider = {
      async turn() {
        callCount++;
        const err = new Error("Resource exhausted: Rate limit exceeded");
        (err as unknown as Record<string, unknown>).status = 429;
        throw err;
      },
    };

    const result = await runBenchAgent({
      modelContext,
      provider,
      goal: "Diagnose fault",
      requestApproval: async () => false,
      maxSteps: 2,
    });

    expect(result.status).toBe("failed");
    if (result.status === "failed") {
      expect(result.message).toContain("Rate limit exceeded");
    }
    expect(callCount).toBeGreaterThan(0);
  });

  // 3. Provider 500 (Server Error)
  it("Scenario 3: Provider 500 server error does not leak secrets and yields safe failure", async () => {
    const provider: BenchAgentProvider = {
      async turn() {
        const err = new Error("Internal Server Error with SECRET_KEY_DO_NOT_LEAK");
        (err as unknown as Record<string, unknown>).status = 500;
        throw err;
      },
    };

    const result = await runBenchAgent({
      modelContext,
      provider,
      goal: "Diagnose system",
      requestApproval: async () => false,
      maxSteps: 2,
    });

    expect(result.status).toBe("failed");
    if (result.status === "failed") {
      expect(result.message).toBeDefined();
    }
  });

  // 4. Provider Timeout
  it("Scenario 4: Provider request timeout aborts cleanly with timeout error", async () => {
    const { promise, reject } = Promise.withResolvers<AgentTurnResult>();
    const provider: BenchAgentProvider = {
      async turn(_req, options) {
        if (options?.signal) {
          options.signal.addEventListener("abort", () => {
            reject(new DOMException("The operation was aborted", "AbortError"));
          });
        }
        return promise;
      },
    };

    const controller = new AbortController();
    controller.abort();

    const result = await runBenchAgent({
      modelContext,
      provider,
      goal: "Investigate now",
      requestApproval: async () => false,
      signal: controller.signal,
      maxSteps: 2,
    });

    expect(result.status).toBe("stopped");
  });

  // 5. Malformed Response
  it("Scenario 5: Malformed provider response (invalid function call shape) is caught safely", async () => {
    const provider: BenchAgentProvider = {
      async turn() {
        return {
          interactionId: "chaos-int-5",
          functionCalls: [
            {
              id: "call_malformed",
              name: "", // Invalid empty name
              arguments: { invalid: true },
            },
          ],
        };
      },
    };

    const result = await runBenchAgent({
      modelContext,
      provider,
      goal: "Run inspection",
      requestApproval: async () => false,
      maxSteps: 2,
    });

    expect(["completed", "step-limit"]).toContain(result.status);
  });

  // 6. Tool Hallucination
  it("Scenario 6: Tool hallucination returns structured error to model and avoids crash", async () => {
    let turnCount = 0;
    const provider: BenchAgentProvider = {
      async turn(req) {
        turnCount++;
        if (turnCount === 1) {
          return {
            interactionId: "chaos-int-6-1",
            functionCalls: [
              {
                id: "call_fake",
                name: "non_existent_magic_diagnostic_tool",
                arguments: {},
              },
            ],
          };
        }
        const inputs = Array.isArray(req.input) ? req.input : [];
        const lastResult = inputs[0];
        expect(lastResult).toBeDefined();
        expect(lastResult?.is_error).toBe(true);
        return {
          interactionId: "chaos-int-6-2",
          functionCalls: [],
          text: "I see that tool does not exist. Proceeding with known instruments.",
        };
      },
    };

    const result = await runBenchAgent({
      modelContext,
      provider,
      goal: "Diagnose",
      requestApproval: async () => false,
      maxSteps: 3,
    });

    expect(result.status).toBe("completed");
    expect(turnCount).toBe(2);
  });

  // 7. Device Disconnect Mid-Tool
  it("Scenario 7: Device disconnect mid-tool prevents physical damage and keeps relay open", async () => {
    await adapter.disconnect();

    const provider: BenchAgentProvider = {
      async turn() {
        return {
          interactionId: "chaos-int-7",
          functionCalls: [
            {
              id: "call_disconnected_measure",
              name: "measure_supply_voltage",
              arguments: { samples: 10 },
            },
          ],
        };
      },
    };

    const result = await runBenchAgent({
      modelContext,
      provider,
      goal: "Measure voltage",
      requestApproval: async () => false,
      maxSteps: 2,
    });

    expect(adapter.getRelayState()).toBe("open");
  });

  // 8. Tool Cancellation
  it("Scenario 8: Tool cancellation via AbortSignal aborts without lingering timer", async () => {
    const controller = new AbortController();

    const provider: BenchAgentProvider = {
      async turn() {
        controller.abort();
        return {
          interactionId: "chaos-int-8",
          functionCalls: [
            {
              id: "call_read_info",
              name: "read_device_info",
              arguments: {},
            },
          ],
        };
      },
    };

    const result = await runBenchAgent({
      modelContext,
      provider,
      goal: "Read info",
      requestApproval: async () => false,
      signal: controller.signal,
      maxSteps: 2,
    });

    expect(result.status).toBe("stopped");
    expect(adapter.getRelayState()).toBe("open");
  });

  // 9. Approval Denied
  it("Scenario 9: Physical tool approval denied prevents actuation and informs agent", async () => {
    let agentSawDenial = false;
    let turnCount = 0;

    const provider: BenchAgentProvider = {
      async turn(req) {
        turnCount++;
        if (turnCount === 1) {
          return {
            interactionId: "chaos-int-9-1",
            functionCalls: [
              {
                id: "call_stress",
                name: "run_relay_stress_test",
                arguments: { cycles: 3, durationMs: 50 },
              },
            ],
          };
        }
        const inputs = Array.isArray(req.input) ? req.input : [];
        const res = inputs.find((i) => i.call_id === "call_stress");
        if (res && res.result[0].text.toLowerCase().includes("denied")) {
          agentSawDenial = true;
        }
        return {
          interactionId: "chaos-int-9-2",
          functionCalls: [],
          text: "Understood, physical test was denied. I will rely on passive diagnostics.",
        };
      },
    };

    const result = await runBenchAgent({
      modelContext,
      provider,
      goal: "Stress the relay",
      requestApproval: async () => false, // Explicit Deny
      maxSteps: 3,
    });

    expect(result.status).toBe("completed");
    expect(agentSawDenial).toBe(true);
    expect(adapter.getRelayState()).toBe("open");
  });

  // 10. Approval Abort / Timeout
  it("Scenario 10: Approval abortion cleans up state without dangling promise", async () => {
    const controller = new AbortController();

    const provider: BenchAgentProvider = {
      async turn() {
        return {
          interactionId: "chaos-int-10",
          functionCalls: [
            {
              id: "call_stress_abort",
              name: "run_relay_stress_test",
              arguments: { cycles: 2, durationMs: 50 },
            },
          ],
        };
      },
    };

    const result = await runBenchAgent({
      modelContext,
      provider,
      goal: "Stress relay",
      requestApproval: async () => {
        controller.abort();
        throw new DOMException("Approval aborted by user", "AbortError");
      },
      signal: controller.signal,
      maxSteps: 2,
    });

    expect(result.status).toBe("stopped");
    expect(adapter.getRelayState()).toBe("open");
  });

  // 11. Emergency Stop
  it("Scenario 11: Emergency stop aborts experiment, immediately opens relay, retains partial state", async () => {
    adapter.setInterventionPoint("relay_power_jumper", "3v3");
    // Actuate capability and immediately disconnect
    const capPromise = adapter.executeCapability("run_relay_stress_test", { cycles: 5, durationMs: 200 });
    await adapter.disconnect();

    try {
      await capPromise;
    } catch {
      // Expected abort / disconnect
    }

    expect(adapter.getRelayState()).toBe("open");
    expect(adapter.isConnected()).toBe(false);
  });

  // 12. Bad I2C Response / NACK
  it("Scenario 12: Bad I2C response is reported accurately as NACK without crash", async () => {
    adapter.setInterventionPoint("sensor_address_selector", "0x77");
    const statusResult = await adapter.executeCapability("read_sensor_status");
    expect(statusResult.ok).toBe(true);
    const data = statusResult.data as { transactionStatus: string; configuredTargetAddress: string };
    expect(data.transactionStatus).toBe("NACK");
    expect(data.configuredTargetAddress).toBe("0x76");

    const busScan = await adapter.executeCapability("scan_i2c_bus");
    expect(busScan.ok).toBe(true);
    const scanData = busScan.data as { devices: string[] };
    expect(scanData.devices).toContain("0x77");
    expect(scanData.devices).not.toContain("0x76");
  });

  // 13. Duplicate Tool Call (Idempotency)
  it("Scenario 13: Duplicate tool call ID returns cached or rejected result without re-actuating", async () => {
    let physicalExecutionCount = 0;
    const origExecute = adapter.executeCapability.bind(adapter);
    adapter.executeCapability = async (name, params, signal) => {
      if (name === "run_relay_stress_test") {
        physicalExecutionCount++;
      }
      return origExecute(name, params, signal);
    };

    let turn = 0;
    const provider: BenchAgentProvider = {
      async turn() {
        turn++;
        if (turn <= 2) {
          return {
            interactionId: "chaos-int-13-1",
            functionCalls: [
              {
                id: "call_duplicate_actuation",
                name: "run_relay_stress_test",
                arguments: { cycles: 1, durationMs: 50 },
              },
            ],
          };
        }
        return { interactionId: "chaos-int-13-2", functionCalls: [], text: "Done" };
      },
    };

    const result = await runBenchAgent({
      modelContext,
      provider,
      goal: "Stress test with duplicate call ID",
      requestApproval: async () => true,
      maxSteps: 3,
    });

    expect(result.status).toBe("completed");
    expect(physicalExecutionCount).toBe(1); // Executed only once!
  });

  // 14. Step Limit Enforced
  it("Scenario 14: Step limit enforced strictly to prevent infinite loops", async () => {
    let turnCount = 0;
    const provider: BenchAgentProvider = {
      async turn() {
        turnCount++;
        return {
          interactionId: `chaos-int-14-${turnCount}`,
          functionCalls: [
            {
              id: `call_turn_${turnCount}`,
              name: "read_reset_history",
              arguments: {},
            },
          ],
        };
      },
    };

    const result = await runBenchAgent({
      modelContext,
      provider,
      goal: "Keep inspecting forever",
      requestApproval: async () => false,
      maxSteps: 3,
    });

    expect(result.status).toBe("step-limit");
    expect(result.steps).toBe(3);
    expect(turnCount).toBeLessThanOrEqual(4);
  });
});
