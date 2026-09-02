/**
 * Evidence domain types and interfaces.
 * Defines immutable, factual observation artifacts captured from experiments,
 * hardware telemetry, or recorded human physical inspection.
 */

export type EvidenceSource =
  | "device"
  | "experiment"
  | "human";

export type EvidenceType =
  | "measurement"
  | "reset_event"
  | "test_result"
  | "configuration"
  | "device_state"
  | "human_observation";

export interface EvidenceProvenance {
  readonly origin:
    | "virtual_device"
    | "physical_device"
    | "human";

  readonly experimentId?: string;
  readonly capability?: string;
  readonly toolName?: string;
  readonly [key: string]: unknown;
}

export interface EvidenceRecord {
  /**
   * Compact human-readable identifier (e.g. "E-001", "E-002").
   * Suitable for citation in hypotheses and diagnostic reports.
   */
  readonly id: string;

  /**
   * Objective category of the factual evidence.
   */
  readonly type: EvidenceType;

  /**
   * Factual, objective summary sentence of what occurred.
   * MUST describe "WHAT HAPPENED" and NEVER diagnostic interpretation.
   */
  readonly summary: string;

  /**
   * Unix timestamp (milliseconds) when evidence was recorded.
   */
  readonly createdAt: number;

  /**
   * Correlated experiment identifier, if produced during an experiment.
   */
  readonly experimentId?: string;

  /**
   * Diagnostic capability or WebMCP tool that produced the observation.
   */
  readonly sourceTool?: string;

  /**
   * High-level source category of the observation.
   */
  readonly source: EvidenceSource;

  /**
   * Structured raw measurement or event payload.
   */
  readonly data: unknown;

  /**
   * Rigorous provenance tracking indicating physical/virtual origin and context.
   */
  readonly provenance: EvidenceProvenance;
}

/**
 * Format a positive sequence integer into compact E-xxx format.
 * Examples:
 *   1   -> "E-001"
 *   42  -> "E-042"
 *   100 -> "E-100"
 *   1000 -> "E-1000"
 */
export function formatEvidenceId(sequence: number): string {
  if (!Number.isInteger(sequence) || sequence <= 0) {
    throw new Error(`Invalid evidence sequence number: ${sequence}. Must be positive integer.`);
  }
  const padded = String(sequence).padStart(3, "0");
  return `E-${padded}`;
}

/**
 * Parse an E-xxx identifier to retrieve its sequence number.
 * Returns null if the format does not match.
 */
export function parseEvidenceIdSequence(id: string): number | null {
  const match = /^E-(\d+)$/.exec(id.trim());
  if (!match) {
    return null;
  }
  const seq = parseInt(match[1], 10);
  return Number.isFinite(seq) && seq > 0 ? seq : null;
}
