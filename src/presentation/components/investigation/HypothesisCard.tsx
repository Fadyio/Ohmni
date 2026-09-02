/**
 * Hypothesis Card Component.
 * Visualizes a diagnostic hypothesis with its qualitative confidence tier,
 * status, rationale, and explicit evidence links (SUPPORTS, CONTRADICTS).
 */

import React from "react";
import { motion } from "framer-motion";
import {
  Lightbulb,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowRight,
  ShieldAlert,
  Link as LinkIcon,
  HelpCircle,
} from "lucide-react";
import type { Hypothesis, HypothesisConfidence, HypothesisStatus } from "@/domain/hypothesis/types";

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
      return {
        color: "#34d399",
        background: "rgba(16, 185, 129, 0.2)",
        border: "1px solid rgba(52, 211, 153, 0.5)",
        label: "VERY HIGH",
      };
    case "HIGH":
      return {
        color: "#10b981",
        background: "rgba(16, 185, 129, 0.12)",
        border: "1px solid rgba(16, 185, 129, 0.35)",
        label: "HIGH",
      };
    case "MEDIUM":
      return {
        color: "#f59e0b",
        background: "rgba(245, 158, 11, 0.12)",
        border: "1px solid rgba(245, 158, 11, 0.35)",
        label: "MEDIUM",
      };
    case "LOW":
      return {
        color: "#38bdf8",
        background: "rgba(56, 189, 248, 0.1)",
        border: "1px solid rgba(56, 189, 248, 0.25)",
        label: "LOW",
      };
    case "UNTESTED":
    default:
      return {
        color: "#94a3b8",
        background: "rgba(148, 163, 184, 0.08)",
        border: "1px solid rgba(148, 163, 184, 0.2)",
        label: "UNTESTED",
      };
  }
}

