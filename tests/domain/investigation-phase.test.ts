import { describe, expect, it } from "bun:test";
import {
  deriveInvestigationPhase,
  InvestigationLifecycle,
  isValidTransition,
  type InvestigationPhase,
} from "../../src/domain/investigation";

describe("Investigation Lifecycle & State Machine (Milestone 8)", () => {
  it("executes the full canonical winning demo transition sequence", () => {
    const lifecycle = new InvestigationLifecycle("challenge_ready");
    expect(lifecycle.phase).toBe("challenge_ready");

    // 1. challenge_ready -> ready
    expect(lifecycle.transition("ready", "User accepted mystery challenge")).toBe("ready");

    // 2. ready -> observing
    expect(lifecycle.transition("observing", "Agent started reading reset history")).toBe("observing");

    // 3. observing -> waiting_for_approval
    expect(lifecycle.transition("waiting_for_approval", "Agent requested relay stress test")).toBe("waiting_for_approval");

    // 4. waiting_for_approval -> experiment_running
    expect(lifecycle.transition("experiment_running", "Human granted Amber approval")).toBe("experiment_running");

    // 5. experiment_running -> evidence_review
    expect(lifecycle.transition("evidence_review", "Experiment completed, telemetry captured")).toBe("evidence_review");

    // 6. evidence_review -> hypothesis
    expect(lifecycle.transition("hypothesis", "Agent proposed brownout hypothesis")).toBe("hypothesis");

    // 7. hypothesis -> waiting_for_human
    expect(lifecycle.transition("waiting_for_human", "Agent requested jumper relocation to 5V")).toBe("waiting_for_human");

    // 8. waiting_for_human -> verification_pending
    expect(lifecycle.transition("verification_pending", "Human moved jumper on board")).toBe("verification_pending");

    // 9. verification_pending -> waiting_for_approval
    expect(lifecycle.transition("waiting_for_approval", "Agent requested verification stress test")).toBe("waiting_for_approval");

    // 10. waiting_for_approval -> verification_running
    expect(lifecycle.transition("verification_running", "Human approved re-test")).toBe("verification_running");

    // 11. verification_running -> verified
    expect(lifecycle.transition("verified", "Post-intervention test verified 3.18V no reset")).toBe("verified");

    expect(lifecycle.phase).toBe("verified");
    expect(lifecycle.transitionHistory).toHaveLength(11);
  });

  it("permits all defined legal transitions", () => {
    const legalPairs: readonly [InvestigationPhase, InvestigationPhase][] = [
      ["welcome", "challenge_ready"],
      ["welcome", "ready"],
      ["challenge_ready", "ready"],
      ["ready", "observing"],
      ["ready", "reasoning"],
      ["ready", "waiting_for_approval"],
      ["observing", "reasoning"],
      ["observing", "waiting_for_approval"],
      ["observing", "experiment_running"],
      ["waiting_for_approval", "experiment_running"],
      ["waiting_for_approval", "verification_running"],
      ["waiting_for_approval", "ready"],
      ["experiment_running", "evidence_review"],
      ["evidence_review", "hypothesis"],
      ["hypothesis", "waiting_for_human"],
      ["hypothesis", "verification_pending"],
      ["waiting_for_human", "verification_pending"],
      ["verification_pending", "waiting_for_approval"],
      ["verification_running", "verified"],
      ["verified", "challenge_ready"],
      ["failed", "challenge_ready"],
      ["stopped", "ready"],
    ];

    for (const [from, to] of legalPairs) {
      expect(isValidTransition(from, to)).toBe(true);
      const lc = new InvestigationLifecycle(from);
      expect(lc.transition(to)).toBe(to);
    }
  });

  it("strictly rejects illegal / impossible transitions", () => {
    const illegalPairs: readonly [InvestigationPhase, InvestigationPhase][] = [
      ["welcome", "verified"],
      ["welcome", "experiment_running"],
      ["challenge_ready", "verified"],
      ["challenge_ready", "experiment_running"],
      ["waiting_for_human", "verified"], // Cannot leap directly from waiting_for_human to verified without verification test
      ["welcome", "verification_running"],
      ["ready", "verified"],
    ];

    for (const [from, to] of illegalPairs) {
      expect(isValidTransition(from, to)).toBe(false);
      const lc = new InvestigationLifecycle(from);
      expect(() => lc.transition(to)).toThrow(/Invalid investigation lifecycle transition/);
    }
  });

  describe("deriveInvestigationPhase", () => {
    it("derives welcome when not started and not challenge mode", () => {
      const phase = deriveInvestigationPhase({
        isConnected: false,
        isAgentRunning: false,
        hasStarted: false,
        isChallengeMode: false,
      });
      expect(phase).toBe("welcome");
    });

    it("derives challenge_ready when not started in challenge mode", () => {
      const phase = deriveInvestigationPhase({
        isConnected: false,
        isAgentRunning: false,
        hasStarted: false,
        isChallengeMode: true,
      });
      expect(phase).toBe("challenge_ready");
    });

    it("derives connecting when started but not yet connected", () => {
      const phase = deriveInvestigationPhase({
        isConnected: false,
        isAgentRunning: false,
        hasStarted: true,
      });
      expect(phase).toBe("connecting");
    });

    it("derives waiting_for_approval when isAwaitingApproval is true", () => {
      const phase = deriveInvestigationPhase({
        isConnected: true,
        isAgentRunning: true,
        hasStarted: true,
        isAwaitingApproval: true,
      });
      expect(phase).toBe("waiting_for_approval");
    });

    it("derives experiment_running vs verification_running based on isVerificationExperiment", () => {
      const normalExp = deriveInvestigationPhase({
        isConnected: true,
        isAgentRunning: true,
        hasStarted: true,
        isExperimentActive: true,
        isVerificationExperiment: false,
      });
      expect(normalExp).toBe("experiment_running");

      const verifyExp = deriveInvestigationPhase({
        isConnected: true,
        isAgentRunning: true,
        hasStarted: true,
        isExperimentActive: true,
        isVerificationExperiment: true,
      });
      expect(verifyExp).toBe("verification_running");
    });

    it("derives waiting_for_human when agent requests physical action", () => {
      const phase = deriveInvestigationPhase({
        isConnected: true,
        isAgentRunning: true,
        hasStarted: true,
        isWaitingForHuman: true,
      });
      expect(phase).toBe("waiting_for_human");
    });

    it("derives verification_pending after human changes physical system", () => {
      const phase = deriveInvestigationPhase({
        isConnected: true,
        isAgentRunning: true,
        hasStarted: true,
        isHumanInterventionCompleted: true,
        isVerified: false,
      });
      expect(phase).toBe("verification_pending");
    });

    it("derives verified when isVerified is true", () => {
      const phase = deriveInvestigationPhase({
        isConnected: true,
        isAgentRunning: false,
        hasStarted: true,
        isHumanInterventionCompleted: true,
        isVerified: true,
      });
      expect(phase).toBe("verified");
    });

    it("derives failed on failureMessage", () => {
      const phase = deriveInvestigationPhase({
        isConnected: true,
        isAgentRunning: false,
        hasStarted: true,
        failureMessage: "Device disconnected during brownout test",
      });
      expect(phase).toBe("failed");
    });
  });
});
