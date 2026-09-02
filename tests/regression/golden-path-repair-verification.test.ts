/**
 * PERMANENT GOLDEN-PATH REGRESSION TEST — MILESTONE 7.10
 *
 * Human Physical Repair & WebMCP Empirical Verification Loop.
 *
 * Sequence:
 * 1. Connect virtual device adapter and register WebMCP tools.
 * 2. Run relay stress test through WebMCP ModelContext -> reproduces BROWNOUT -> produces exp_A.
 * 3. Bench Agent proposes hypothesis H-001 with evidence linking and HIGH confidence.
 * 4. Human physical intervention: changes physical simulator state (relay_power_jumper -> "5v").
 * 5. Run the EXACT SAME WebMCP stress test capability -> nominal 3.18V & 0 resets -> produces exp_B.
 * 6. WebMCP automatically generates new immutable evidence records for exp_B.
 * 7. Agent or domain logic confirms hypothesis H-001 with explicit citations to exp_B evidence.
 * 8. Hypothesis H-001 transitions to CONFIRMED and verificationStatus === "VERIFIED".
 * 9. Assertions:
 *    - exp_A.id !== exp_B.id
 *    - exp_A minimum ≈ 2.72 V
 *    - exp_B minimum ≈ 3.18 V
 *    - exp_A has BROWNOUT reset
 *    - exp_B has zero BROWNOUT resets
 *    - Zero simulator internal secrets/metadata leaked to agent.
 */

