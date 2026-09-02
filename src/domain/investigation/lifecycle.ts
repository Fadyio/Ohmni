/**
 * Domain Investigation Lifecycle & Product State Machine.
 * Master Milestone 8 — Formalized State Machine.
 *
 * Deterministic domain-level lifecycle independent of React view state.
 */

import type { ToolExecutionClass } from "../safety/tool-safety-policy";

export type InvestigationPhase =
  | "welcome"
  | "challenge_ready"
  | "connecting"
  | "ready"
  | "observing"
  | "reasoning"
  | "waiting_for_approval"
  | "experiment_running"
  | "evidence_review"
  | "hypothesis"
  | "waiting_for_human"
  | "verification_pending"
  | "verification_running"
  | "verified"
  | "failed"
  | "stopped";

export interface InvestigationTransition {
  readonly from: InvestigationPhase;
  readonly to: InvestigationPhase;
  readonly reason?: string;
  readonly timestamp: number;
}

export interface InvestigationStateSnapshot {
  readonly isConnected: boolean;
  readonly isAgentRunning: boolean;
  readonly agentStatus?: "idle" | "running" | "waiting_approval" | "stopped" | "failed" | "completed";
  readonly activeToolClass?: ToolExecutionClass;
  readonly isAwaitingApproval?: boolean;
  readonly isExperimentActive?: boolean;
  readonly isVerificationExperiment?: boolean;
  readonly hasRecentEvidence?: boolean;
  readonly hasHypothesis?: boolean;
  readonly isWaitingForHuman?: boolean;
  readonly isHumanInterventionCompleted?: boolean;
  readonly isVerified?: boolean;
  readonly isChallengeMode?: boolean;
  readonly hasStarted?: boolean;
  readonly failureMessage?: string;
}

const LEGAL_TRANSITIONS: Record<InvestigationPhase, ReadonlySet<InvestigationPhase>> = {
  welcome: new Set<InvestigationPhase>(["challenge_ready", "connecting", "ready"]),
  challenge_ready: new Set<InvestigationPhase>(["connecting", "ready", "stopped", "welcome"]),
  connecting: new Set<InvestigationPhase>(["ready", "failed", "stopped", "challenge_ready"]),
  ready: new Set<InvestigationPhase>([
    "observing",
    "reasoning",
    "waiting_for_approval",
    "experiment_running",
    "waiting_for_human",
    "challenge_ready",
    "welcome",
    "stopped",
    "failed",
  ]),
  observing: new Set<InvestigationPhase>([
    "reasoning",
    "waiting_for_approval",
    "experiment_running",
    "evidence_review",
    "hypothesis",
    "waiting_for_human",
    "ready",
    "failed",
    "stopped",
  ]),
  reasoning: new Set<InvestigationPhase>([
    "observing",
    "waiting_for_approval",
    "experiment_running",
    "evidence_review",
    "hypothesis",
    "waiting_for_human",
    "verification_pending",
    "verified",
    "ready",
    "failed",
    "stopped",
  ]),
  waiting_for_approval: new Set<InvestigationPhase>([
    "experiment_running",
    "verification_running",
    "observing",
    "reasoning",
    "ready",
    "failed",
    "stopped",
  ]),
  experiment_running: new Set<InvestigationPhase>([
    "evidence_review",
    "observing",
    "reasoning",
    "hypothesis",
    "ready",
    "failed",
    "stopped",
  ]),
  evidence_review: new Set<InvestigationPhase>([
    "hypothesis",
    "reasoning",
    "observing",
    "waiting_for_approval",
    "waiting_for_human",
    "verification_pending",
    "ready",
    "failed",
    "stopped",
  ]),
  hypothesis: new Set<InvestigationPhase>([
    "waiting_for_human",
    "verification_pending",
    "waiting_for_approval",
    "observing",
    "reasoning",
    "experiment_running",
    "ready",
    "failed",
    "stopped",
  ]),
  waiting_for_human: new Set<InvestigationPhase>([
    "verification_pending",
    "waiting_for_approval",
    "ready",
    "observing",
    "reasoning",
    "failed",
    "stopped",
  ]),
  verification_pending: new Set<InvestigationPhase>([
    "waiting_for_approval",
    "verification_running",
    "observing",
    "reasoning",
    "experiment_running",
    "ready",
    "failed",
    "stopped",
  ]),
  verification_running: new Set<InvestigationPhase>([
    "evidence_review",
    "verified",
    "hypothesis",
    "observing",
    "reasoning",
    "ready",
    "failed",
    "stopped",
  ]),
  verified: new Set<InvestigationPhase>(["challenge_ready", "ready", "welcome", "stopped"]),
  failed: new Set<InvestigationPhase>(["challenge_ready", "ready", "welcome", "stopped"]),
  stopped: new Set<InvestigationPhase>(["challenge_ready", "ready", "welcome", "connecting"]),
};

