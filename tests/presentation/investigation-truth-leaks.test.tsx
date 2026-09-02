/**
 * Regression Test Suite for Milestone 7.15 — Truth Leak Prevention & Scene Gating.
 *
 * Strict Regression Invariants:
 * 1. Device resetCount > 0 before read_reset_history:
 *    Observing scene MUST NOT reveal reset counts; displays "Reset history not inspected yet." and "—".
 * 2. Malformed read_reset_history result:
 *    MUST NOT display Watchdog = 0 or Software = 0; displays "—" and "Unable to interpret reset-history response."
 * 3. request_human_intervention:
 *    Classified as 'human_request', human approval modal before tool execution = NO.
 * 4. run_relay_stress_test:
 *    Classified as 'physical', Amber human approval modal = YES.
 * 5. Agent finishes without HypothesisStore record (hypothesis = null):
 *    HypothesisScene MUST NOT render; neutral completion/assessment scene renders with model's actual text.
 */

import React from "react";
import { describe, it, expect } from "bun:test";
import { renderToString } from "react-dom/server";
import { ObservingScene } from "@/presentation/components/investigation-story/scenes/ObservingScene";
import { HypothesisScene } from "@/presentation/components/investigation-story/scenes/HypothesisScene";
import { AssessmentScene } from "@/presentation/components/investigation-story/scenes/AssessmentScene";
import { DynamicInvestigationScene } from "@/presentation/components/investigation-story/DynamicInvestigationScene";
import { classifyTool, requiresHumanApproval } from "@/domain/safety/tool-safety-policy";
import type { BenchAgentState } from "@/presentation/hooks/useBenchAgent";
import type { Hypothesis } from "@/domain/hypothesis/types";

