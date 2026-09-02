/**
 * Scene 5 — Synthesized Root Cause Hypothesis.
 * Displays the evidence-grounded hypothesis:
 * - H-001: Relay-induced supply brownout
 * - HIGH CONFIDENCE tier badge
 * - Supported by E-001 (Brownout reset) and E-002 (2.72 V minimum)
 * - Proposed verification repair action
 */

import React from "react";
import { motion } from "motion/react";
import { Scale, Sparkles, CheckCircle2, ArrowRight, Layers, ShieldCheck, Wrench } from "lucide-react";
import type { Hypothesis } from "@/domain/hypothesis/types";

export interface HypothesisSceneProps {
  readonly hypothesis?: Hypothesis | null;
  readonly onProceedToRepair?: () => void;
}

export const HypothesisScene: React.FC<HypothesisSceneProps> = ({
  hypothesis,
  onProceedToRepair,
}) => {
  const title = hypothesis?.title ?? "Relay-induced supply brownout";
  const confidence = hypothesis?.confidence ?? "HIGH";
  const citations = hypothesis?.supportingEvidenceIds?.length ? hypothesis.supportingEvidenceIds : ["E-001", "E-002"];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "1.75rem",
        height: "100%",
      }}
    >
      {/* Header Tag */}
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "var(--ohmni-agent)", fontSize: "13px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em" }}>
          <Sparkles size={15} />
          Autonomous Diagnosis Complete
        </div>
        <h2 className="scene-heading" style={{ margin: "4px 0 0" }}>
          Root Cause Verification
        </h2>
      </div>

      {/* Main Hypothesis Card */}
      <div
        style={{
          background: "var(--ohmni-surface)",
          border: "1.5px solid rgba(117, 87, 211, 0.3)",
          borderRadius: "var(--radius-xl)",
          padding: "2rem",
          boxShadow: "var(--shadow-card)",
          display: "flex",
          flexDirection: "column",
          gap: "1.5rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span className="font-mono" style={{ fontSize: "16px", fontWeight: 800, color: "var(--ohmni-agent)" }}>
              {hypothesis?.id ?? "H-001"}
            </span>
            <span
              style={{
                fontSize: "12px",
                fontWeight: 800,
                padding: "3px 10px",
                borderRadius: "var(--radius-full)",
                background: "var(--ohmni-success-subtle)",
                color: "var(--ohmni-success)",
                letterSpacing: "0.04em",
              }}
            >
              {confidence} CONFIDENCE
            </span>
          </div>

          <span style={{ fontSize: "13px", color: "var(--ohmni-text-muted)" }}>
            Empirically Proven
          </span>
        </div>

        <div>
          <h3 style={{ fontSize: "22px", fontWeight: 800, color: "var(--ohmni-ink)", margin: "0 0 8px" }}>
            {title}
          </h3>
          <p className="body-text" style={{ fontSize: "15px", lineHeight: 1.6, margin: 0 }}>
            Energizing the 12V fan relay coil draws an inductive surge current directly from the shared 3.3V microcontroller rail, causing rail voltage to collapse to <strong>2.72 V</strong>. This crosses the ESP32-S3 brownout detector (2.80 V), causing a hardware reset.
          </p>
        </div>

        {/* Supporting Evidence Tokens */}
        <div
          style={{
            background: "var(--ohmni-surface-raised)",
            border: "1px solid var(--ohmni-border)",
            borderRadius: "var(--radius-md)",
            padding: "14px 16px",
            display: "flex",
            flexDirection: "column",
            gap: "8px",
          }}
        >
          <div style={{ fontSize: "11.5px", fontWeight: 700, color: "var(--ohmni-secondary)", letterSpacing: "0.04em", textTransform: "uppercase" }}>
            Supported By Factual Evidence
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
            {citations.map((citeId) => (
              <span
                key={citeId}
                className="font-mono"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "4px 10px",
                  borderRadius: "var(--radius-sm)",
                  background: "var(--ohmni-surface)",
                  border: "1px solid var(--ohmni-border)",
                  fontSize: "12px",
                  fontWeight: 700,
                  color: "var(--ohmni-brand)",
                }}
              >
                <CheckCircle2 size={13} color="var(--ohmni-success)" />
                {citeId}: {citeId === "E-001" ? "Brownout Reset Register (3 events)" : "2.72 V Measured Minimum Drop"}
              </span>
            ))}
          </div>
        </div>

        {/* CTA to Proceed to Physical Repair & Verification */}
        {onProceedToRepair && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", marginTop: "0.5rem" }}>
            <button
              onClick={onProceedToRepair}
              className="btn-primary"
              style={{
                padding: "12px 24px",
                fontSize: "15px",
                fontWeight: 700,
                background: "var(--ohmni-agent)",
                borderColor: "var(--ohmni-agent)",
              }}
            >
              <Wrench size={16} />
              Review physical repair instructions
              <ArrowRight size={16} />
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
};