import { describe, it, expect, beforeEach } from "bun:test";
import { VirtualDeviceAdapter } from "@/domain/device/virtual-adapter";
import { InMemoryModelContext } from "@/infrastructure/webmcp/in-memory-model-context";
import { CapabilityRegistry } from "@/infrastructure/webmcp/capability-registry";
import { DeviceToolRegistrar } from "@/infrastructure/webmcp/device-tool-registrar";
import { TelemetryEventBus } from "@/domain/telemetry/bus";
import { InMemoryExperimentStore } from "@/domain/experiment/store";
import { ExperimentRunner } from "@/domain/experiment/runner";
import { InMemoryEvidenceStore } from "@/domain/evidence/store";
import { InMemoryHypothesisStore } from "@/domain/hypothesis/store";
import { registerEvidenceTools } from "@/infrastructure/webmcp/evidence-tools";
import { registerHypothesisTools } from "@/infrastructure/webmcp/hypothesis-tools";
import type { RegisteredTool } from "@/infrastructure/webmcp/types";
import { runBenchAgent } from "@/infrastructure/bench-agent/run-bench-agent";
import type {
  BenchAgentProvider,
  AgentTurnRequest,
  AgentTurnResult,
} from "@/infrastructure/bench-agent/types";
describe("Milestone 7.10 Golden Path — Physical Repair & WebMCP Empirical Verification", () => {
  let modelContext: InMemoryModelContext;
  let telemetryBus: TelemetryEventBus;
  let experimentStore: InMemoryExperimentStore;
  let evidenceStore: InMemoryEvidenceStore;
  let hypothesisStore: InMemoryHypothesisStore;
  let experimentRunner: ExperimentRunner;
  let virtualDevice: VirtualDeviceAdapter;
  let capabilityRegistry: CapabilityRegistry;
  let toolRegistrar: DeviceToolRegistrar;

  beforeEach(async () => {
    modelContext = new InMemoryModelContext();
    telemetryBus = new TelemetryEventBus();
    experimentStore = new InMemoryExperimentStore();
    experimentRunner = new ExperimentRunner({
      eventBus: telemetryBus,
      store: experimentStore,
    });
    evidenceStore = experimentRunner.getEvidenceStore() as InMemoryEvidenceStore;
    hypothesisStore = new InMemoryHypothesisStore(evidenceStore);

    // Register investigation tools
    await registerEvidenceTools(modelContext, evidenceStore);
    await registerHypothesisTools(modelContext, hypothesisStore);

    // Register device capabilities
    virtualDevice = new VirtualDeviceAdapter();
    capabilityRegistry = new CapabilityRegistry(experimentRunner);
    toolRegistrar = new DeviceToolRegistrar(modelContext, capabilityRegistry);

    await virtualDevice.connect();
    await toolRegistrar.registerDevice(virtualDevice);
  });

  it("golden path: human physical intervention changes simulator topology and identical WebMCP experiment empirically verifies repair", async () => {
    const tools = await modelContext.getTools();
    const stressTool = tools.find((t: RegisteredTool) => t.name === "run_relay_stress_test");
    const proposeTool = tools.find((t: RegisteredTool) => t.name === "propose_hypothesis");
    const linkTool = tools.find((t: RegisteredTool) => t.name === "link_evidence");
    const updateTool = tools.find((t: RegisteredTool) => t.name === "update_hypothesis");
    const confirmTool = tools.find((t: RegisteredTool) => t.name === "confirm_hypothesis");

    expect(stressTool).toBeDefined();
    expect(proposeTool).toBeDefined();
    expect(linkTool).toBeDefined();
    expect(updateTool).toBeDefined();
    expect(confirmTool).toBeDefined();

    // -------------------------------------------------------------
    // PHASE 1: Fault Reproduction via WebMCP (exp_A)
    // -------------------------------------------------------------
    const resAStr = await modelContext.executeTool(stressTool!, { cycles: 3, durationMs: 0 });
    const resA = JSON.parse(resAStr);

    expect(resA.status).toBe("completed");
    expect(resA.unexpected_resets).toBeGreaterThanOrEqual(1);
    expect(resA.reset_reasons?.BROWNOUT).toBeGreaterThanOrEqual(1);

    const expRecordsInitial = experimentStore.getExperiments();
    expect(expRecordsInitial.length).toBe(1);
    const exp_A = expRecordsInitial[0];

    const minA = exp_A.summary?.supply_voltage?.minimum_v;
    expect(minA).toBeDefined();
    expect(minA!).toBeCloseTo(2.72, 1);
    expect(minA!).toBeLessThan(2.80);

    const evidenceInitial = evidenceStore.getAll();
    expect(evidenceInitial.length).toBeGreaterThanOrEqual(2);
    const e_brownout = evidenceInitial.find((e) => e.type === "reset_event");
    const e_voltage = evidenceInitial.find((e) => e.type === "measurement");

    expect(e_brownout).toBeDefined();
    expect(e_voltage).toBeDefined();

    // -------------------------------------------------------------
    // PHASE 2: Agent Synthesizes Diagnostic Hypothesis (H-001)
    // -------------------------------------------------------------
    const proposeResStr = await modelContext.executeTool(proposeTool!, {
      title: "Relay inrush current causes supply brownout",
      description: "Relay coil draws peak inrush current from the 3.3V supply rail, causing voltage collapse below the 2.80V brownout threshold.",
      confidence: "MEDIUM",
      rationale: "Relay stress test reproduced brownout reset and 2.72V rail collapse.",
      next_test: "Move relay power jumper to external 5V rail and execute verification retest.",
    });
    const proposeRes = JSON.parse(proposeResStr);
    const hypothesisId = proposeRes.hypothesis.id;
    expect(hypothesisId).toBe("H-001");

    await modelContext.executeTool(linkTool!, {
      hypothesis_id: hypothesisId,
      evidence_id: e_brownout!.id,
      relationship: "STRONGLY_SUPPORTS",
      note: "Brownout reset log confirms power collapse during relay actuation.",
    });

    await modelContext.executeTool(linkTool!, {
      hypothesis_id: hypothesisId,
      evidence_id: e_voltage!.id,
      relationship: "STRONGLY_SUPPORTS",
      note: "Measured minimum voltage sag of 2.72V breached 2.80V brownout limit.",
    });

    await modelContext.executeTool(updateTool!, {
      hypothesis_id: hypothesisId,
      confidence: "HIGH",
      evidence_ids: [e_brownout!.id, e_voltage!.id],
      reason: "Empirical evidence confirms brownout reset occurs when relay coil is energized on shared 3.3V rail.",
    });

    const hypBeforeRepair = hypothesisStore.get(hypothesisId);
    expect(hypBeforeRepair?.confidence).toBe("HIGH");
    expect(hypBeforeRepair?.status).toBe("ACTIVE");
    expect(hypBeforeRepair?.verificationStatus).toBe("NOT_VERIFIED");

    // -------------------------------------------------------------
    // PHASE 3: Human Physical Intervention (Virtual Jumper 3.3V -> 5.0V)
    // -------------------------------------------------------------
    // Human changes physical topology via simulator intervention point
    virtualDevice.setInterventionPoint("relay_power_jumper", "5v");
    expect(virtualDevice.getInterventionPoint("relay_power_jumper")).toBe("5v");

    // State after jumper change is NOT yet verified
    const hypAfterJumper = hypothesisStore.get(hypothesisId);
    expect(hypAfterJumper?.verificationStatus).toBe("NOT_VERIFIED");

    // -------------------------------------------------------------
    // PHASE 4: Verification via IDENTICAL WebMCP Capability (exp_B)
    // -------------------------------------------------------------
    const resBStr = await modelContext.executeTool(stressTool!, { cycles: 3, durationMs: 0 });
    const resB = JSON.parse(resBStr);

    expect(resB.status).toBe("completed");
    expect(resB.unexpected_resets ?? 0).toBe(0);
    expect(resB.reset_reasons?.BROWNOUT ?? 0).toBe(0);

    const allExperiments = experimentStore.getExperiments();
    expect(allExperiments.length).toBe(2);
    const exp_B = allExperiments[1];

    // Core Invariants:
    expect(exp_A.metadata.id).not.toBe(exp_B.metadata.id);

    const minB = exp_B.summary?.supply_voltage?.minimum_v;
    expect(minB).toBeDefined();
    expect(minB!).toBeCloseTo(3.18, 1);
    expect(minB!).toBeGreaterThanOrEqual(2.80);

    // -------------------------------------------------------------
    // PHASE 5: New Immutable Evidence Records Generated for exp_B
    // -------------------------------------------------------------
    const postRepairEvidence = evidenceStore.getByExperiment(exp_B.metadata.id);
    expect(postRepairEvidence.length).toBeGreaterThanOrEqual(1);

    const postVoltageEvidence = postRepairEvidence.find((e) => e.type === "measurement" || e.type === "test_result");
    expect(postVoltageEvidence).toBeDefined();

    // -------------------------------------------------------------
    // PHASE 6: Empirical Confirmation & Hypothesis Verification
    // -------------------------------------------------------------
    const citeEvidenceIds = postRepairEvidence.map((e) => e.id);

    await modelContext.executeTool(confirmTool!, {
      hypothesis_id: hypothesisId,
      rationale: `Physical repair moving relay jumper to 5V auxiliary rail empirically verified via WebMCP retest ${exp_B.metadata.id}: minimum supply voltage maintained at ${minB!.toFixed(2)}V across all 3 cycles with 0 brownout resets.`,
      evidence_ids: citeEvidenceIds,
      verified_experiment_id: exp_B.metadata.id,
    });

    const hypVerified = hypothesisStore.get(hypothesisId);
    expect(hypVerified?.status).toBe("CONFIRMED");
    expect(hypVerified?.confidence).toBe("VERY_HIGH");
    expect(hypVerified?.verificationStatus).toBe("VERIFIED");
    expect(hypVerified?.confirmationRationale).toContain(exp_B.metadata.id);

    // -------------------------------------------------------------
    // PHASE 7: Zero Hidden Simulator Metadata Leakage
    // -------------------------------------------------------------
    const serializedModel = JSON.stringify(hypVerified);
    expect(serializedModel).not.toContain("JP1_STATE");
    expect(serializedModel).not.toContain("SIM_FAULT_FLAG");
  });

  it("golden path 7.11: full agent verification loop where agent receives human observation continuation, independently retests, and confirms hypothesis", async () => {
    let turnCount = 0;
    let discoveredEvidenceIds: string[] = [];
    let discoveredVerificationExpId = "";
    const mockAgentProvider: BenchAgentProvider = {
      turn: async (req: AgentTurnRequest): Promise<AgentTurnResult> => {
        turnCount += 1;

        // Turn 1: Initial Diagnosis
        if (turnCount === 1) {
          return {
            interactionId: "interaction-m711-1",
            functionCalls: [
              {
                id: "call-relay-stress-1",
                name: "run_relay_stress_test",
                arguments: { cycles: 3, durationMs: 0 },
              },
            ],
          };
        }

        // Turn 2: List Evidence & Propose Hypothesis
        if (turnCount === 2) {
          return {
            interactionId: "interaction-m711-2",
            functionCalls: [
              {
                id: "call-list-ev-1",
                name: "list_evidence",
                arguments: {},
              },
              {
                id: "call-prop-hypo-1",
                name: "propose_hypothesis",
                arguments: {
                  title: "Relay inrush causes brownout",
                  description: "Relay coil draws peak current on shared 3.3V rail causing brownout reset. Human intervention required: move jumper to 5V rail.",
                  confidence: "MEDIUM",
                  rationale: "Relay stress test reproduced brownout reset below 2.80V.",
                },
              },
              {
                id: "call-update-hypo-1",
                name: "update_hypothesis",
                arguments: {
                  hypothesis_id: "H-001",
                  confidence: "HIGH",
                  evidence_ids: ["E-001", "E-002"],
                  reason: "Brownout telemetry and reset register corroborate relay inrush causality.",
                },
              },
            ],
          };
        }

        // Turn 3: Initial Diagnosis Output
        if (turnCount === 3) {
          return {
            interactionId: "interaction-m711-3",
            functionCalls: [],
            text: "Diagnosis complete: Relay inrush causes brownout. Please move the relay power jumper to the external 5V rail.",
          };
        }

        // Turn 4: Continuation after human observation -> Gemini independently decides to retest
        if (turnCount === 4) {
          expect(typeof req.input === "string" ? req.input : "").toContain("Relay power jumper moved");
          expect(req.previousInteractionId).toBe("interaction-m711-3");
          return {
            interactionId: "interaction-m711-4",
            functionCalls: [
              {
                id: "call-relay-retest",
                name: "run_relay_stress_test",
                arguments: { cycles: 3, durationMs: 0 },
              },
            ],
          };
        }

        // Turn 5: Read new evidence generated by verification experiment
        if (turnCount === 5) {
          if (Array.isArray(req.input)) {
            const retestResult = req.input.find((i) => i.name === "run_relay_stress_test");
            if (retestResult && Array.isArray(retestResult.result) && retestResult.result[0]) {
              try {
                const parsed = JSON.parse(retestResult.result[0].text);
                discoveredVerificationExpId = parsed.experiment_id || "";
              } catch {}
            }
          }
          return {
            interactionId: "interaction-m711-5",
            functionCalls: [
              {
                id: "call-list-ev-post",
                name: "list_evidence",
                arguments: {},
              },
            ],
          };
        }

        // Turn 6: Confirm hypothesis with verified experiment ID and evidence IDs
        if (turnCount === 6) {
          const allEv = evidenceStore.getAll();
          discoveredEvidenceIds = allEv.map((e) => e.id);
          const latestExp = experimentStore.getExperiments()[1];
          const verifiedExpId = discoveredVerificationExpId || latestExp?.metadata.id || "exp_002";

          return {
            interactionId: "interaction-m711-6",
            functionCalls: [
              {
                id: "call-confirm-hypo",
                name: "confirm_hypothesis",
                arguments: {
                  hypothesis_id: "H-001",
                  rationale: `Empirically verified via retest ${verifiedExpId}: 0 resets and nominal voltage maintained.`,
                  evidence_ids: discoveredEvidenceIds,
                  verified_experiment_id: verifiedExpId,
                },
              },
            ],
          };
        }

        // Turn 7: Final verification summary
        return {
          interactionId: "interaction-m711-7",
          functionCalls: [],
          text: "Verification complete: Physical repair to 5V rail empirically verified with 0 resets.",
        };
      },
    };

    // 1. Initial Investigation Run
    const run1 = await runBenchAgent({
      goal: "The controller unexpectedly restarts when the fan turns on. Investigate the cause using the available instruments.",
      modelContext,
      provider: mockAgentProvider,
      requestApproval: async () => true,
      onEvent: () => {},
    });

    expect(run1.status).toBe("completed");
    expect(run1.interactionId).toBe("interaction-m711-3");
    expect(experimentStore.getExperiments().length).toBe(1);

    const hypAfterDiagnosis = hypothesisStore.get("H-001");
    expect(hypAfterDiagnosis?.status).toBe("ACTIVE");
    expect(hypAfterDiagnosis?.verificationStatus).toBe("NOT_VERIFIED");

    // 2. Human Physical Intervention: Human moves jumper to 5V
    virtualDevice.setInterventionPoint("relay_power_jumper", "5v");
    expect(virtualDevice.getInterventionPoint("relay_power_jumper")).toBe("5v");

    // 3. Human Observation Continuation Turn: Tell Gemini I changed it
    const run2 = await runBenchAgent({
      goal: "Human observation: Relay power jumper moved from shared 3.3V rail to external 5V rail.",
      previousInteractionId: run1.interactionId,
      modelContext,
      provider: mockAgentProvider,
      requestApproval: async () => true,
      onEvent: () => {},
    });

    expect(run2.status).toBe("completed");
    expect(run2.interactionId).toBe("interaction-m711-7");

    // 4. Assert Domain State: 2 Experiments, Hypothesis CONFIRMED & VERIFIED
    const allExperiments = experimentStore.getExperiments();
    expect(allExperiments.length).toBe(2);
    expect(allExperiments[0].metadata.id).not.toBe(allExperiments[1].metadata.id);
    expect(allExperiments[1].summary?.supply_voltage?.minimum_v).toBeCloseTo(3.18, 1);

    const hypVerified = hypothesisStore.get("H-001");
    expect(hypVerified?.status).toBe("CONFIRMED");
    expect(hypVerified?.verificationStatus).toBe("VERIFIED");
    expect(hypVerified?.confirmationRationale).toContain(allExperiments[1].metadata.id);
  });
});
