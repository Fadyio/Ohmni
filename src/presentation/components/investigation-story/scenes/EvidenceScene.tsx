/**
 * Scene 4 — Captured Empirical Evidence Records.
 *
 * Requirements:
 * - Renders ONLY factual evidence records from EvidenceStore.
 * - No hardcoded 2.72 V fallback or fake tokens.
 * - Displays immutable token IDs (e.g. E-001, E-002) and extracted facts.
 */

import React from "react";
import { motion } from "motion/react";
import { CheckCircle2, Layers, ShieldCheck, Activity } from "lucide-react";
import type { EvidenceRecord } from "@/domain/evidence/types";
import { OHMNI_COPY } from "../../../copy/copy";

export interface EvidenceSceneProps {
  readonly evidenceRecords: readonly EvidenceRecord[];
}

export const EvidenceScene: React.FC<EvidenceSceneProps> = ({
  evidenceRecords,
}) => {
  return (
    <motion.div
      data-scene="evidence"
      data-testid="evidence-scene"
      initial={{ opacity: 1 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
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
        <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "var(--brand, #2B57FF)", fontSize: "12px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
          <Layers size={14} />
          <span>EMPIRICAL MEASUREMENTS · EvidenceStore</span>
        </div>
        <h2 style={{ fontSize: "26px", fontWeight: 750, color: "var(--ink, #111318)", margin: "4px 0 0", letterSpacing: "-0.02em" }}>
          {OHMNI_COPY.evidenceScene.headline} ({evidenceRecords.length})
        </h2>
        <p style={{ margin: "4px 0 0", fontSize: "14px", color: "var(--ink-secondary, #5C6470)" }}>
          {OHMNI_COPY.evidenceScene.subline}
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
              <motion.div
                key={record.id}
                data-testid={`evidence-card-${record.id}`}
                data-evidence-id={record.id}
                className="evidence-token-card"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                style={{
                  background: "var(--surface, #FFFFFF)",
                  border: "1px solid var(--border, rgba(18, 21, 26, 0.08))",
                  borderRadius: "var(--radius-md, 10px)",
                  padding: "1.15rem 1.35rem",
                  display: "flex",
                  flexDirection: "column",
                  gap: "6px",
                  boxShadow: "var(--shadow-soft)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <CheckCircle2 size={16} color="var(--verified, #16A34A)" />
                    <span style={{ fontSize: "15px", fontWeight: 650, color: "var(--ink, #111318)" }}>
                      {record.summary}
                    </span>
                  </div>

                  <span
                    className="font-mono"
                    style={{
                      fontSize: "11px",
                      fontWeight: 650,
                      color: "var(--ink-tertiary, #8A92A0)",
                      background: "rgba(18, 21, 26, 0.04)",
                      padding: "2px 8px",
                      borderRadius: "var(--radius-xs, 4px)",
                    }}
                  >
                    {record.id}
                  </span>
                </div>

                <details style={{ marginTop: "4px" }}>
                  <summary
                    style={{
                      fontSize: "12px",
                      color: "var(--brand, #2B57FF)",
                      cursor: "pointer",
                      fontWeight: 500,
                      userSelect: "none",
                    }}
                  >
                    {OHMNI_COPY.evidenceScene.viewDetails}
                  </summary>
                  <div
                    className="font-mono"
                    style={{
                      marginTop: "6px",
                      fontSize: "11px",
                      color: "var(--ink-secondary, #5C6470)",
                      background: "var(--canvas, #F5F6F8)",
                      padding: "8px 10px",
                      borderRadius: "var(--radius-sm, 6px)",
                      lineHeight: 1.45,
                    }}
                  >
                    Source: {record.source} {record.sourceTool ? `(${record.sourceTool})` : ""} · Recorded at {new Date(record.createdAt).toLocaleTimeString()}
                  </div>
                </details>
              </motion.div>
            );
          })
        )}
      </div>
    </motion.div>
  );
};
