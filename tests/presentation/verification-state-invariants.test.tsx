/**
 * tests/presentation/verification-state-invariants.test.tsx
 *
 * P0 Invariant Suite: Verification State Machine Truthfulness.
 *
 * Asserts:
 * 1. STATE A: Post-repair stress test passed, confirm_hypothesis not yet called
 *    - UI contains "Retest passed" and "Awaiting agent confirmation"
 *    - UI MUST NOT contain "REPAIR VERIFIED"
 *    - UI MUST NOT contain "Empirically Verified by Bench Agent" or "Bench Agent"
 *    - Narrative rail status is "VERIFICATION PENDING"
 *
 * 2. STATE B: confirm_hypothesis completed successfully
 *    - Final reveal scene renders
 *    - UI contains "REPAIR VERIFIED"
 *    - UI contains "DIAGNOSIS MATCH ✓"
 *    - UI contains "SEALED VIRTUAL GROUND TRUTH"
 *    - UI MUST NOT contain "ACTUAL HARDWARE FAULT"
 *    - Narrative rail status is "COMPLETED"
 *    - Zero pending verification language remains
 *
 * 3. Contradiction-free state progression walkthrough:
 *    - Zero occurrences of contradictory strings across all stages.
 */

import { describe, it, expect } from "bun:test";
import React from "react";
import { renderToString } from "react-dom/server";
import { RepairVerificationScene } from "@/presentation/components/repair/RepairVerificationScene";
import { GroundTruthRevealScene } from "@/presentation/components/mystery/GroundTruthRevealScene";
import { getNarrativeRailStatus } from "@/presentation/components/investigation-story/InvestigationNarrativeRail";
import type { Hypothesis } from "@/domain/hypothesis/types";
import type { ExperimentRecord } from "@/domain/experiment/types";
import type { BenchAgentState } from "@/presentation/hooks/useBenchAgent";
import type { ScenarioGroundTruth } from "@/domain/scenario/types";
import type { DiagnosisMatchResult } from "@/domain/scenario/engine";
import type { EvidenceRecord } from "@/domain/evidence/types";

const mockHypothesisUnconfirmed = {
  id: "H-001",
  title: "Relay-induced MCU supply brownout",
  description: "Relay coil draws inrush current on shared 3.3 V rail, sagging to 2.72 V.",
  rationale: "Relay inrush current on shared rail exceeds supply capability.",
  proposedRemedy: "Move JP1 jumper from 3.3 V to independent 5 V supply.",
  confidence: "HIGH",
  status: "ACTIVE",
  verificationStatus: "NOT_VERIFIED",
  supportingEvidenceIds: ["E-001", "E-002"],
  refutingEvidenceIds: [],
  createdAt: 1000,
  updatedAt: 1000,
} as unknown as Hypothesis;

const mockHypothesisConfirmed = {
  ...mockHypothesisUnconfirmed,
  status: "CONFIRMED",
  verificationStatus: "VERIFIED",
  updatedAt: 2000,
} as unknown as Hypothesis;

const mockFailedExperiment = {
  metadata: {
    id: "exp_pre_repair_001",
    startedAt: 100,
    durationMs: 500,
    toolName: "run_relay_stress_test",
  },
  summary: {
    unexpected_resets: 1,
    cycles_completed: 1,
    message: "Microcontroller reset detected during relay actuation.",
    supply_voltage: {
      minimum_v: 2.72,
      nominal_v: 3.3,
    },
  },
  events: [
    {
      timestampMs: 250,
      event: { type: "reset", reason: "BROWNOUT" },
    },
  ],
  status: "completed",
} as unknown as ExperimentRecord;

const mockPassedRetestExperiment = {
  metadata: {
    id: "exp_verification_001",
    startedAt: 1500,
    durationMs: 500,
    toolName: "run_relay_stress_test",
  },
  summary: {
    unexpected_resets: 0,
    cycles_completed: 3,
    message: "Supply remains securely above reset threshold during full fan actuation.",
    supply_voltage: {
      minimum_v: 3.18,
      nominal_v: 3.3,
    },
  },
  events: [],
  status: "completed",
} as unknown as ExperimentRecord;

const mockGroundTruth = {
  id: "brownout",
  title: "Relay Supply Misconfiguration",
  summary: "Relay coil connected to shared 3.3V microcontroller rail instead of independent 5V supply.",
  hiddenFaultDescription: "Inrush current during relay coil energization collapses the shared 3.3V rail down to 2.72V.",
  expectedDiagnosis: "Relay coil draws peak current from shared 3.3V rail causing MCU brownout reset.",
  correctIntervention: "Move jumper JP1 to independent 5V supply rail.",
  verificationCriteria: "Post-repair relay load test must sag no lower than 2.80V with zero resets.",
  expectedVoltageBefore: 2.72,
  expectedVoltageAfter: 3.18,
  acceptableRootCauses: ["brownout", "shared_power_rail", "relay_inrush"],
} as unknown as ScenarioGroundTruth;

