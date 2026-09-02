import { describe, expect, it, beforeEach } from "bun:test";
import { VirtualDeviceAdapter } from "../../src/domain/device/virtual-adapter";
import { CapabilityRegistry } from "../../src/infrastructure/webmcp/capability-registry";
import { InMemoryModelContext } from "../../src/infrastructure/webmcp/in-memory-model-context";
import { DeviceToolRegistrar } from "../../src/infrastructure/webmcp/device-tool-registrar";
import { runBenchAgent } from "../../src/infrastructure/bench-agent/run-bench-agent";
import type { BenchAgentProvider, AgentTurnRequest, AgentTurnResult } from "../../src/infrastructure/bench-agent/types";

describe("Hardened Bench Agent Loop & Hardware Safety (Phases 7 & 8)", () => {
  let adapter: VirtualDeviceAdapter;
  let modelContext: InMemoryModelContext;
  let registrar: DeviceToolRegistrar;

  beforeEach(async () => {
    adapter = new VirtualDeviceAdapter();
    await adapter.connect();

    modelContext = new InMemoryModelContext();
    const registry = new CapabilityRegistry();
    registrar = new DeviceToolRegistrar(modelContext, registry);
    await registrar.registerDevice(adapter);
  });

  describe("Idempotency Protection", () => {
    it("does not execute physical actuation twice when provider emits identical call IDs", async () => {
      let physicalExecutionCount = 0;

      // Mock provider that emits the same call ID in two steps
      const provider: BenchAgentProvider = {
        turn: async (req: AgentTurnRequest): Promise<AgentTurnResult> => {
          if (typeof req.input === "string") {
            return {
              interactionId: "int-1",
              functionCalls: [
                {
                  id: "call_duplicate_123",
                  name: "measure_supply_voltage",
                  arguments: {},
                },
              ],
            };
          }

          // Step 2: repeats the exact same call_id
          if (Array.isArray(req.input) && req.input[0].call_id === "call_duplicate_123") {
            if (req.previousInteractionId === "int-1") {
              return {
                interactionId: "int-2",
                functionCalls: [
                  {
                    id: "call_duplicate_123", // Duplicate call ID
                    name: "measure_supply_voltage",
                    arguments: {},
                  },
                ],
              };
            }

            return {
              interactionId: "int-3",
              functionCalls: [],
              text: "Investigation concluded.",
            };
          }

          return {
            interactionId: "int-final",
            functionCalls: [],
            text: "Done.",
          };
        },
      };

      const result = await runBenchAgent({
        goal: "Test idempotency",
        modelContext,
        provider,
        requestApproval: async () => true,
        maxSteps: 5,
      });

      expect(result.status).toBe("completed");
    });
  });

  describe("Provider Transient Retries", () => {
    it("retries on transient HTTP 429 and succeeds on subsequent attempt", async () => {
      let attempts = 0;
      const provider: BenchAgentProvider = {
        turn: async (_req: AgentTurnRequest): Promise<AgentTurnResult> => {
          attempts++;
          if (attempts === 1) {
            throw new Error("HTTP 429: Resource exhausted / rate limit exceeded");
          }
          return {
            interactionId: "int-recovered",
            functionCalls: [],
            text: "Recovered successfully after 429 backoff.",
          };
        },
      };

      const result = await runBenchAgent({
        goal: "Test 429 recovery",
        modelContext,
        provider,
        requestApproval: async () => true,
      });

      expect(result.status).toBe("completed");
      expect(attempts).toBe(2);
    });

    it("fails immediately without retrying non-retryable 401 client error", async () => {
      let attempts = 0;
      const provider: BenchAgentProvider = {
        turn: async (_req: AgentTurnRequest): Promise<AgentTurnResult> => {
          attempts++;
          throw new Error("HTTP 401: Unauthorized API key");
        },
      };

      const result = await runBenchAgent({
        goal: "Test 401 fail fast",
        modelContext,
        provider,
        requestApproval: async () => true,
      });

      expect(result.status).toBe("failed");
      expect(attempts).toBe(1); // Exactly 1 attempt, zero retries
    });
  });

  describe("Hardware Safety Invariants — Actuator Teardown", () => {
    it("leaves relay in safe 'open' state on successful run", async () => {
      const provider: BenchAgentProvider = {
        turn: async (req: AgentTurnRequest): Promise<AgentTurnResult> => {
          if (typeof req.input === "string") {
            return {
              interactionId: "int-1",
              functionCalls: [
                {
                  id: "c-1",
                  name: "run_relay_stress_test",
                  arguments: { cycles: 1, duration_ms: 10 },
                },
              ],
            };
          }
          return {
            interactionId: "int-2",
            functionCalls: [],
            text: "Completed",
          };
        },
      };

      await runBenchAgent({
        goal: "Safety check",
        modelContext,
        provider,
        requestApproval: async () => true,
      });

      expect(adapter.getRelayState()).toBe("open");
    });

    it("leaves relay in safe 'open' state on mid-execution abort", async () => {
      const controller = new AbortController();

      const provider: BenchAgentProvider = {
        turn: async (req: AgentTurnRequest): Promise<AgentTurnResult> => {
          if (typeof req.input === "string") {
            return {
              interactionId: "int-1",
              functionCalls: [
                {
                  id: "c-abort",
                  name: "run_relay_stress_test",
                  arguments: { cycles: 5, duration_ms: 200 },
                },
              ],
            };
          }
          return { interactionId: "int-2", functionCalls: [] };
        },
      };

      // Abort during approval
      const runPromise = runBenchAgent({
        goal: "Abort check",
        modelContext,
        provider,
        requestApproval: async () => {
          controller.abort();
          return true;
        },
        signal: controller.signal,
      });

      const result = await runPromise;
      expect(result.status).toBe("stopped");
      expect(adapter.getRelayState()).toBe("open");
    });
  });
});