export function isValidTransition(from: InvestigationPhase, to: InvestigationPhase): boolean {
  if (from === to) return true;
  const allowed = LEGAL_TRANSITIONS[from];
  return allowed ? allowed.has(to) : false;
}

export class InvestigationLifecycle {
  private currentPhase: InvestigationPhase;
  private readonly history: InvestigationTransition[] = [];

  constructor(initialPhase: InvestigationPhase = "welcome") {
    this.currentPhase = initialPhase;
  }

  public get phase(): InvestigationPhase {
    return this.currentPhase;
  }

  public get transitionHistory(): readonly InvestigationTransition[] {
    return this.history;
  }

  public canTransitionTo(next: InvestigationPhase): boolean {
    return isValidTransition(this.currentPhase, next);
  }

  public transition(next: InvestigationPhase, reason?: string): InvestigationPhase {
    if (!this.canTransitionTo(next)) {
      throw new Error(
        `Invalid investigation lifecycle transition from "${this.currentPhase}" to "${next}" (reason: ${reason ?? "none"})`
      );
    }

    if (this.currentPhase !== next) {
      this.history.push({
        from: this.currentPhase,
        to: next,
        reason,
        timestamp: Date.now(),
      });
      this.currentPhase = next;
    }

    return this.currentPhase;
  }

  public reset(phase: InvestigationPhase = "welcome"): void {
    this.currentPhase = phase;
    this.history.length = 0;
  }
}

/**
 * Deterministically derives the current investigation phase from domain state.
 */
export function deriveInvestigationPhase(snapshot: InvestigationStateSnapshot): InvestigationPhase {
  if (snapshot.failureMessage) {
    return "failed";
  }

  if (snapshot.agentStatus === "stopped") {
    return "stopped";
  }

  if (!snapshot.hasStarted) {
    if (snapshot.isChallengeMode) {
      return "challenge_ready";
    }
    return "welcome";
  }

  if (!snapshot.isConnected) {
    return "connecting";
  }

  // If verified repair is already established
  if (snapshot.isVerified) {
    return "verified";
  }

  // Active approval gate
  if (snapshot.isAwaitingApproval) {
    return "waiting_for_approval";
  }

  // Active experiment execution
  if (snapshot.isExperimentActive) {
    if (snapshot.isVerificationExperiment) {
      return "verification_running";
    }
    return "experiment_running";
  }

  // Human intervention request is active
  if (snapshot.isWaitingForHuman) {
    return "waiting_for_human";
  }

  // Human intervention performed, waiting for retest
  if (snapshot.isHumanInterventionCompleted && !snapshot.isVerified) {
    return "verification_pending";
  }

  // Active tool execution classification
  if (snapshot.isAgentRunning && snapshot.activeToolClass) {
    if (snapshot.activeToolClass === "observe") {
      return "observing";
    }
    if (snapshot.activeToolClass === "reason") {
      return "reasoning";
    }
    if (snapshot.activeToolClass === "human_request") {
      return "waiting_for_human";
    }
    if (snapshot.activeToolClass === "physical") {
      return snapshot.isVerificationExperiment ? "verification_running" : "experiment_running";
    }
  }

  // Evidence review vs Hypothesis synthesis
  if (snapshot.hasRecentEvidence && !snapshot.hasHypothesis) {
    return "evidence_review";
  }

  if (snapshot.hasHypothesis) {
    return "hypothesis";
  }

  return "ready";
}
