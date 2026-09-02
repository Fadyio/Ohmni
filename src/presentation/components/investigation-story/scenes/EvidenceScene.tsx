/**
 * Scene 4 — Captured Empirical Evidence Records.
 *
 * Requirements:
 * - Renders ONLY factual evidence records from EvidenceStore.
 * - No hardcoded 2.72V fallback or fake tokens.
 * - Displays immutable token IDs (e.g. E-001, E-002) and extracted facts.
 */

import React from "react";
import { motion } from "motion/react";
import { CheckCircle2, Layers, ShieldCheck, Activity } from "lucide-react";
import type { EvidenceRecord } from "@/domain/evidence/types";

export interface EvidenceSceneProps {
  readonly evidenceRecords: readonly EvidenceRecord[];
}

export const EvidenceScene: React.FC<EvidenceSceneProps> = ({
  evidenceRecords,
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
        color: "var(--ohmni-lab-text)",
      }}
    >
      {/* Header */}
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "var(--ohmni-lab-verified)", fontSize: "12.5px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
          <Layers size={14} />
          MEASURED EVIDENCE LEDGER
        </div>
        <h2 style={{ fontSize: "28px", fontWeight: 800, color: "var(--ohmni-lab-text)", margin: "4px 0 0", letterSpacing: "-0.02em" }}>
          Captured Empirical Facts ({evidenceRecords.length})
        </h2>
        <p style={{ margin: "4px 0 0", fontSize: "14.5px", color: "var(--ohmni-lab-muted)" }}>
          Immutable records generated directly from hardware telemetry and register inspection.
        </p>
      </div>

      {/* List of Derived Evidence Items */}
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {evidenceRecords.length === 0 ? (
          <div
            style={{
              background: "var(--ohmni-lab-raised)",
              border: "1px dashed var(--ohmni-lab-border)",
              borderRadius: "var(--radius-lg)",
              padding: "2rem",
              textAlign: "center",
              color: "var(--ohmni-lab-muted)",
              fontSize: "14px",
            }}
          >
            No evidence records captured yet.
          </div>
        ) : (
          evidenceRecords.map((record) => {
            return (
              <div
                key={record.id}
                data-testid={`evidence-card-${record.id}`}
                style={{
                  background: "var(--ohmni-lab-raised)",
                  border: "1px solid var(--ohmni-lab-border)",
                  borderRadius: "var(--radius-lg)",
                  padding: "1.25rem 1.5rem",
                  display: "flex",
                  flexDirection: "column",
                  gap: "6px",
                  boxShadow: "0 2px 8px rgba(0, 0, 0, 0.2)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span className="font-mono" style={{ fontSize: "13px", fontWeight: 800, color: "var(--ohmni-lab-brand)" }}>
                    TOKEN {record.id}
                  </span>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "var(--ohmni-lab-verified)", fontSize: "11.5px", fontWeight: 600 }}>
                    <CheckCircle2 size={14} />
                    <span>VERIFIED FACT</span>
                  </div>
                </div>

                <div style={{ fontSize: "14.5px", fontWeight: 700, color: "var(--ohmni-lab-text)", marginTop: "2px" }}>
                  {record.summary}
                </div>

                <div className="font-mono" style={{ fontSize: "12px", color: "var(--ohmni-lab-muted)" }}>
                  Source: {record.source} {record.sourceTool ? `(${record.sourceTool})` : ""} • {new Date(record.createdAt).toLocaleTimeString()}
                </div>
              </div>
            );
          })
        )}
      </div>
    </motion.div>
  );
};
