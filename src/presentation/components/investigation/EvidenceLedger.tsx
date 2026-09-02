/**
 * Evidence Ledger Component.
 * Implements Immutable Evidence Ledger:
 * Displays objective empirical facts ("WHAT HAPPENED") with immutable token IDs (E-001, E-002).
 */

import React from "react";
import { motion } from "motion/react";
import {
  FileText,
  Activity,
  RotateCcw,
  Cpu,
  Zap,
} from "lucide-react";
import type { EvidenceRecord, EvidenceType } from "@/domain/evidence/types";
import type { EvidenceStore } from "@/domain/evidence/store";
import { useEvidenceStore } from "@/presentation/hooks/useEvidenceStore";

export interface EvidenceLedgerProps {
  readonly evidenceStore?: EvidenceStore;
  readonly selectedEvidenceId?: string | null;
  readonly onSelectEvidence?: (record: EvidenceRecord | null) => void;
  readonly highlightedExperimentId?: string | null;
  readonly onHighlightExperiment?: (experimentId: string | null) => void;
}

function getTypeIcon(type: EvidenceType) {
  switch (type) {
    case "measurement":
      return <Zap size={12} color="var(--ohmni-signal)" />;
    case "reset_event":
      return <RotateCcw size={12} color="var(--ohmni-fault)" />;
    case "device_state":
      return <Cpu size={12} color="var(--ohmni-text-secondary)" />;
    case "test_result":
      return <Activity size={12} color="var(--ohmni-brand-hover)" />;
    default:
      return <FileText size={12} color="var(--ohmni-text-muted)" />;
  }
}

export const EvidenceLedger: React.FC<EvidenceLedgerProps> = ({
  evidenceStore,
  selectedEvidenceId,
  onSelectEvidence,
  highlightedExperimentId,
  onHighlightExperiment,
}) => {
  const { records } = useEvidenceStore(evidenceStore);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "8px",
        height: "100%",
        overflowY: "auto",
      }}
    >
      {records.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: "1.5rem 1rem",
            color: "var(--ohmni-text-muted)",
            fontSize: "12px",
            background: "var(--ohmni-surface-raised)",
            borderRadius: "var(--radius-md)",
            border: "1px dashed var(--ohmni-border)",
          }}
        >
          No evidence records yet. The agent records immutable evidence during investigation.
        </div>
      ) : (
        records.map((record: EvidenceRecord) => {
          const isSelected = selectedEvidenceId === record.id;
          const isReset = record.type === "reset_event";

          return (
            <motion.div
              key={record.id}
              layout
              onClick={() => {
                onSelectEvidence?.(record);
              }}
              style={{
                background: isSelected
                  ? "var(--ohmni-surface-active)"
                  : "var(--ohmni-surface-raised)",
                border: `1px solid ${
                  isSelected
                    ? "var(--ohmni-signal)"
                    : isReset
                    ? "rgba(255, 93, 104, 0.3)"
                    : "var(--ohmni-border)"
                }`,
                borderRadius: "var(--radius-md)",
                padding: "10px 12px",
                cursor: "pointer",
                display: "flex",
                flexDirection: "column",
                gap: "6px",
                transition: "border-color 0.15s ease, background 0.15s ease",
              }}
            >
              {/* Token ID & Observed Tag */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span
                    className="font-mono"
                    style={{
                      fontSize: "12px",
                      fontWeight: 700,
                      padding: "2px 7px",
                      borderRadius: "var(--radius-xs)",
                      background: "rgba(53, 198, 244, 0.12)",
                      color: "var(--ohmni-signal)",
                    }}
                  >
                    {record.id}
                  </span>

                  <span
                    style={{
                      fontSize: "10px",
                      fontWeight: 700,
                      padding: "2px 6px",
                      borderRadius: "var(--radius-xs)",
                      background: isReset
                        ? "rgba(255, 93, 104, 0.15)"
                        : "rgba(53, 198, 244, 0.1)",
                      color: isReset ? "var(--ohmni-fault)" : "var(--ohmni-signal)",
                    }}
                  >
                    {isReset ? "RESET FAULT" : "OBSERVED"}
                  </span>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                  {getTypeIcon(record.type)}
                  <span className="metadata-text" style={{ fontSize: "10px", textTransform: "uppercase" }}>
                    {record.type.replace("_", " ")}
                  </span>
                </div>
              </div>

              {/* Summary Text */}
              <div
                style={{
                  fontSize: "12px",
                  fontWeight: 500,
                  color: "var(--ohmni-text-primary)",
                  lineHeight: 1.4,
                }}
              >
                {record.summary}
              </div>

              {/* Data Values Preview */}
              {record.data !== undefined && record.data !== null && typeof record.data === "object" && (
                <div
                  className="font-mono metadata-text"
                  style={{
                    background: "var(--ohmni-surface)",
                    padding: "4px 6px",
                    borderRadius: "var(--radius-xs)",
                    color: "var(--ohmni-text-secondary)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {JSON.stringify(record.data)}
                </div>
              )}
            </motion.div>
          );
        })
      )}
    </div>
  );
};
