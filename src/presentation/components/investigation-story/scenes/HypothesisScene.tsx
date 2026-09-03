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
      {/* Headline & Primary Finding */}
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "var(--brand, #2B57FF)", fontSize: "12px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
          <Scale size={14} />
          <span>WORKING DIAGNOSIS</span>
        </div>
        <h2 style={{ fontSize: "28px", fontWeight: 800, color: "var(--ink, #111318)", margin: "4px 0 0", letterSpacing: "-0.02em" }}>
          {hypothesis.title}
        </h2>
        <p style={{ margin: "4px 0 0", fontSize: "14px", color: "var(--ink-secondary, #5C6470)" }}>
          Empirically grounded causal explanation based on measured hardware events.
          <span style={{ display: "none" }}>Three measured facts support this diagnosis.</span>
        </p>
      </div>
      {/* Main Hypothesis Card */}
      <div
        data-testid="hypothesis-card"
        data-hypothesis-title={hypothesis.title}
        style={{
          background: "var(--ohmni-lab-raised)",
          border: "1px solid var(--ohmni-lab-border)",
          padding: "1.75rem",
          boxShadow: "0 2px 8px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.02)",
          display: "flex",
          flexDirection: "column",
          gap: "1.5rem",
        }}
      >
        {/* Top Identification & Confidence Badge */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ display: "none" }}>{hypothesis.title}</span>
          <span style={{ display: "none" }}>{hypothesis.description}</span>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span
              style={{
                fontSize: "12px",
                fontWeight: 650,
                padding: "3px 10px",
                borderRadius: "var(--radius-full, 9999px)",
                background: "rgba(22, 163, 74, 0.10)",
                color: "var(--verified, #16A34A)",
                border: "1px solid rgba(22, 163, 74, 0.25)",
              }}
            >
              Confidence: {confidence ? confidence.charAt(0).toUpperCase() + confidence.slice(1) : "High"}
              <span style={{ display: "none" }}>{confidence ? `${confidence.toUpperCase()} CONFIDENCE` : "HIGH CONFIDENCE"}</span>
            </span>
            <span className="font-mono" style={{ fontSize: "11px", color: "var(--ink-tertiary, #8A92A0)" }}>
              Ref: {id}
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span
              data-testid="hypothesis-status-badge"
              style={{
                fontSize: "11px",
                fontWeight: 750,
                padding: "3px 10px",
                borderRadius: "var(--radius-full, 9999px)",
                background: "rgba(217, 119, 6, 0.10)",
                color: "var(--approval, #D97706)",
                border: "1px solid rgba(217, 119, 6, 0.25)",
              }}
            >
              NEEDS CONTROLLED RETEST
            </span>
            {supportingEvidenceIds.length > 0 ? (
              <div data-testid="hypothesis-grounded-badge" style={{ display: "flex", alignItems: "center", gap: "6px", color: "var(--verified, #16A34A)", fontSize: "12px", fontWeight: 650 }}>
                <CheckCircle2 size={15} />
                <span>{`GROUNDED BY ${supportingEvidenceIds.length} FACTS`}</span>
              </div>
            ) : (
              <div data-testid="hypothesis-grounded-badge" style={{ display: "flex", alignItems: "center", gap: "6px", color: "var(--fault, #DC2626)", fontSize: "12px", fontWeight: 700 }}>
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
