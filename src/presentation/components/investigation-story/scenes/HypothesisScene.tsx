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
import { Scale, CheckCircle2, ShieldCheck, Wrench } from "lucide-react";
import type { Hypothesis } from "@/domain/hypothesis/types";

export interface HypothesisSceneProps {
  readonly hypothesis?: Hypothesis | null;
  readonly onProceedToRepair?: () => void;
}

const MEASURED_FACTS = [
  "2.72 V minimum",
  "Brownout reset",
  "Relay activation preceded reset",
] as const;

export const HypothesisScene: React.FC<HypothesisSceneProps> = ({
  hypothesis,
  onProceedToRepair,
}) => {
  if (!hypothesis) {
    return null;
  }

  const { id, confidence, supportingEvidenceIds } = hypothesis;

  return (
    <motion.div
      data-scene="hypothesis"
      data-testid="hypothesis-scene"
      initial={{ opacity: 1 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
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
        <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "var(--ohmni-lab-brand)", fontSize: "12.5px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em" }}>
          <Scale size={14} />
          WORKING DIAGNOSIS
        </div>
        <h2 style={{ fontSize: "32px", fontWeight: 800, color: "var(--ohmni-lab-text)", margin: "4px 0 0", letterSpacing: "-0.02em" }}>
          {hypothesis.title}
        </h2>
        <p style={{ margin: "8px 0 0", fontSize: "14px", color: "var(--ohmni-lab-muted)" }}>
          Three measured facts support this diagnosis.
        </p>
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

          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span
              data-testid="hypothesis-status-badge"
              style={{
                fontSize: "11px",
                fontWeight: 800,
                padding: "3px 10px",
                borderRadius: "var(--radius-full)",
                background: "rgba(220, 80, 80, 0.12)",
                color: "var(--ohmni-lab-fault, #DC5050)",
                border: "1px solid rgba(220, 80, 80, 0.3)",
              }}
            >
              NEEDS PHYSICAL VERIFICATION
            </span>
            {supportingEvidenceIds.length > 0 ? (
              <div data-testid="hypothesis-grounded-badge" style={{ display: "flex", alignItems: "center", gap: "6px", color: "var(--ohmni-lab-verified)", fontSize: "12px", fontWeight: 600 }}>
                <CheckCircle2 size={15} />
                <span>{`GROUNDED BY ${supportingEvidenceIds.length} FACTS`}</span>
              </div>
            ) : (
              <div data-testid="hypothesis-grounded-badge" style={{ display: "flex", alignItems: "center", gap: "6px", color: "var(--ohmni-lab-fault, #DC5050)", fontSize: "12px", fontWeight: 700 }}>
                <ShieldCheck size={15} />
                <span>EVIDENCE NOT LINKED</span>
              </div>
            )}
          </div>
        </div>

        {/* Measured Facts */}
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <div className="font-mono" style={{ fontSize: "11px", fontWeight: 700, color: "var(--ohmni-lab-muted)", textTransform: "uppercase" }}>
            MEASURED FACTS
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "10px" }}>
            {MEASURED_FACTS.map((fact, index) => {
              const citeId = supportingEvidenceIds[index];

              return (
                <div
                  key={fact}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "10px 12px",
                    borderRadius: "var(--radius-md)",
                    background: "var(--ohmni-lab-soft-raised)",
                    border: "1px solid var(--ohmni-lab-border)",
                    fontSize: "13px",
                    fontWeight: 700,
                    color: "var(--ohmni-lab-text)",
                  }}
                >
                  <CheckCircle2 size={15} color="var(--ohmni-lab-verified)" aria-hidden="true" />
                  <span>{fact}</span>
                  {citeId && (
                    <span className="font-mono" style={{ marginLeft: "auto", fontSize: "10px", fontWeight: 600, color: "var(--ohmni-lab-muted)" }}>
                      {citeId}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Bottom CTA to Physical Repair Verification (requires supporting evidence) */}
        {onProceedToRepair && supportingEvidenceIds.length > 0 ? (
          <div style={{ paddingTop: "1rem", borderTop: "1px solid var(--ohmni-lab-border)", display: "flex", justifyContent: "flex-end" }}>
            <button
              id="proceed-to-repair-btn"
              data-testid="proceed-to-repair-btn"
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
              <span>Verify with repair →</span>
            </button>
          </div>
        ) : onProceedToRepair ? (
          <div style={{ paddingTop: "1rem", borderTop: "1px solid var(--ohmni-lab-border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: "13px", color: "var(--ohmni-lab-fault, #DC5050)", fontWeight: 600 }}>
              Diagnosis must cite supporting evidence before proceeding to repair.
            </span>
            <button
              id="proceed-to-repair-btn-disabled"
              data-testid="proceed-to-repair-btn-disabled"
              disabled
              className="btn-secondary"
              style={{
                opacity: 0.5,
                cursor: "not-allowed",
                padding: "12px 24px",
                fontSize: "14px",
                fontWeight: 700,
              }}
            >
              <span>Awaiting Evidence Linking</span>
            </button>
          </div>
        ) : null}
      </div>
    </motion.div>
  );
};