function getStatusBadge(status: HypothesisStatus) {
  switch (status) {
    case "CONFIRMED":
      return (
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "3px",
            fontSize: "0.5625rem",
            padding: "1px 5px",
            borderRadius: "var(--radius-sm)",
            background: "rgba(16, 185, 129, 0.15)",
            color: "#10b981",
            border: "1px solid rgba(16, 185, 129, 0.3)",
            fontWeight: 700,
            letterSpacing: "0.04em",
          }}
        >
          <CheckCircle2 size={9} />
          CONFIRMED
        </span>
      );
    case "REJECTED":
      return (
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "3px",
            fontSize: "0.5625rem",
            padding: "1px 5px",
            borderRadius: "var(--radius-sm)",
            background: "rgba(239, 68, 68, 0.12)",
            color: "#ef4444",
            border: "1px solid rgba(239, 68, 68, 0.3)",
            fontWeight: 700,
            letterSpacing: "0.04em",
          }}
        >
          <XCircle size={9} />
          REJECTED
        </span>
      );
    case "DEPRIORITIZED":
      return (
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "3px",
            fontSize: "0.5625rem",
            padding: "1px 5px",
            borderRadius: "var(--radius-sm)",
            background: "rgba(148, 163, 184, 0.1)",
            color: "#94a3b8",
            border: "1px solid rgba(148, 163, 184, 0.2)",
            fontWeight: 600,
          }}
        >
          <Clock size={9} />
          DEPRIORITIZED
        </span>
      );
    case "ACTIVE":
    default:
      return null;
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
  const isRejected = hypothesis.status === "REJECTED";

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.18 }}
      onClick={() => onSelect?.(hypothesis)}
      style={{
        padding: "0.75rem",
        borderRadius: "var(--radius-md)",
        background: isSelected
          ? "rgba(56, 189, 248, 0.08)"
          : isReferencedBySelectedEvidence
            ? "rgba(245, 158, 11, 0.08)"
            : "var(--ohmni-surface-raised)",
        border: isSelected
          ? "1px solid var(--ohmni-accent)"
          : isReferencedBySelectedEvidence
            ? "1px solid var(--ohmni-warning)"
            : "1px solid var(--ohmni-border)",
        boxShadow: isSelected
          ? "0 0 12px rgba(56, 189, 248, 0.15)"
          : isReferencedBySelectedEvidence
            ? "0 0 10px rgba(245, 158, 11, 0.15)"
            : "none",
        cursor: "pointer",
        display: "flex",
        flexDirection: "column",
        gap: "0.5rem",
        transition: "all var(--duration-micro) ease",
        opacity: isRejected ? 0.75 : 1,
      }}
    >
      {/* Header: ID, Status, Confidence */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "6px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span
            className="font-mono"
            style={{
              fontSize: "0.6875rem",
              fontWeight: 700,
              padding: "1px 5px",
              borderRadius: "var(--radius-sm)",
              background: "rgba(56, 189, 248, 0.12)",
              color: "var(--ohmni-accent)",
              border: "1px solid rgba(56, 189, 248, 0.3)",
              letterSpacing: "0.04em",
            }}
          >
            {hypothesis.id}
          </span>
          {getStatusBadge(hypothesis.status)}
        </div>

        {/* Confidence Badge */}
        <span
          className="font-mono"
          style={{
            fontSize: "0.625rem",
            padding: "2px 6px",
            borderRadius: "var(--radius-sm)",
            background: confStyle.background,
            color: confStyle.color,
            border: confStyle.border,
            fontWeight: 700,
            letterSpacing: "0.04em",
          }}
        >
          {confStyle.label}
        </span>
      </div>

      {/* Title */}
      <div>
        <h4
          style={{
            margin: 0,
            fontSize: "0.8125rem",
            fontWeight: 600,
            color: isRejected ? "var(--ohmni-text-muted)" : "var(--ohmni-text-primary)",
            lineHeight: 1.35,
            textDecoration: isRejected ? "line-through" : "none",
          }}
        >
          {hypothesis.title}
        </h4>
        <p
          style={{
            margin: "3px 0 0 0",
            fontSize: "0.71875rem",
            color: "var(--ohmni-text-secondary)",
            lineHeight: 1.4,
          }}
        >
          {hypothesis.description}
        </p>
      </div>

      {/* Evidence Links Section */}
      {hypothesis.evidenceLinks.length > 0 && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "3px",
            padding: "4px 6px",
            borderRadius: "var(--radius-sm)",
            background: "rgba(0, 0, 0, 0.2)",
            border: "1px solid var(--ohmni-border-subtle)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "0.59375rem", color: "var(--ohmni-text-muted)" }}>
            <LinkIcon size={9} />
            <span style={{ fontWeight: 600 }}>EVIDENCE CITATIONS:</span>
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
            {hypothesis.evidenceLinks.map((link) => {
              const isSupport = link.relationship === "SUPPORTS" || link.relationship === "STRONGLY_SUPPORTS";
              return (
                <button
                  key={link.evidenceId}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectEvidenceId?.(link.evidenceId);
                  }}
                  title={link.note || `${link.relationship} by ${link.evidenceId}`}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "3px",
                    padding: "1px 5px",
                    borderRadius: "var(--radius-sm)",
                    background: isSupport ? "rgba(16, 185, 129, 0.1)" : "rgba(239, 68, 68, 0.1)",
                    color: isSupport ? "#10b981" : "#ef4444",
                    border: isSupport ? "1px solid rgba(16, 185, 129, 0.3)" : "1px solid rgba(239, 68, 68, 0.3)",
                    fontFamily: "var(--font-mono)",
                    fontSize: "0.625rem",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  <span>{link.evidenceId}</span>
                  <span style={{ fontSize: "0.5rem", opacity: 0.8 }}>
                    {link.relationship === "STRONGLY_SUPPORTS"
                      ? "++"
                      : link.relationship === "SUPPORTS"
                        ? "+"
                        : link.relationship === "STRONGLY_CONTRADICTS"
                          ? "--"
                          : "-"}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Rationale / Rejection Reason */}
      {hypothesis.rejectionReason && (
        <div
          style={{
            fontSize: "0.6875rem",
            color: "var(--ohmni-fault)",
            background: "rgba(239, 68, 68, 0.08)",
            padding: "4px 6px",
            borderRadius: "var(--radius-sm)",
            border: "1px solid rgba(239, 68, 68, 0.2)",
            lineHeight: 1.35,
          }}
        >
          <span style={{ fontWeight: 600 }}>Rejection: </span>
          {hypothesis.rejectionReason}
        </div>
      )}

      {hypothesis.rationale && !hypothesis.rejectionReason && (
        <div
          style={{
            fontSize: "0.6875rem",
            color: "var(--ohmni-text-secondary)",
            background: "rgba(148, 163, 184, 0.06)",
            padding: "4px 6px",
            borderRadius: "var(--radius-sm)",
            lineHeight: 1.35,
            borderLeft: "2px solid var(--ohmni-accent)",
          }}
        >
          <span style={{ color: "var(--ohmni-text-muted)", fontWeight: 600 }}>Rationale: </span>
          {hypothesis.rationale}
        </div>
      )}
    </motion.div>
  );
};
