/**
 * Hypothesis Card Component.
 * Visualizes a diagnostic hypothesis with its qualitative confidence tier,
 * status, rationale, and explicit evidence citations.
 */

import React from "react";
import { motion } from "motion/react";
import { FileText } from "lucide-react";
import type { Hypothesis, HypothesisConfidence } from "@/domain/hypothesis/types";

export interface HypothesisCardProps {
  readonly hypothesis: Hypothesis;
  readonly isSelected?: boolean;
  readonly onSelect?: (hypothesis: Hypothesis) => void;
  readonly onSelectEvidenceId?: (evidenceId: string) => void;
  readonly isReferencedBySelectedEvidence?: boolean;
}

function getConfidenceStyle(confidence: HypothesisConfidence): {
  color: string;
  background: string;
  border: string;
  label: string;
} {
  switch (confidence) {
    case "VERY_HIGH":
    case "HIGH":
      return {
        color: "var(--ohmni-success)",
        background: "rgba(53, 211, 154, 0.12)",
        border: "rgba(53, 211, 154, 0.3)",
        label: "HIGH CONFIDENCE",
      };
    case "MEDIUM":
      return {
        color: "var(--ohmni-warning)",
        background: "rgba(244, 184, 96, 0.12)",
        border: "rgba(244, 184, 96, 0.3)",
        label: "MEDIUM CONFIDENCE",
      };
    case "LOW":
      return {
        color: "var(--ohmni-text-secondary)",
        background: "rgba(148, 163, 184, 0.1)",
        border: "rgba(148, 163, 184, 0.2)",
        label: "LOW CONFIDENCE",
      };
    case "UNTESTED":
    default:
      return {
        color: "var(--ohmni-brand-hover)",
        background: "rgba(79, 107, 255, 0.12)",
        border: "rgba(79, 107, 255, 0.3)",
        label: "UNTESTED",
      };
  }
}

export const HypothesisCard: React.FC<HypothesisCardProps> = ({
  hypothesis,
  isSelected = false,
  onSelect,
  onSelectEvidenceId,
  isReferencedBySelectedEvidence = false,
}) => {
  const confStyle = getConfidenceStyle(hypothesis.confidence);
  const supportingIds = hypothesis.supportingEvidenceIds || [];

  return (
    <motion.div
      layout
      onClick={() => onSelect?.(hypothesis)}
      style={{
        background: isSelected
          ? "var(--ohmni-surface-active)"
          : isReferencedBySelectedEvidence
          ? "rgba(79, 107, 255, 0.08)"
          : "var(--ohmni-surface-raised)",
        border: `1px solid ${
          isSelected
            ? "var(--ohmni-brand)"
            : isReferencedBySelectedEvidence
            ? "rgba(79, 107, 255, 0.4)"
            : "var(--ohmni-border)"
        }`,
        borderRadius: "var(--radius-lg)",
        padding: "12px",
        cursor: "pointer",
        display: "flex",
        flexDirection: "column",
        gap: "8px",
        boxShadow: isSelected ? "0 4px 16px rgba(79, 107, 255, 0.15)" : "none",
        transition: "border-color 0.15s ease, background 0.15s ease",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span
            className="font-mono"
            style={{
              fontSize: "12px",
              fontWeight: 700,
              padding: "2px 7px",
              borderRadius: "var(--radius-xs)",
              background: "rgba(168, 85, 247, 0.15)",
              color: "#C084FC",
            }}
          >
            {hypothesis.id}
          </span>
          <span
            style={{
              fontSize: "10px",
              fontWeight: 700,
              padding: "2px 6px",
              borderRadius: "var(--radius-xs)",
              background: "rgba(168, 85, 247, 0.1)",
              color: "#C084FC",
            }}
          >
            HYPOTHESIS
          </span>
        </div>

        <span
          className="font-mono"
          style={{
            fontSize: "10px",
            fontWeight: 700,
            padding: "2px 8px",
            borderRadius: "var(--radius-full)",
            background: confStyle.background,
            color: confStyle.color,
            border: `1px solid ${confStyle.border}`,
          }}
        >
          {hypothesis.confidence}
        </span>
      </div>

      {/* Title / Summary */}
      <div
        style={{
          fontSize: "13px",
          fontWeight: 600,
          color: "var(--ohmni-text-primary)",
          lineHeight: 1.35,
        }}
      >
        {hypothesis.title}
      </div>

      {/* Description / Rationale */}
      {(hypothesis.description || hypothesis.rationale) && (
        <div
          style={{
            fontSize: "12px",
            color: "var(--ohmni-text-secondary)",
            lineHeight: 1.4,
          }}
        >
          {hypothesis.description || hypothesis.rationale}
        </div>
      )}

      {/* Citations / Supporting Evidence Links */}
      {supportingIds.length > 0 && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "4px",
            marginTop: "2px",
            paddingTop: "6px",
            borderTop: "1px solid var(--ohmni-border-subtle)",
          }}
        >
          <div className="metadata-text" style={{ fontSize: "10px", textTransform: "uppercase" }}>
            Supporting Evidence ({supportingIds.length})
          </div>
          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
            {supportingIds.map((eid) => (
              <button
                key={eid}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectEvidenceId?.(eid);
                }}
                className="font-mono"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                  padding: "2px 6px",
                  borderRadius: "var(--radius-xs)",
                  background: "rgba(53, 198, 244, 0.1)",
                  border: "1px solid rgba(53, 198, 244, 0.25)",
                  color: "var(--ohmni-signal)",
                  fontSize: "11px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                <FileText size={10} />
                {eid}
              </button>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
};
