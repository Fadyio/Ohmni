/**
 * Evidence Ledger Component.
 * Implements Milestone 5 Immutable Evidence Ledger.
 *
 * Visual Style: Lab notebook entries, flight-test observations, forensic artifacts.
 * Strict Invariant: Displays ONLY objective empirical facts ("WHAT HAPPENED").
 * NEVER displays interpretations, hypotheses, root causes, confidence levels, or fixes.
 */

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText,
  Activity,
  RotateCcw,
  Gauge,
  User,
  Cpu,
  Shield,
  Layers,
  ExternalLink,
} from "lucide-react";
import type { EvidenceRecord, EvidenceType, EvidenceSource } from "@/domain/evidence/types";
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
    case "reset_event":
      return <RotateCcw size={12} color="var(--ohmni-fault)" />;
    case "measurement":
      return <Gauge size={12} color="var(--ohmni-accent)" />;
    case "test_result":
      return <Activity size={12} color="var(--ohmni-warning)" />;
    case "human_observation":
      return <User size={12} color="var(--ohmni-warning)" />;
    case "device_state":
    case "configuration":
      return <Cpu size={12} color="var(--ohmni-text-secondary)" />;
    default:
      return <FileText size={12} color="var(--ohmni-text-muted)" />;
  }
}

function getTypeBadgeStyle(type: EvidenceType): { color: string; background: string; border: string } {
  switch (type) {
    case "reset_event":
      return {
        color: "var(--ohmni-fault)",
        background: "rgba(239, 68, 68, 0.12)",
        border: "1px solid rgba(239, 68, 68, 0.3)",
      };
    case "measurement":
      return {
        color: "var(--ohmni-accent)",
        background: "rgba(56, 189, 248, 0.12)",
        border: "1px solid rgba(56, 189, 248, 0.3)",
      };
    case "test_result":
      return {
        color: "var(--ohmni-warning)",
        background: "rgba(245, 158, 11, 0.12)",
        border: "1px solid rgba(245, 158, 11, 0.3)",
      };
    case "human_observation":
      return {
        color: "#f59e0b",
        background: "rgba(245, 158, 11, 0.15)",
        border: "1px solid rgba(245, 158, 11, 0.4)",
      };
    case "device_state":
    case "configuration":
    default:
      return {
        color: "var(--ohmni-text-secondary)",
        background: "rgba(148, 163, 184, 0.1)",
        border: "1px solid var(--ohmni-border)",
      };
  }
}

function getSourceBadge(source: EvidenceSource) {
  if (source === "human") {
    return (
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "3px",
          padding: "1px 5px",
          fontSize: "0.5625rem",
          fontWeight: 700,
          borderRadius: "3px",
          color: "#f59e0b",
          background: "rgba(245, 158, 11, 0.15)",
          border: "1px solid rgba(245, 158, 11, 0.3)",
          letterSpacing: "0.04em",
          textTransform: "uppercase",
        }}
      >
        <User size={9} />
        HUMAN
      </span>
    );
  }

  if (source === "device") {
    return (
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "3px",
          padding: "1px 5px",
          fontSize: "0.5625rem",
          fontWeight: 700,
          borderRadius: "3px",
          color: "var(--ohmni-accent)",
          background: "rgba(56, 189, 248, 0.12)",
          border: "1px solid rgba(56, 189, 248, 0.25)",
          letterSpacing: "0.04em",
          textTransform: "uppercase",
        }}
      >
        <Cpu size={9} />
        DEVICE
      </span>
    );
  }

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "3px",
        padding: "1px 5px",
        fontSize: "0.5625rem",
        fontWeight: 700,
        borderRadius: "3px",
        color: "var(--ohmni-text-secondary)",
        background: "rgba(148, 163, 184, 0.1)",
        border: "1px solid var(--ohmni-border)",
        letterSpacing: "0.04em",
        textTransform: "uppercase",
      }}
    >
      <Activity size={9} />
      EXP
    </span>
  );
}

