/**
 * Human Physical Intervention Domain Types.
 * Master Milestone 8 — Generalized Hardware Intervention & Human Collaboration.
 */

export interface InterventionPointOption {
  readonly value: string;
  readonly label: string;
  readonly description?: string;
}

export interface InterventionPoint {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly possibleStates: readonly InterventionPointOption[];
  readonly currentState: string;
  readonly visualAnchor: string;
}

export interface HumanInterventionRequest {
  readonly target: string;
  readonly instruction: string;
  readonly rationale: string;
  readonly evidenceIds?: readonly string[];
  readonly requestedAt: number;
}

export interface HumanObservationRecord {
  readonly interventionPointId: string;
  readonly previousState: string;
  readonly newState: string;
  readonly summary: string;
  readonly timestamp: number;
}
