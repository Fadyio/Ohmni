/**
 * Scene 5 — Synthesized Root Cause Hypothesis.
 *
 * Requirements:
 * - Rendered ONLY when HypothesisStore actually contains a hypothesis.
 * - Zero predetermined or hardcoded placeholder strings.
 * - Title, confidence, citations directly from actual hypothesis object.
 */

import React from "react";
import { motion } from "motion/react";
import { Scale, CheckCircle2, ArrowRight, Layers, ShieldCheck, Wrench } from "lucide-react";
import type { Hypothesis } from "@/domain/hypothesis/types";

export interface HypothesisSceneProps {
  readonly hypothesis?: Hypothesis | null;
  readonly onProceedToRepair?: () => void;
}

export const HypothesisScene: React.FC<HypothesisSceneProps> = ({
  hypothesis,
  onProceedToRepair,
}) => {
  if (!hypothesis) {
    return null;
  }

  const { id, title, confidence, supportingEvidenceIds } = hypothesis;

  return (
    <motion.div
      data-scene="hypothesis"
      data-testid="hypothesis-scene"
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "1.75rem",
        height: "100%",
        color: "var(--ohmni-lab-text)",
      }}
    >
      {/* Header Tag */}
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "var(--ohmni-lab-brand)", fontSize: "12.5px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
          <Scale size={14} />
          SYNTHESIZED DIAGNOSIS
        </div>
        <h2 style={{ fontSize: "32px", fontWeight: 800, color: "var(--ohmni-lab-text)", margin: "4px 0 0", letterSpacing: "-0.02em" }}>
          Root Cause Hypothesis
        </h2>
      </div>

      {/* Main Hypothesis Card */}
      <div
        data-testid="hypothesis-card"
        style={{
          background: "var(--ohmni-lab-raised)",
          border: "1.5px solid var(--ohmni-lab-brand)",
          borderRadius: "var(--radius-xl)",
          padding: "2rem",
          boxShadow: "0 0 32px rgba(85, 112, 255, 0.15)",
          display: "flex",
          flexDirection: "column",
          gap: "1.5rem",
        }}
      >
        {/* Top Identification & Confidence Badge */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span className="font-mono" style={{ fontSize: "16px", fontWeight: 800, color: "var(--ohmni-lab-brand)" }}>
              {id}
            </span>
            <span
              style={{
                fontSize: "11px",
                fontWeight: 800,
                padding: "3px 10px",
                borderRadius: "var(--radius-full)",
                background: "rgba(79, 209, 154, 0.15)",
                color: "var(--ohmni-lab-verified)",
                border: "1px solid rgba(79, 209, 154, 0.3)",
              }}
            >
              {confidence} CONFIDENCE
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "var(--ohmni-lab-verified)", fontSize: "12px", fontWeight: 600 }}>
            <CheckCircle2 size={15} />
            <span>GROUNDED BY {supportingEvidenceIds.length} FACTS</span>
          </div>
        </div>

        {/* Title */}
        <div>
          <h3 style={{ fontSize: "22px", fontWeight: 800, color: "var(--ohmni-lab-text)", margin: "0 0 8px" }}>
            {title}
          </h3>
        </div>

        {/* Citations List */}
        {supportingEvidenceIds.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <div className="font-mono" style={{ fontSize: "11px", fontWeight: 700, color: "var(--ohmni-lab-muted)", textTransform: "uppercase" }}>
              CITED EMPIRICAL EVIDENCE
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
              {supportingEvidenceIds.map((citeId) => (
                <span
                  key={citeId}
                  className="font-mono"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "4px 10px",
                    borderRadius: "var(--radius-sm)",
                    background: "var(--ohmni-lab-soft-raised)",
                    border: "1px solid var(--ohmni-lab-border)",
                    fontSize: "12px",
                    fontWeight: 700,
                    color: "var(--ohmni-lab-signal)",
                  }}
                >
                  <CheckCircle2 size={13} color="var(--ohmni-lab-verified)" />
                  <span>TOKEN {citeId}</span>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Bottom CTA to Physical Repair Verification */}
        {onProceedToRepair && (
          <div style={{ paddingTop: "1rem", borderTop: "1px solid var(--ohmni-lab-border)", display: "flex", justifyContent: "flex-end" }}>
            <button
              onClick={onProceedToRepair}
              className="btn-primary"
              style={{
                background: "var(--ohmni-lab-brand)",
                padding: "12px 24px",
                fontSize: "14px",
                fontWeight: 700,
              }}
            >
              <Wrench size={15} />
              <span>Proceed to physical verification & repair</span>
              <ArrowRight size={15} />
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
};