export const EvidenceLedger: React.FC<EvidenceLedgerProps> = ({
  evidenceStore,
  selectedEvidenceId,
  onSelectEvidence,
  highlightedExperimentId,
  onHighlightExperiment,
}) => {
  const { records, count } = useEvidenceStore(evidenceStore);

  return (
    <aside
      style={{
        width: "320px",
        minWidth: "320px",
        background: "var(--ohmni-surface)",
        borderLeft: "1px solid var(--ohmni-border)",
        display: "flex",
        flexDirection: "column",
        height: "100%",
        overflow: "hidden",
      }}
    >
      {/* Panel Header */}
      <div
        style={{
          padding: "1rem 1rem 0.75rem 1rem",
          borderBottom: "1px solid var(--ohmni-border)",
          background: "var(--ohmni-surface-raised)",
          display: "flex",
          flexDirection: "column",
          gap: "0.5rem",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span className="label-technical" style={{ color: "var(--ohmni-text-primary)", fontWeight: 700 }}>
              INVESTIGATION
            </span>
            <span
              style={{
                fontSize: "0.625rem",
                color: "var(--ohmni-text-muted)",
                fontFamily: "var(--font-mono)",
              }}
            >
              /
            </span>
            <span className="label-technical" style={{ color: "var(--ohmni-accent)", letterSpacing: "0.06em" }}>
              EVIDENCE
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span
              className="font-mono"
              style={{
                fontSize: "0.6875rem",
                padding: "2px 6px",
                borderRadius: "var(--radius-sm)",
                background: count > 0 ? "rgba(56, 189, 248, 0.12)" : "rgba(148, 163, 184, 0.1)",
                color: count > 0 ? "var(--ohmni-accent)" : "var(--ohmni-text-muted)",
                border: count > 0 ? "1px solid rgba(56, 189, 248, 0.3)" : "1px solid var(--ohmni-border)",
                fontWeight: 600,
              }}
            >
              {count} {count === 1 ? "FACT" : "FACTS"}
            </span>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "4px",
              fontSize: "0.625rem",
              color: "var(--ohmni-text-muted)",
              fontFamily: "var(--font-mono)",
            }}
          >
            <Shield size={10} color="var(--ohmni-text-muted)" />
            <span>IMMUTABLE LEDGER</span>
          </div>
          <span
            style={{
              fontSize: "0.5625rem",
              color: "var(--ohmni-text-disabled)",
              fontFamily: "var(--font-mono)",
              letterSpacing: "0.02em",
            }}
          >
            E-001..E-999
          </span>
        </div>
      </div>

      {/* Main Ledger Content List */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "0.75rem",
          display: "flex",
          flexDirection: "column",
          gap: "0.5rem",
        }}
      >
        {count === 0 ? (
          /* Empty Standby State */
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              textAlign: "center",
              padding: "2rem 1rem",
              background: "rgba(14, 18, 23, 0.6)",
              borderRadius: "var(--radius-md)",
              border: "1px dashed var(--ohmni-border)",
              marginTop: "0.5rem",
            }}
          >
            <div
              style={{
                width: "48px",
                height: "48px",
                borderRadius: "50%",
                background: "rgba(30, 38, 51, 0.6)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: "0.875rem",
                border: "1px solid var(--ohmni-border)",
              }}
            >
              <Layers size={22} color="var(--ohmni-text-muted)" style={{ opacity: 0.8 }} />
            </div>

            <div
              className="label-technical"
              style={{
                color: "var(--ohmni-text-secondary)",
                marginBottom: "0.375rem",
                fontSize: "0.6875rem",
              }}
            >
              NO EVIDENCE RECORDED YET
            </div>

            <p
              style={{
                fontSize: "0.6875rem",
                lineHeight: 1.4,
                color: "var(--ohmni-text-muted)",
                margin: "0 0 1rem 0",
                maxWidth: "240px",
              }}
            >
              Diagnostic experiments and human physical inspections automatically record empirical observations here.
            </p>

            <div
              style={{
                padding: "6px 10px",
                background: "rgba(20, 25, 34, 0.8)",
                borderRadius: "var(--radius-sm)",
                border: "1px solid var(--ohmni-border-subtle)",
                fontSize: "0.625rem",
                color: "var(--ohmni-text-disabled)",
                fontFamily: "var(--font-mono)",
                textAlign: "left",
                width: "100%",
                maxWidth: "240px",
              }}
            >
              <div style={{ color: "var(--ohmni-text-muted)", marginBottom: "2px", fontWeight: 600 }}>
                WEBMCP AGENT SURFACE:
              </div>
              <div>• list_evidence (read-only)</div>
              <div>• get_evidence (read-only)</div>
            </div>
          </div>
        ) : (
          /* Sequential Evidence Cards */
          <AnimatePresence initial={false}>
            {records.map((record, index) => {
              const isSelected = selectedEvidenceId === record.id;
              const isExpHighlighted =
                Boolean(highlightedExperimentId) &&
                Boolean(record.experimentId) &&
                record.experimentId === highlightedExperimentId;

              const badgeStyle = getTypeBadgeStyle(record.type);

              return (
                <motion.div
                  key={record.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{
                    duration: 0.16,
                    delay: Math.min(index * 0.04, 0.2),
                    ease: "easeOut",
                  }}
                  onClick={() => {
                    if (onSelectEvidence) {
                      onSelectEvidence(isSelected ? null : record);
                    }
                    if (onHighlightExperiment && record.experimentId) {
                      onHighlightExperiment(isExpHighlighted ? null : record.experimentId);
                    }
                  }}
                  style={{
                    background: isSelected
                      ? "var(--ohmni-surface-overlay)"
                      : isExpHighlighted
                      ? "rgba(56, 189, 248, 0.08)"
                      : "var(--ohmni-surface-raised)",
                    border: isSelected
                      ? "1px solid var(--ohmni-accent)"
                      : isExpHighlighted
                      ? "1px solid var(--ohmni-border-accent)"
                      : "1px solid var(--ohmni-border)",
                    borderRadius: "var(--radius-md)",
                    padding: "0.75rem",
                    cursor: "pointer",
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.5rem",
                    transition: "border-color 140ms ease, background 140ms ease",
                    boxShadow: isSelected ? "0 0 12px rgba(56, 189, 248, 0.15)" : "none",
                  }}
                >
                  {/* Card Top Row: ID, Type Badge, Source */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <span
                        className="font-mono"
                        style={{
                          fontSize: "0.75rem",
                          fontWeight: 700,
                          color: isSelected ? "var(--ohmni-accent)" : "var(--ohmni-text-primary)",
                          letterSpacing: "0.04em",
                        }}
                      >
                        {record.id}
                      </span>

                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "3px",
                          padding: "1px 5px",
                          fontSize: "0.5625rem",
                          fontWeight: 600,
                          borderRadius: "var(--radius-sm)",
                          letterSpacing: "0.02em",
                          textTransform: "uppercase",
                          ...badgeStyle,
                        }}
                      >
                        {getTypeIcon(record.type)}
                        {record.type.replace("_", " ")}
                      </span>
                    </div>

                    <div>{getSourceBadge(record.source)}</div>
                  </div>

                  {/* Factual Summary */}
                  <div
                    style={{
                      fontSize: "0.75rem",
                      fontWeight: 600,
                      color: "var(--ohmni-text-primary)",
                      lineHeight: 1.35,
                      fontFamily: "var(--font-sans)",
                    }}
                  >
                    {record.summary}
                  </div>

                  {/* Metadata / Provenance Footer */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      fontSize: "0.625rem",
                      color: "var(--ohmni-text-muted)",
                      fontFamily: "var(--font-mono)",
                      borderTop: "1px solid var(--ohmni-border-subtle)",
                      paddingTop: "0.375rem",
                      marginTop: "0.125rem",
                    }}
                  >
                    {record.experimentId ? (
                      <span
                        title={`Correlated Experiment: ${record.experimentId}`}
                        style={{
                          color: isExpHighlighted ? "var(--ohmni-accent)" : "var(--ohmni-text-muted)",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "3px",
                          textDecoration: "none",
                        }}
                      >
                        <ExternalLink size={9} />
                        {record.experimentId.length > 16
                          ? `${record.experimentId.slice(0, 8)}...${record.experimentId.slice(-4)}`
                          : record.experimentId}
                      </span>
                    ) : (
                      <span>{record.provenance.origin}</span>
                    )}

                    <span>
                      {record.sourceTool ? record.sourceTool.replace("run_", "").replace("read_", "") : "manual"}
                    </span>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>
    </aside>
  );
};
