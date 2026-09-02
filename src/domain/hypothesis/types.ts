/**
 * Hypothesis domain types and interfaces.
 * Defines agent- and human-authored explanatory diagnostic hypotheses built
 * on top of Ohmni's immutable factual Evidence Ledger.
 *
 * Core Principles:
 * 1. Absolute separation between factual evidence (WHAT HAPPENED) and
 *    explanatory hypotheses (WHAT MIGHT EXPLAIN IT).
 * 2. Hypotheses are revisable interpretations, but updates occur strictly
 *    through controlled domain validation.
 * 3. Qualitative confidence tiers only — NO artificial numerical probabilities (e.g. 87.3%).
 * 4. Hypotheses link evidence with explicit relationships (SUPPORTS, CONTRADICTS).
 * 5. Hypotheses cannot modify or forge underlying EvidenceRecords.
 */

export type HypothesisConfidence =
  | "UNTESTED"
  | "LOW"
  | "MEDIUM"
  | "HIGH"
  | "VERY_HIGH";

export type HypothesisStatus =
  | "ACTIVE"
  | "DEPRIORITIZED"
  | "REJECTED"
  | "CONFIRMED";

export type HypothesisVerificationStatus =
  | "NOT_VERIFIED"
  | "AWAITING_INTERVENTION"
  | "AWAITING_RETEST"
  | "VERIFIED";

export type EvidenceRelationship =
  | "SUPPORTS"
  | "STRONGLY_SUPPORTS"
  | "CONTRADICTS"
  | "STRONGLY_CONTRADICTS";

export interface HypothesisEvidenceLink {
  readonly evidenceId: string;
  readonly relationship: EvidenceRelationship;
  readonly note?: string;
}

export interface Hypothesis {
  /**
   * Compact human-readable identifier (e.g. "H-001", "H-002").
   */
  readonly id: string;

  /**
   * Concise explanatory title (e.g. "Relay-induced supply brownout").
   */
  readonly title: string;

  /**
   * Diagnostic explanation of the causal mechanism.
   */
  readonly description: string;

  /**
   * Qualitative confidence tier.
   */
  readonly confidence: HypothesisConfidence;

  /**
   * Operational status of the hypothesis.
   */
  readonly status: HypothesisStatus;

  /**
   * Verification status indicating whether an intervention/retest has validated the fix.
   * For Milestone 6, normal hypotheses remain NOT_VERIFIED.
   */
  readonly verificationStatus: HypothesisVerificationStatus;

  /**
   * Structured links to empirical evidence records.
   */
  readonly evidenceLinks: readonly HypothesisEvidenceLink[];

  /**
   * Convenience array of evidence IDs with SUPPORTS or STRONGLY_SUPPORTS relationship.
   */
  readonly supportingEvidenceIds: readonly string[];

  /**
   * Convenience array of evidence IDs with CONTRADICTS or STRONGLY_CONTRADICTS relationship.
   */
  readonly contradictingEvidenceIds: readonly string[];

  /**
   * Timestamp (epoch ms) when the hypothesis was originally proposed.
   */
  readonly createdAt: number;

  /**
   * Timestamp (epoch ms) of the most recent revision.
   */
  readonly updatedAt: number;

  /**
   * Author provenance.
   */
  readonly createdBy: "agent" | "human";

  /**
   * User-facing scientific explanation justifying the hypothesis.
   */
  readonly rationale?: string;

  /**
   * Reason recorded when hypothesis is rejected.
   */
  readonly rejectionReason?: string;

  /**
   * Rationale recorded when hypothesis is confirmed.
   */
  readonly confirmationRationale?: string;

  /**
   * Recommended next test or diagnostic action to test this hypothesis.
   */
  readonly nextTest?: {
    readonly description: string;
    readonly suggestedTool?: string;
  };
}

/**
 * Format a positive sequence integer into compact H-xxx format.
 * Examples:
 *   1 -> "H-001"
 *   42 -> "H-042"
 *   1000 -> "H-1000"
 */
export function formatHypothesisId(sequence: number): string {
  if (!Number.isInteger(sequence) || sequence <= 0) {
    throw new RangeError(
      `Hypothesis sequence must be a positive integer, received: ${sequence}`
    );
  }
  return `H-${sequence.toString().padStart(3, "0")}`;
}

/**
 * Parse an H-xxx identifier to retrieve its sequence number.
 * Returns null if the format does not match.
 */
export function parseHypothesisIdSequence(id: string): number | null {
  if (typeof id !== "string") {
    return null;
  }
  const match = /^H-(\d{3,})$/.exec(id.trim());
  if (!match || match[1] === undefined) {
    return null;
  }
  const parsed = parseInt(match[1], 10);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

/**
 * Helper to check if a relationship is supporting.
 */
export function isSupportingRelationship(rel: EvidenceRelationship): boolean {
  return rel === "SUPPORTS" || rel === "STRONGLY_SUPPORTS";
}

/**
 * Helper to check if a relationship is contradicting.
 */
export function isContradictingRelationship(rel: EvidenceRelationship): boolean {
  return rel === "CONTRADICTS" || rel === "STRONGLY_CONTRADICTS";
}
