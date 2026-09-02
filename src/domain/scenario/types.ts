/**
 * Mystery Scenario Domain Types.
 * Master Milestone 8 — Blind Hardware Investigation.
 *
 * Ground truth is strictly sealed outside agent context and UI until verification or explicit reveal.
 */

import type { VirtualDeviceConfig } from "../device/virtual-adapter";

export type ScenarioId = "brownout" | "i2c_address" | "sda_fault";

export interface ScenarioInterventionPoint {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly allowedStates: readonly string[];
  readonly initialState: string;
  readonly targetState: string;
}

export interface ScenarioGroundTruth {
  readonly id: ScenarioId;
  readonly title: string;
  readonly hiddenFaultDescription: string;
  readonly expectedDiagnosis: string;
  readonly rootCauseCategory: string;
  readonly expectedRootCauseTags: readonly string[];
  readonly targetIntervention: {
    readonly point: string;
    readonly value: string;
  };
}

export interface ScenarioVerificationCriteria {
  readonly requiredTool: string;
  readonly description: string;
  readonly validateResult: (data: Record<string, unknown>) => boolean;
}

export interface ScenarioDefinition {
  readonly id: ScenarioId;
  readonly publicSymptom: string;
  readonly deviceModel: string;
  readonly allowedInterventionPoints: readonly ScenarioInterventionPoint[];
  readonly initialDeviceConfig: VirtualDeviceConfig;
  readonly groundTruth: ScenarioGroundTruth;
  readonly verificationCriteria: ScenarioVerificationCriteria;
}

export interface ScenarioSession {
  readonly sessionId: string;
  readonly scenarioId: ScenarioId;
  readonly publicSymptom: string;
  readonly deviceModel: string;
  readonly allowedInterventionPoints: readonly ScenarioInterventionPoint[];
  readonly isSealed: boolean;
  readonly isVerified: boolean;
  readonly revealedAt?: number;
  markVerified(): void;
  revealGroundTruth(options?: { allowIncomplete?: boolean }): ScenarioGroundTruth;
  getVerificationCriteria(): ScenarioVerificationCriteria;
  getInitialDeviceConfig(): VirtualDeviceConfig;
}
