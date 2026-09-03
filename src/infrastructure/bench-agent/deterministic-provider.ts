/**
 * Deterministic Bench Agent Provider.
 * Phase 2 & Phase 5 — Canonical Blind Investigation Walkthrough.
 *
 * Requirements:
 * 1. Operates solely on conversation input and WebMCP tool results.
 * 2. ZERO direct references or imports of VirtualDeviceAdapter, EvidenceStore, HypothesisStore, or ScenarioSession.
 * 3. Does not access hidden scenario ground truth.
 * 4. Responds to AgentTurnRequest with AgentFunctionCalls executed through WebMCP.
 * 5. Respects tool safety policy (amber approvals).
 */

import type {
  AgentFunctionCall,
  AgentFunctionResult,
  AgentTurnRequest,
  AgentTurnResult,
  BenchAgentProvider,
} from "./types";

export class DeterministicBenchAgentProvider implements BenchAgentProvider {
  private turnCount = 0;
  private lastHypothesisId = "H-001";
  private verifiedExperimentId?: string;
  private verificationEvidenceIds: string[] = [];

  public async canary(_options?: { signal?: AbortSignal }): Promise<{
    readonly ok: boolean;
    readonly message: string;
    readonly model: string;
  }> {
    return {
      ok: true,
      message: "Deterministic Demo Agent ready.",
      model: "deterministic-demo",
    };
  }

  public reset(): void {
    this.turnCount = 0;
    this.lastHypothesisId = "H-001";
    this.verifiedExperimentId = undefined;
    this.verificationEvidenceIds = [];
  }