const mockMatchResult: DiagnosisMatchResult = {
  isMatch: true,
  score: 1.0,
  reason: "Agent diagnosis accurately identified relay-induced supply brownout.",
  matchedTags: ["brownout", "shared_power_rail"],
};

const mockEvidence = [
  {
    id: "E-001",
    type: "test_result",
    timestamp: 100,
    source: "device",
    summary: "Supply voltage collapsed to 2.72 V during relay actuation",
    data: { minimum_v: 2.72 },
  },
  {
    id: "E-002",
    type: "human_observation",
    timestamp: 1200,
    source: "human",
    summary: "Relay power jumper moved from shared 3.3V rail to external 5V rail",
    data: { jumper: "5V" },
  },
] as unknown as EvidenceRecord[];

describe("P0 Verification State Invariants", () => {
  describe("STATE A: Post-repair stress test passed, confirm_hypothesis not yet called", () => {
    const mockExperimentStore = {
      getExperiments: () => [mockFailedExperiment, mockPassedRetestExperiment],
      subscribe: () => () => {},
    };

    const mockAdapter = {
      getDescriptor: () => ({
        id: "virtual-esp32s3-env",
        name: "ESP32-S3 Environmental Controller (Virtual)",
        presentationProfile: "authored_esp32_demo",
      }),
      getInterventionPoint: () => "5v",
      setInterventionPoint: () => {},
    } as any;

    const investigatingState = {
      status: "investigating",
      agentMode: "external",
      goal: "Investigate problem",
      steps: 1,
      activity: [
        {
          id: "act-retest",
          call: { id: "call-retest", name: "run_relay_stress_test", arguments: {} },
          status: "completed",
          startedAt: 1500,
          completedAt: 2000,
          result: JSON.stringify({ minimum_v: 3.18, unexpected_resets: 0 }),
        },
      ],
      providerAvailable: true,
      providerStatus: "external",
    } as unknown as BenchAgentState;

    it("displays neutral empirical result: 'Retest passed' and 'Awaiting agent confirmation'", () => {
      const html = renderToString(
        <RepairVerificationScene
          deviceAdapter={mockAdapter}
          experimentStore={mockExperimentStore as any}
          hypothesis={mockHypothesisUnconfirmed}
          agentState={investigatingState}
          onReturnToInvestigation={() => {}}
        />
      );

      // Must contain neutral empirical results
      expect(html).toContain("Retest passed");
      expect(html).toContain("Awaiting agent confirmation");
      expect(html).toContain("3.18 V");
    });

    it("STRICT NEGATIVE INVARIANT: Must NOT contain 'REPAIR VERIFIED' or 'Empirically Verified by Bench Agent'", () => {
      const html = renderToString(
        <RepairVerificationScene
          deviceAdapter={mockAdapter}
          experimentStore={mockExperimentStore as any}
          hypothesis={mockHypothesisUnconfirmed}
          agentState={investigatingState}
          onReturnToInvestigation={() => {}}
        />
      );

      // Must NOT contain premature verified claims
      expect(html).not.toContain("REPAIR VERIFIED");
      expect(html).not.toContain("Empirically Verified by Bench Agent");
      expect(html).not.toContain("Empirically Verified");
      expect(html).not.toContain("Bench Agent");
      expect(html).not.toContain("BENCH AGENT");
    });

    it("activity status in narrative rail is 'VERIFICATION PENDING'", () => {
      const status = getNarrativeRailStatus({
        agentState: investigatingState,
        investigationPhase: "verification_pending",
        hypothesis: mockHypothesisUnconfirmed,
        isIdle: false,
        active: true,
        isExternal: true,
      });

      expect(status).toBe("VERIFICATION PENDING");
      expect(status).not.toBe("COMPLETED");
    });
  });

  describe("STATE B: confirm_hypothesis completed successfully", () => {
    it("renders the final verified reveal scene with REPAIR VERIFIED and DIAGNOSIS MATCH ✓", () => {
      const html = renderToString(
        <GroundTruthRevealScene
          groundTruth={mockGroundTruth}
          hypothesis={mockHypothesisConfirmed}
          matchResult={mockMatchResult}
          evidenceRecords={mockEvidence}
          toolsUsedCount={8}
          experimentsCount={2}
          humanInterventionsCount={1}
          isVerified={true}
          onRunAnotherMystery={() => {}}
          onReturnToWorkbench={() => {}}
        />
      );

      expect(html).toContain("REPAIR VERIFIED");
      expect(html).toContain("DIAGNOSIS MATCH ✓");
      expect(html).toContain("SEALED VIRTUAL GROUND TRUTH");
      expect(html).toContain("Relay Supply Misconfiguration");
      expect(html).toContain("AGENT DIAGNOSIS");
      expect(html).toContain("Relay-induced MCU supply brownout");
    });

    it("STRICT NEGATIVE INVARIANT: Must NOT contain 'ACTUAL HARDWARE FAULT' or 'INVESTIGATION INCOMPLETE'", () => {
      const html = renderToString(
        <GroundTruthRevealScene
          groundTruth={mockGroundTruth}
          hypothesis={mockHypothesisConfirmed}
          matchResult={mockMatchResult}
          evidenceRecords={mockEvidence}
          toolsUsedCount={8}
          experimentsCount={2}
          humanInterventionsCount={1}
          isVerified={true}
          onRunAnotherMystery={() => {}}
          onReturnToWorkbench={() => {}}
        />
      );

      expect(html).not.toContain("ACTUAL HARDWARE FAULT");
      expect(html).not.toContain("INVESTIGATION INCOMPLETE");
    });

    it("narrative rail status is 'COMPLETED' with zero pending verification language", () => {
      const completedState = {
        status: "completed",
        agentMode: "external",
        goal: "Investigate problem",
        steps: 3,
        assessment: "Confirmed repair",
        activity: [],
        providerAvailable: true,
        providerStatus: "external",
      } as unknown as BenchAgentState;

      const status = getNarrativeRailStatus({
        agentState: completedState,
        investigationPhase: "verified",
        hypothesis: mockHypothesisConfirmed,
        isIdle: true,
        active: false,
        isExternal: true,
      });

      expect(status).toBe("COMPLETED");
      expect(status).not.toContain("PENDING");
      expect(status).not.toContain("WAITING");
    });
  });

  describe("Contradiction-Free Lifecycle Progression", () => {
    const contradictoryPairs = [
      ["REPAIR VERIFIED", "VERIFICATION PENDING"],
      ["REPAIR VERIFIED", "PENDING RETEST"],
      ["DIAGNOSIS MATCH ✓", "NOT_VERIFIED"],
      ["DIAGNOSIS MATCH ✓", "UNVERIFIED"],
      ["COMPLETED", "VERIFICATION PENDING"],
      ["COMPLETED", "WAITING FOR APPROVAL"],
      ["External agent", "Bench Agent"],
      ["SEALED VIRTUAL GROUND TRUTH", "ACTUAL HARDWARE FAULT"],
    ];

    function assertNoContradictions(html: string, stageName: string) {
      for (const [a, b] of contradictoryPairs) {
        if (html.includes(a) && html.includes(b)) {
          throw new Error(
            `Contradiction detected at stage "${stageName}": contains both "${a}" and "${b}"`
          );
        }
      }
    }

    it("State A contains ZERO contradictory status strings", () => {
      const mockExperimentStore = {
        getExperiments: () => [mockFailedExperiment, mockPassedRetestExperiment],
        subscribe: () => () => {},
      };
      const mockAdapter = {
        getDescriptor: () => ({ id: "virtual-esp32s3-env", name: "Virtual ESP32" }),
        getInterventionPoint: () => "5v",
      } as any;

      const html = renderToString(
        <RepairVerificationScene
          deviceAdapter={mockAdapter}
          experimentStore={mockExperimentStore as any}
          hypothesis={mockHypothesisUnconfirmed}
          agentState={{
            status: "investigating",
            agentMode: "external",
            goal: "Investigate",
            steps: 1,
            activity: [],
            providerAvailable: true,
            providerStatus: "external",
          } as unknown as BenchAgentState}
          onReturnToInvestigation={() => {}}
        />
      );

      assertNoContradictions(html, "State A (Retest passed, pre-confirmation)");
    });

    it("State B contains ZERO contradictory status strings", () => {
      const html = renderToString(
        <GroundTruthRevealScene
          groundTruth={mockGroundTruth}
          hypothesis={mockHypothesisConfirmed}
          matchResult={mockMatchResult}
          evidenceRecords={mockEvidence}
          toolsUsedCount={8}
          experimentsCount={2}
          humanInterventionsCount={1}
          isVerified={true}
          onRunAnotherMystery={() => {}}
          onReturnToWorkbench={() => {}}
        />
      );

      assertNoContradictions(html, "State B (Final verified reveal)");
    });
  });
});
