import { describe, expect, it, beforeEach } from "bun:test";
import { VirtualDeviceAdapter } from "../../src/domain/device/virtual-adapter";
import { CapabilityRegistry } from "../../src/infrastructure/webmcp/capability-registry";
import { InMemoryModelContext } from "../../src/infrastructure/webmcp/in-memory-model-context";
import { DeviceToolRegistrar } from "../../src/infrastructure/webmcp/device-tool-registrar";
import { createHypothesisTools } from "../../src/infrastructure/webmcp/hypothesis-tools";
import { createEvidenceTools } from "../../src/infrastructure/webmcp/evidence-tools";
import { InMemoryHypothesisStore } from "../../src/domain/hypothesis";
import { InMemoryEvidenceStore } from "../../src/domain/evidence/store";
import { classifyTool, requiresHumanApproval } from "../../src/domain/safety/tool-safety-policy";
import type { ModelContextExecuteToolOptions } from "../../src/infrastructure/webmcp/types";

describe("Tool Contract & Fuzz Test Matrix (Phase 3)", () => {
  let adapter: VirtualDeviceAdapter;
  let modelContext: InMemoryModelContext;
  let registrar: DeviceToolRegistrar;
  let evidenceStore: InMemoryEvidenceStore;
  let hypothesisStore: InMemoryHypothesisStore;

  async function executeByName(
    name: string,
    input: Record<string, unknown> = {},
    options?: ModelContextExecuteToolOptions
  ): Promise<unknown> {
    const tools = await modelContext.getTools();
    const tool = tools.find((t) => t.name === name);
    if (!tool) {
      throw new Error(`Tool "${name}" not found in registered tools`);
    }
    const resultStr = await modelContext.executeTool(tool, input, options);
    try {
      return JSON.parse(resultStr);
    } catch {
      return resultStr;
    }
  }

  beforeEach(async () => {
    adapter = new VirtualDeviceAdapter();
    await adapter.connect();

    modelContext = new InMemoryModelContext();
    const registry = new CapabilityRegistry();
    registrar = new DeviceToolRegistrar(modelContext, registry);
    await registrar.registerDevice(adapter);

    evidenceStore = new InMemoryEvidenceStore();
    hypothesisStore = new InMemoryHypothesisStore(evidenceStore);

    for (const tool of createHypothesisTools(hypothesisStore)) {
      await modelContext.registerTool(tool);
    }
    for (const tool of createEvidenceTools(evidenceStore)) {
      await modelContext.registerTool(tool);
    }
  });

  it("every registered tool has a valid JSON schema and correct annotations", async () => {
    const tools = await modelContext.getTools();
    expect(tools.length).toBe(19);

    for (const tool of tools) {
      expect(tool.name).toBeDefined();
      expect(tool.name.length).toBeGreaterThan(2);
      expect(tool.description).toBeDefined();
      expect(tool.description.length).toBeGreaterThan(15);
      expect(tool.inputSchema).toBeDefined();
      expect(tool.inputSchema?.type).toBe("object");

      // Execution classification sanity
      const execClass = classifyTool(tool.name, tool.annotations);
      expect(["observe", "reason", "human_request", "physical"]).toContain(execClass);

      if (execClass === "physical") {
        expect(requiresHumanApproval(tool.name, tool.annotations)).toBe(true);
        expect(tool.annotations?.readOnlyHint).toBe(false);
      } else if (execClass === "observe") {
        expect(requiresHumanApproval(tool.name, tool.annotations)).toBe(false);
        expect(tool.annotations?.readOnlyHint).toBe(true);
      } else {
        expect(requiresHumanApproval(tool.name, tool.annotations)).toBe(false);
      }
    }
  });

  describe("Physical Tool Fuzzing & Boundary Protection (run_relay_stress_test)", () => {
    const fuzzInputs = [
      { cycles: 0, duration_ms: 50 },
      { cycles: -1, duration_ms: 50 },
      { cycles: 999999, duration_ms: 50 },
      { cycles: NaN, duration_ms: 50 },
      { cycles: "five" as unknown as number, duration_ms: 50 },
      { cycles: null as unknown as number, duration_ms: 50 },
      { cycles: 3, duration_ms: -50 },
      { cycles: 3, duration_ms: 999999 },
      { cycles: 3, duration_ms: "invalid" as unknown as number },
      {},
    ];

    for (const [idx, input] of fuzzInputs.entries()) {
      it(`safely executes fuzz test case #${idx + 1} (${JSON.stringify(input)}) without crashing or dangling relay`, async () => {
        const result = await executeByName("run_relay_stress_test", input);
        expect(result).toBeDefined();
        // The relay must ALWAYS be left in open (safe) state
        expect(adapter.getRelayState()).toBe("open");
      });
    }

    it("respects AbortSignal immediately and leaves relay open", async () => {
      const controller = new AbortController();
      controller.abort();

      await expect(
        executeByName("run_relay_stress_test", { cycles: 5, duration_ms: 100 }, { signal: controller.signal })
      ).rejects.toThrow();

      expect(adapter.getRelayState()).toBe("open");
    });
  });

  describe("Observational Tool Contracts", () => {
    it("scan_i2c_bus executes safely and returns device array", async () => {
      const result = (await executeByName("scan_i2c_bus", {})) as {
        devices: string[];
        count: number;
      };
      expect(result.devices).toBeDefined();
      expect(Array.isArray(result.devices)).toBe(true);
      expect(typeof result.count).toBe("number");
    });

    it("read_sensor_status executes safely and returns status register", async () => {
      const result = (await executeByName("read_sensor_status", {})) as {
        configuredTargetAddress: string;
        transactionStatus: string;
      };
      expect(result.configuredTargetAddress).toBeDefined();
      expect(["ACK", "NACK", "BUS_ERROR"]).toContain(result.transactionStatus);
    });

    it("read_i2c_line_state returns SCL and SDA line logic levels", async () => {
      const result = (await executeByName("read_i2c_line_state", {})) as {
        scl: string;
        sda: string;
        busReady: boolean;
      };
      expect(result.scl).toBe("HIGH");
      expect(["HIGH", "LOW", "FLOATING"]).toContain(result.sda);
      expect(typeof result.busReady).toBe("boolean");
    });
  });

  describe("Reasoning & Collaboration Tool Contracts", () => {
    it("request_human_intervention rejects missing parameters and formats valid requests", async () => {
      // Missing target
      await expect(
        executeByName("request_human_intervention", {
          instruction: "Move jumper",
          rationale: "Isolate power rail",
        })
      ).rejects.toThrow(/target/);

      // Valid call
      const res = (await executeByName("request_human_intervention", {
        target: "relay_power_jumper",
        instruction: "Move JP1 to 5V",
        rationale: "Avoid brownout sag",
        evidence_ids: ["E-001"],
      })) as { status: string; target: string };

      expect(res.status).toBe("REQUESTED");
      expect(res.target).toBe("relay_power_jumper");
    });

    it("record_conclusion requires valid hypothesis ID and summary", async () => {
      // Missing hypothesis
      await expect(
        executeByName("record_conclusion", {
          root_cause: "Brownout sag",
          summary: "Tested and verified",
        })
      ).rejects.toThrow(/hypothesis_id/);

      // Create a hypothesis first
      const prop = (await executeByName("propose_hypothesis", {
        title: "Relay Brownout",
        description: "Coil inrush current drops rail",
        confidence: "LOW",
      })) as { hypothesis: { id: string } };

      const conclusion = (await executeByName("record_conclusion", {
        hypothesis_id: prop.hypothesis.id,
        root_cause: "Relay powered from 3.3V rail",
        summary: "Verified after relocating jumper to 5V external power.",
        verification_evidence_ids: ["E-001"],
      })) as { ok: boolean; hypothesisId: string };

      expect(conclusion.ok).toBe(true);
      expect(conclusion.hypothesisId).toBe(prop.hypothesis.id);
    });
  });
});
