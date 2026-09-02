/**
 * Experiment domain types and interfaces.
 * Core domain entities for physical and virtual experiment orchestration.
 */

import type { DeviceEvent } from "../device/events";

export type ExperimentStatus = "running" | "completed" | "aborted" | "failed";

export function generateExperimentId(): string {
  const uuid = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
  return `exp_${uuid}`;
}

export interface ExperimentMetadata {
  readonly id: string;
  readonly capability: string;
  readonly startedAt: number;
  readonly completedAt?: number;
  readonly status: ExperimentStatus;
  readonly parameters: Record<string, unknown>;
}

export interface NumericSample {
  readonly tMs: number;
  readonly value: number;
}

export interface TelemetryTrace {
  readonly channel: string;
  readonly unit?: string;
  readonly samples: readonly NumericSample[];
}

export interface ExperimentEvent {
  readonly experimentId: string;
  readonly timestamp: number;
  readonly event: DeviceEvent;
}

export interface VoltageSummary {
  readonly baseline_v: number;
  readonly minimum_v: number;
  readonly drop_v: number;
}

export interface ExperimentSummary {
  readonly experiment_id: string;
  readonly status: ExperimentStatus;
  readonly test: string;
  readonly repetitions?: number;
  readonly failures?: number;
  readonly unexpected_resets?: number;
  readonly reset_reasons?: Record<string, number>;
  readonly supply_voltage?: VoltageSummary;
  readonly [key: string]: unknown;
}

export interface ExperimentRecord {
  readonly metadata: ExperimentMetadata;
  readonly events: readonly ExperimentEvent[];
  readonly traces: Readonly<Record<string, TelemetryTrace>>;
  readonly summary?: ExperimentSummary;
}