  public async turn(
    request: AgentTurnRequest,
    _options?: { signal?: AbortSignal }
  ): Promise<AgentTurnResult> {
    this.turnCount += 1;
    const interactionId = `turn-${this.turnCount}-${Date.now()}`;
    const { input } = request;

    // Case A: Input is a string (initial goal OR human observation)
    if (typeof input === "string") {
      const lower = input.toLowerCase();
      const isHumanObservation =
        lower.includes("human") ||
        lower.includes("jumper") ||
        lower.includes("jp1") ||
        lower.includes("5v") ||
        lower.includes("auxiliary") ||
        lower.includes("moved") ||
        lower.includes("changed") ||
        lower.includes("relocate") ||
        lower.includes("switched");

      if (isHumanObservation) {
        return {
          interactionId,
          functionCalls: [
            {
              id: `call_retest_${this.turnCount}`,
              name: "run_relay_stress_test",
              arguments: { cycles: 3, duration_ms: 50 },
            },
          ],
          text: "Human-confirmed virtual DUT intervention observed: JP1 moved to the 5 V auxiliary rail. Rerunning the relay stress test to verify supply stability under load.",
        };
      }

      // Initial prompt / goal: start by reading reset history
      return {
        interactionId,
        functionCalls: [
          {
            id: `call_read_resets_${this.turnCount}`,
            name: "read_reset_history",
            arguments: {},
          },
        ],
        text: "Initiating hardware investigation into reported controller restarts. Querying system reset history register to determine reboot cause.",
      };
    }

    // Case B: Input is AgentFunctionResult[]
    if (Array.isArray(input)) {
      const results = input as readonly AgentFunctionResult[];

      const failedResult = results.find((result) => result.is_error === true);
      if (failedResult) {
        return {
          interactionId,
          functionCalls: [],
          text: `The deterministic walkthrough stopped safely because ${failedResult.name} failed. Retry the walkthrough to start from a clean virtual DUT state.`,
        };
      }

      // 1. Check for confirm_hypothesis
      const confirmResult = results.find((r) => r.name === "confirm_hypothesis");
      if (confirmResult) {
        return {
          interactionId,
          functionCalls: [],
          text: "Investigation complete and experimentally verified: The controller restarts were caused by the cooling fan relay coil inrush current collapsing the shared 3.3 V MCU rail. Relocating jumper JP1 from the shared 3.3 V rail to the external 5 V auxiliary rail completely resolved the voltage sag and prevented brownout resets.",
        };
      }

      // 1b. Check for update_hypothesis
      const updateResult = results.find((r) => r.name === "update_hypothesis");
      if (updateResult) {
        return {
          interactionId,
          functionCalls: [
            {
              id: `call_confirm_hyp_${this.turnCount}`,
              name: "confirm_hypothesis",
              arguments: {
                hypothesis_id: this.lastHypothesisId || "H-001",
                rationale: "Post-repair relay stress test proved that with relay powered from 5 V auxiliary rail, MCU rail remained stable at >= 3.18 V with zero resets under load.",
                evidence_ids: this.verificationEvidenceIds,
                verified_experiment_id: this.verifiedExperimentId || "exp_verification",
              },
            },
          ],
          text: "Hypothesis confidence elevated to HIGH. Formally confirming and verifying diagnostic hypothesis.",
        };
      }

      const evidenceResult = results.find((r) => r.name === "list_evidence");
      if (evidenceResult && this.verifiedExperimentId) {
        const records = this.parseResultArray(evidenceResult);
        this.verificationEvidenceIds = records
          .filter((record): record is Record<string, unknown> => Boolean(record && typeof record === "object"))
          .map((record) => record.id)
          .filter((id): id is string => typeof id === "string");
        return {
          interactionId,
          functionCalls: [
            {
              id: `call_elevate_hyp_${this.turnCount}`,
              name: "update_hypothesis",
              arguments: {
                hypothesis_id: this.lastHypothesisId || "H-001",
                confidence: "HIGH",
                evidence_ids: this.verificationEvidenceIds,
                reason: "Empirical re-test on 5 V external rail confirmed stable supply voltage with zero brownout resets.",
              },
            },
          ],
          text: "Post-repair evidence was read from the verification experiment. Elevating hypothesis confidence from the cited results.",
        };
      }

      // 2. Check for request_human_intervention
      const interventionResult = results.find((r) => r.name === "request_human_intervention");
      if (interventionResult) {
        return {
          interactionId,
          functionCalls: [],
          text: "Waiting for the human to explicitly simulate moving virtual JP1 from 3.3 V to the 5 V auxiliary rail.",
        };
      }

      // 3. Check for propose_hypothesis
      const proposeResult = results.find((r) => r.name === "propose_hypothesis");
      if (proposeResult) {
        const payload = this.parseResult(proposeResult);
        if (payload?.hypothesis && typeof (payload.hypothesis as Record<string, unknown>).id === "string") {
          this.lastHypothesisId = (payload.hypothesis as Record<string, unknown>).id as string;
        }

        return {
          interactionId,
          functionCalls: [
            {
              id: `call_request_intervention_${this.turnCount}`,
              name: "request_human_intervention",
              arguments: {
                target: "relay_power_jumper",
                instruction: "Simulate moving virtual JP1 from the shared 3.3 V rail to the 5 V auxiliary rail.",
                rationale: "Isolating the relay coil power to the external 5 V auxiliary rail prevents coil inrush current from collapsing the MCU 3.3 V rail.",
              },
            },
          ],
          text: "Hypothesis registered. Verification requires a human-gated virtual DUT intervention: please simulate moving JP1 from the shared 3.3 V rail to the 5 V auxiliary rail.",
        };
      }

      // 4. Check for run_relay_stress_test
      const stressResult = results.find((r) => r.name === "run_relay_stress_test");
      if (stressResult) {
        const payload = this.parseResult(stressResult);
        const isBrownout =
          payload?.resetOccurred === true ||
          payload?.faultReproduced === true ||
          (typeof payload?.unexpected_resets === "number" && payload.unexpected_resets > 0) ||
          (typeof payload?.minVoltage === "number" && payload.minVoltage < 2.8) ||
          ((payload?.supply_voltage as Record<string, unknown>)?.minimum_v !== undefined &&
            Number((payload?.supply_voltage as Record<string, unknown>)?.minimum_v) < 2.8) ||
          payload?.status === "failed";

        if (isBrownout) {
          // Brownout reproduced pre-repair
          return {
            interactionId,
            functionCalls: [
              {
                id: `call_propose_hyp_${this.turnCount}`,
                name: "propose_hypothesis",
                arguments: {
                  title: "Relay-induced MCU supply brownout due to shared 3.3 V rail",
                  description: "Energizing the cooling fan relay draws excessive coil inrush current from the shared 3.3 V rail, collapsing MCU voltage below the 2.80 V brownout threshold.",
                  confidence: "MEDIUM",
                  rationale: "Controlled relay stress test empirically reproduced 2.72 V rail collapse and brownout reset matching past reset logs.",
                  evidence_ids: ["E-001", "E-002", "E-003"],
                },
              },
            ],
            text: "Controlled stress test reproduced the fault: energizing the relay collapsed the MCU rail to 2.72 V (< 2.80 V threshold) and triggered a brownout reset. Proposing root cause hypothesis.",
          };
        }

        // Post-repair verification passed!
        const experimentId =
          (typeof payload?.experiment_id === "string" ? payload.experiment_id : undefined) ??
          (typeof (payload?.data as Record<string, unknown>)?.experiment_id === "string"
            ? ((payload?.data as Record<string, unknown>).experiment_id as string)
            : undefined) ??
          this.verifiedExperimentId ??
          "exp_verification";

        this.verifiedExperimentId = experimentId;

        return {
          interactionId,
          functionCalls: [
            {
              id: `call_list_verification_evidence_${this.turnCount}`,
              name: "list_evidence",
              arguments: {
                experiment_id: experimentId,
              },
            },
          ],
          text: "Post-repair stress test completed successfully with zero resets. Reading the evidence created by that exact experiment before updating the hypothesis.",
        };
      }
      // 5. Check for measure_supply_voltage
      const voltageResult = results.find((r) => r.name === "measure_supply_voltage");
      if (voltageResult) {
        return {
          interactionId,
          functionCalls: [
            {
              id: `call_stress_test_${this.turnCount}`,
              name: "run_relay_stress_test",
              arguments: { cycles: 3, duration_ms: 50 },
            },
          ],
          text: "Baseline supply voltage is nominal (~3.3 V). The symptom states restarts happen when the cooling fan turns on. Requesting controlled relay stress test to test if relay load collapses the supply rail.",
        };
      }

      // 6. Check for read_reset_history
      const resetResult = results.find((r) => r.name === "read_reset_history");
      if (resetResult) {
        return {
          interactionId,
          functionCalls: [
            {
              id: `call_measure_voltage_${this.turnCount}`,
              name: "measure_supply_voltage",
              arguments: {},
            },
          ],
          text: "Reset history confirms recent restarts were caused by supply brownout events. Measuring baseline voltage on the 3.3 V rail.",
        };
      }
    }

    // Default fallback
    return {
      interactionId,
      functionCalls: [],
      text: "Investigation standing by.",
    };
  }

  private parseResult(result: AgentFunctionResult): Record<string, unknown> | null {
    if (!result.result || result.result.length === 0) return null;
    const text = result.result[0].text;
    try {
      return JSON.parse(text);
    } catch {
      return { raw: text };
    }
  }

  private parseResultArray(result: AgentFunctionResult): readonly unknown[] {
    if (!result.result || result.result.length === 0) return [];
    try {
      const parsed = JSON.parse(result.result[0].text) as unknown;
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
}
