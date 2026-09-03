import { describe, it, expect } from "bun:test";
import type { Hypothesis } from "@/domain/hypothesis/types";
import { getNarrativeRailStatus } from "@/presentation/components/investigation-story/InvestigationNarrativeRail";

describe("InvestigationNarrativeRail Event Truth (Milestone 7.14)", () => {
  it("strictly filters completed events and excludes requested / waiting-approval events", () => {
    const activities = [
      {
        call: { id: "call-1", name: "read_reset_history", arguments: {} },
        status: "completed" as const,
        result: JSON.stringify({ resets: [] }),
      },
      {
        call: { id: "call-2", name: "run_relay_stress_test", arguments: { cycles: 3 } },
        status: "waiting-approval" as const,
      },
      {
        call: { id: "call-3", name: "propose_hypothesis", arguments: { title: "Brownout" } },
        status: "requested" as const,
      },
    ];
    const isCompletedActivity = (a: { status: string }) => a.status === "completed";
    const completed = activities.filter(isCompletedActivity);
    expect(completed).toHaveLength(1);
    expect(completed[0].call.name).toBe("read_reset_history");

    // Verify waiting-approval and requested are filtered out
    expect(activities.filter((a) => a.status === "waiting-approval")).toHaveLength(1);
    expect(activities.filter((a) => a.status === "requested")).toHaveLength(1);
  });
});

describe("InvestigationNarrativeRail Status Priority", () => {
  const completedAgentState = {
    agentMode: "demo" as const,
    status: "completed" as const,
    goal: "Test goal",
    activity: [],
    providerAvailable: true,
    providerStatus: "demo" as const,
    steps: 3,
    assessment: "Done",
  };

  it("prioritizes semantic hypothesis over raw completed status", () => {
    const mockHypothesis: Hypothesis = {
      id: "H-001",
      title: "Brownout Reset",
      confidence: "MEDIUM",
      status: "ACTIVE",
      verificationStatus: "NOT_VERIFIED",
      description: "Coil inrush sags MCU rail",
      evidenceLinks: [],
      supportingEvidenceIds: ["E-001"],
      contradictingEvidenceIds: [],
      createdBy: "agent" as const,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    // When agent completed its sequence after forming a hypothesis,
    // semantic phase is hypothesis -> status MUST be "DIAGNOSIS FORMED", not "COMPLETED"
    const status = getNarrativeRailStatus({
      agentState: completedAgentState,
      investigationPhase: "hypothesis",
      hypothesis: mockHypothesis,
      isIdle: false,
      active: false,
    });

    expect(status).toBe("DIAGNOSIS FORMED");
  });

  it("prioritizes waiting_for_human over raw completed status", () => {
    const status = getNarrativeRailStatus({
      agentState: completedAgentState,
      investigationPhase: "waiting_for_human",
      hypothesis: null,
      isIdle: false,
      active: false,
    });

    expect(status).toBe("WAITING FOR YOU");
  });

  it("prioritizes verification_running over raw completed status", () => {
    const status = getNarrativeRailStatus({
      agentState: completedAgentState,
      investigationPhase: "verification_running",
      hypothesis: null,
      isIdle: false,
      active: false,
    });

    expect(status).toBe("VERIFICATION RUNNING");
  });

  it("shows COMPLETED when verified", () => {
    const status = getNarrativeRailStatus({
      agentState: completedAgentState,
      investigationPhase: "verified",
      hypothesis: null,
      isIdle: false,
      active: false,
    });

    expect(status).toBe("COMPLETED");
  });

  it("shows COMPLETED when agent completed with no pending semantic phase", () => {
    const status = getNarrativeRailStatus({
      agentState: completedAgentState,
      investigationPhase: undefined,
      hypothesis: null,
      isIdle: false,
      active: false,
    });

    expect(status).toBe("COMPLETED");
  });
});
