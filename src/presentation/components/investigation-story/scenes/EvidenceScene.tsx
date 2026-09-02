/**
 * Scene 4 — Captured Empirical Evidence Tokens.
 * Highlights the newly captured evidence records from the physical stress test:
 * - 2.72 V Minimum Supply voltage drop below BOD threshold
 * - E-001 and E-002 immutable token citations
 */

import React from "react";
import { motion } from "motion/react";
import { Layers, RotateCcw, Zap, ArrowRight, ShieldAlert, CheckCircle2 } from "lucide-react";
import type { EvidenceRecord } from "@/domain/evidence/types";

export interface EvidenceSceneProps {
  readonly evidenceRecords: readonly EvidenceRecord[];
  readonly minVoltage?: number;
}

export const EvidenceScene: React.FC<EvidenceSceneProps> = ({
  evidenceRecords,
  minVoltage = 2.72,
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "1.5rem",
        height: "100%",
      }}
    >
      {/* Header Tag */}
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "var(--ohmni-success)", fontSize: "13px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em" }}>
          <Layers size={15} />
          Empirical Truth • Immutable Evidence Ledger
        </div>
        <h2 className="scene-heading" style={{ margin: "4px 0 0" }}>
          Measured Fault Reproduction
        </h2>
      </div>

      {/* Hero Fault Measurement Card */}
      <div
        style={{
          background: "var(--ohmni-surface)",
          border: "1.5px solid rgba(217, 74, 69, 0.4)",
          borderRadius: "var(--radius-xl)",
          padding: "1.75rem 2rem",
          boxShadow: "var(--shadow-card)",
          display: "grid",
          gridTemplateColumns: "1.2fr 1fr",
          gap: "2rem",
          alignItems: "center",
        }}
      >
        <div>
          <span
            style={{
              fontSize: "11px",
              fontWeight: 800,
              padding: "3px 8px",
              borderRadius: "var(--radius-full)",
              background: "var(--ohmni-fault-subtle)",
              color: "var(--ohmni-fault)",
              letterSpacing: "0.04em",
              textTransform: "uppercase",
            }}
          >
            CONFIRMED SUPPLY BROWNOUT
          </span>

          <div className="major-value" style={{ color: "var(--ohmni-fault)", margin: "0.5rem 0 0.25rem" }}>
            {minVoltage.toFixed(2)} V
          </div>

          <p className="body-text" style={{ margin: 0, fontSize: "15px" }}>
            The 3.3 V power rail collapsed <strong>80 mV below the 2.80 V brownout threshold</strong> immediately upon relay coil energization.
          </p>
        </div>

        {/* Evidence Token E-002 Box */}
        <div
          style={{
            background: "var(--ohmni-surface-raised)",
            border: "1px solid var(--ohmni-border)",
            borderRadius: "var(--radius-lg)",
            padding: "1.25rem",
            display: "flex",
            flexDirection: "column",
            gap: "8px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span className="font-mono" style={{ fontSize: "14px", fontWeight: 800, color: "var(--ohmni-brand)" }}>
              TOKEN E-002
            </span>
            <CheckCircle2 size={16} color="var(--ohmni-success)" />
          </div>

          <div style={{ fontSize: "13.5px", fontWeight: 700, color: "var(--ohmni-ink)" }}>
            Supply fell below brownout threshold ({minVoltage.toFixed(2)} V)
          </div>

          <div style={{ fontSize: "12px", color: "var(--ohmni-text-muted)" }}>
            Hardware Experiment: EXP-001 (500 ms stress)
          </div>
        </div>
      </div>

      {/* List of Derived Evidence Items */}
      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--ohmni-secondary)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
          Captured Evidence Records ({evidenceRecords.length})
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
          {evidenceRecords.slice(0, 4).map((record) => (
            <div
              key={record.id}
              style={{
                background: "var(--ohmni-surface)",
                border: "1px solid var(--ohmni-border)",
                borderRadius: "var(--radius-md)",
                padding: "12px 14px",
                display: "flex",
                flexDirection: "column",
                gap: "4px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span className="font-mono" style={{ fontSize: "12px", fontWeight: 700, color: "var(--ohmni-brand)" }}>
                  {record.id}
                </span>
                <span style={{ fontSize: "11px", color: "var(--ohmni-text-muted)", textTransform: "uppercase" }}>
                  {record.type}
                </span>
              </div>
              <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--ohmni-ink)" }}>
                {record.summary}
              </div>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
};