describe("Milestone 7.15 — Truth Leak Prevention & Tool Classification", () => {
  describe("1. Device resetCount > 0 before read_reset_history", () => {
    it("ObservingScene MUST NOT reveal reset counts when hasInspectedResetHistory is false", () => {
      const html = renderToString(
        <ObservingScene
          resetCount={5}
          railVoltage={3.31}
          hasInspectedResetHistory={false}
        />
      );

      // Must explicitly declare not inspected
      expect(html).toContain("Reset history not inspected yet.");
      expect(html).not.toContain("Diagnostic registers read via read_reset_history.");

      // Must display "—" for all 3 registers instead of the unobserved device resetCount (5) or 0
      expect(html).not.toContain(">5<");
      expect(html).toContain("—");
      expect(html).toContain("Waiting for agent measurement…");
    });

    it("DynamicInvestigationScene remains in 'ready' scene when resetCount > 0 but agent has not executed read_reset_history", () => {
      const idleAgentState: BenchAgentState = {
        status: "idle",
        goal: "Investigate restart",
        activity: [],
        providerAvailable: true,
        providerStatus: "live",
        checkingAvailability: false,
      };

      const html = renderToString(
        <DynamicInvestigationScene
          agentState={idleAgentState}
          experimentStatus="idle"
          relayState="open"
          resetCount={3} // Device knows 3 resets, but Gemini hasn't called read_reset_history
          railVoltage={3.31}
          ringBufferRef={{ current: null as any }}
          markersRef={{ current: [] }}
          evidenceRecords={[]}
          hypothesis={null}
          onApproveTest={() => {}}
          onDenyTest={() => {}}
        />
      );

      // Must render ready scene, NOT observing scene
      expect(html).toContain('data-scene="ready"');
      expect(html).not.toContain('data-scene="observing"');
      expect(html).not.toContain("Microcontroller Reset History");
    });
  });

  describe("2. Malformed read_reset_history result", () => {
    it("ObservingScene MUST NOT display Watchdog = 0 or Software = 0 on parse failure", () => {
      const html = renderToString(
        <ObservingScene
          resetCount={4}
          railVoltage={3.31}
          hasInspectedResetHistory={true}
          isParseError={true}
          brownoutCount={undefined}
          watchdogCount={undefined}
          softwarePanicCount={undefined}
        />
      );

      // Must show warning
      expect(html).toContain("Unable to interpret reset-history response.");

      // Must show dashes for all values and NOT manufacture 0 or resetCount
      expect(html).not.toContain(">0<");
      expect(html).not.toContain(">4<");
      expect(html).toContain("—");
    });

    it("DynamicInvestigationScene gracefully handles malformed JSON without crashing or inventing zero counts", () => {
      const agentStateWithCorruptResult: BenchAgentState = {
        status: "investigating",
        goal: "Diagnose resets",
        steps: 1,
        activity: [
          {
            call: { id: "call-1", name: "read_reset_history", arguments: {} },
            status: "completed",
            result: "{ this_is_invalid_json: true, missing_braces ",
          },
        ],
        providerAvailable: true,
        providerStatus: "live",
      };

      const html = renderToString(
        <DynamicInvestigationScene
          agentState={agentStateWithCorruptResult}
          experimentStatus="idle"
          relayState="open"
          resetCount={7}
          railVoltage={3.31}
          ringBufferRef={{ current: null as any }}
          markersRef={{ current: [] }}
          evidenceRecords={[]}
          hypothesis={null}
          onApproveTest={() => {}}
          onDenyTest={() => {}}
        />
      );

      expect(html).toContain('data-scene="observing"');
      expect(html).toContain("Unable to interpret reset-history response.");
      expect(html).not.toContain(">7<");
      expect(html).not.toContain(">0<");
    });
  });

  describe("3. request_human_intervention vs run_relay_stress_test classification", () => {
    it("request_human_intervention does NOT require Amber approval modal (consent boundary is human action)", () => {
      expect(classifyTool("request_human_intervention")).toBe("human_request");
      expect(requiresHumanApproval("request_human_intervention")).toBe(false);
    });

    it("run_relay_stress_test REQUIRES Amber approval modal (machine actuates hardware)", () => {
      expect(classifyTool("run_relay_stress_test")).toBe("physical");
      expect(requiresHumanApproval("run_relay_stress_test")).toBe(true);
    });
  });

  describe("4. HypothesisScene requires a real Hypothesis artifact", () => {
    it("HypothesisScene returns null when hypothesis is null", () => {
      const html = renderToString(<HypothesisScene hypothesis={null} />);
      expect(html).toBe("");
    });

    it("DynamicInvestigationScene renders neutral AssessmentScene when agent completed without hypothesis", () => {
      const completedAgentWithoutHypothesis: BenchAgentState = {
        status: "completed",
        goal: "Check power supply",
        steps: 2,
        assessment: "Device voltage rail is nominal at 3.31V under idle conditions. No abnormal brownouts observed.",
        activity: [],
        providerAvailable: true,
        providerStatus: "live",
      };

      const html = renderToString(
        <DynamicInvestigationScene
          agentState={completedAgentWithoutHypothesis}
          experimentStatus="idle"
          relayState="open"
          resetCount={0}
          railVoltage={3.31}
          ringBufferRef={{ current: null as any }}
          markersRef={{ current: [] }}
          evidenceRecords={[]}
          hypothesis={null}
          onApproveTest={() => {}}
          onDenyTest={() => {}}
        />
      );

      // Must render completed assessment scene, NOT hypothesis scene
      expect(html).toContain('data-scene="completed"');
      expect(html).toContain('data-testid="completion-scene"');
      expect(html).toContain("Diagnostic Findings");
      expect(html).toContain("Device voltage rail is nominal at 3.31V under idle conditions.");
      expect(html).not.toContain('data-scene="hypothesis"');
      expect(html).not.toContain('data-testid="hypothesis-card"');
    });

    it("DynamicInvestigationScene renders HypothesisScene when a real hypothesis exists", () => {
      const realHypothesis: Hypothesis = {
        id: "H-001",
        title: "Relay-induced supply brownout",
        description: "Moving jumper to 5V isolates relay coil inrush.",
        confidence: "HIGH",
        status: "ACTIVE",
        supportingEvidenceIds: ["E-001", "E-002"],
        contradictingEvidenceIds: [],
        evidenceLinks: [
          { evidenceId: "E-001", relationship: "SUPPORTS" },
          { evidenceId: "E-002", relationship: "SUPPORTS" },
        ],
        verificationStatus: "NOT_VERIFIED",
        createdBy: "agent",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      const completedAgentWithHypothesis: BenchAgentState = {
        status: "completed",
        goal: "Investigate restart",
        steps: 3,
        assessment: "Diagnosis complete.",
        activity: [],
        providerAvailable: true,
        providerStatus: "live",
      };

      const html = renderToString(
        <DynamicInvestigationScene
          agentState={completedAgentWithHypothesis}
          experimentStatus="idle"
          relayState="open"
          resetCount={1}
          railVoltage={2.72}
          ringBufferRef={{ current: null as any }}
          markersRef={{ current: [] }}
          evidenceRecords={[]}
          hypothesis={realHypothesis}
          onApproveTest={() => {}}
          onDenyTest={() => {}}
        />
      );

      expect(html).toContain('data-scene="hypothesis"');
      expect(html).toContain('data-testid="hypothesis-card"');
      expect(html).toContain("H-001");
      expect(html).toContain("Relay-induced supply brownout");
      expect(html).toContain("HIGH");
      expect(html).toContain("CONFIDENCE");
    });
  });
});
