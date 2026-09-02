/**
 * Investigation Panel Component (Milestone 6).
 * Combines Active Hypotheses (interpretations: "WHAT MIGHT EXPLAIN IT")
 * and Immutable Evidence Ledger (facts: "WHAT HAPPENED") in a unified,
 * two-layered forensic diagnostic workspace.
 *
 * Core Principles:
 * 1. Evidence is the foundation — factual, objective, untamperable.
 * 2. Hypotheses are agent- and human-authored interpretations that link and cite evidence.
 * 3. Bidirectional interactive highlighting:
 *    - Selecting a hypothesis highlights its supporting and contradicting evidence cards.
 *    - Selecting an evidence record highlights hypotheses that cite it.
 * 4. Strictly NO fake initial hypotheses seeded from simulator knowledge.
 */

import React, { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Lightbulb,
  Shield,
  Layers,
  FileText,
  Activity,
  RotateCcw,
  Gauge,
  User,
  Cpu,
  ExternalLink,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import type { EvidenceRecord, EvidenceType, EvidenceSource } from "@/domain/evidence/types";
import type { EvidenceStore } from "@/domain/evidence/store";
import type { Hypothesis, HypothesisStatus } from "@/domain/hypothesis/types";
import type { HypothesisStore } from "@/domain/hypothesis/store";
import { useEvidenceStore } from "@/presentation/hooks/useEvidenceStore";
import { useHypothesisStore } from "@/presentation/hooks/useHypothesisStore";
import { HypothesisCard } from "./HypothesisCard";

export interface InvestigationPanelProps {
  readonly evidenceStore?: EvidenceStore;
  readonly hypothesisStore?: HypothesisStore;
  readonly selectedEvidenceId?: string | null;
  readonly onSelectEvidence?: (record: EvidenceRecord | null) => void;
  readonly selectedHypothesisId?: string | null;
  readonly onSelectHypothesis?: (hypothesis: Hypothesis | null) => void;
  readonly highlightedExperimentId?: string | null;
  readonly onHighlightExperiment?: (experimentId: string | null) => void;
}

function getTypeIcon(type: EvidenceType) {
  switch (type) {
    case "reset_event":
      return <RotateCcw size={12} />;
    case "measurement":
      return <Activity size={12} />;
    case "test_result":
      return <Gauge size={12} />;
    case "human_observation":
      return <User size={12} />;
    case "device_state":
    case "configuration":
    default:
      return <FileText size={12} />;
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
        color: "#c084fc",
        background: "rgba(192, 132, 252, 0.12)",
        border: "1px solid rgba(192, 132, 252, 0.3)",
      };
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
          fontSize: "0.5625rem",
          padding: "1px 5px",
          borderRadius: "var(--radius-sm)",
          background: "rgba(192, 132, 252, 0.15)",
          color: "#c084fc",
          border: "1px solid rgba(192, 132, 252, 0.3)",
          fontWeight: 600,
        }}
      >
        <User size={9} />
        HUMAN
      </span>
    );
  }

  if (source === "experiment") {
    return (
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "3px",
          fontSize: "0.5625rem",
          padding: "1px 5px",
          borderRadius: "var(--radius-sm)",
          background: "rgba(56, 189, 248, 0.12)",
          color: "var(--ohmni-accent)",
          border: "1px solid rgba(56, 189, 248, 0.25)",
          fontWeight: 600,
        }}
      >
        <Activity size={9} />
        EXPERIMENT
      </span>
    );
  }

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
        color: "var(--ohmni-text-muted)",
        border: "1px solid var(--ohmni-border)",
        fontWeight: 600,
      }}
    >
      <Cpu size={9} />
      DEVICE
    </span>
  );
}

export const InvestigationPanel: React.FC<InvestigationPanelProps> = ({
  evidenceStore,
  hypothesisStore,
  selectedEvidenceId,
  onSelectEvidence,
  selectedHypothesisId,
  onSelectHypothesis,
  highlightedExperimentId,
  onHighlightExperiment,
}) => {
  const { records: evidenceRecords, count: evidenceCount } = useEvidenceStore(evidenceStore);
  const { hypotheses, activeHypotheses, rejectedHypotheses, count: hypothesisCount } = useHypothesisStore(hypothesisStore);

  // Selected hypothesis object
  const activeSelectedHypothesis = useMemo(() => {
    if (!selectedHypothesisId) return null;
    return hypotheses.find((h) => h.id === selectedHypothesisId) || null;
  }, [selectedHypothesisId, hypotheses]);

  // Set of evidence IDs referenced by selected hypothesis
  const supportingEvidenceSet = useMemo(() => {
    if (!activeSelectedHypothesis) return new Set<string>();
    return new Set(activeSelectedHypothesis.supportingEvidenceIds);
  }, [activeSelectedHypothesis]);

  const contradictingEvidenceSet = useMemo(() => {
    if (!activeSelectedHypothesis) return new Set<string>();
    return new Set(activeSelectedHypothesis.contradictingEvidenceIds);
  }, [activeSelectedHypothesis]);

  // Set of hypothesis IDs citing the selected evidence
  const hypothesesCitingSelectedEvidence = useMemo(() => {
    if (!selectedEvidenceId) return new Set<string>();
    const set = new Set<string>();
    for (const h of hypotheses) {
      if (
        h.supportingEvidenceIds.includes(selectedEvidenceId) ||
        h.contradictingEvidenceIds.includes(selectedEvidenceId)
      ) {
        set.add(h.id);
      }
    }
    return set;
  }, [selectedEvidenceId, hypotheses]);

  const handleHypothesisClick = (h: Hypothesis) => {
    if (selectedHypothesisId === h.id) {
      onSelectHypothesis?.(null);
    } else {
      onSelectHypothesis?.(h);
    }
  };

  const handleEvidenceClick = (r: EvidenceRecord) => {
    if (selectedEvidenceId === r.id) {
      onSelectEvidence?.(null);
      onHighlightExperiment?.(null);
    } else {
      onSelectEvidence?.(r);
      onHighlightExperiment?.(r.experimentId ?? null);
    }
  };

  const handleSelectEvidenceIdFromHypothesis = (evidenceId: string) => {
    const record = evidenceRecords.find((r) => r.id === evidenceId);
    if (record) {
      onSelectEvidence?.(record);
      onHighlightExperiment?.(record.experimentId ?? null);
    }
  };

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
      {/* 1. Main Investigation Panel Header */}
      <div
        style={{
          padding: "0.875rem 1rem 0.625rem 1rem",
          borderBottom: "1px solid var(--ohmni-border)",
          background: "var(--ohmni-surface-raised)",
          display: "flex",
          flexDirection: "column",
          gap: "0.375rem",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span className="label-technical" style={{ color: "var(--ohmni-text-primary)", fontWeight: 700 }}>
              INVESTIGATION
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span
              className="font-mono"
              style={{
                fontSize: "0.625rem",
                padding: "2px 5px",
                borderRadius: "var(--radius-sm)",
                background: hypothesisCount > 0 ? "rgba(56, 189, 248, 0.15)" : "rgba(148, 163, 184, 0.08)",
                color: hypothesisCount > 0 ? "var(--ohmni-accent)" : "var(--ohmni-text-muted)",
                border: hypothesisCount > 0 ? "1px solid rgba(56, 189, 248, 0.3)" : "1px solid var(--ohmni-border)",
                fontWeight: 600,
              }}
            >
              {hypothesisCount} {hypothesisCount === 1 ? "HYPOTHESIS" : "HYPOTHESES"}
            </span>
            <span
              className="font-mono"
              style={{
                fontSize: "0.625rem",
                padding: "2px 5px",
                borderRadius: "var(--radius-sm)",
                background: evidenceCount > 0 ? "rgba(16, 185, 129, 0.12)" : "rgba(148, 163, 184, 0.08)",
                color: evidenceCount > 0 ? "#10b981" : "var(--ohmni-text-muted)",
                border: evidenceCount > 0 ? "1px solid rgba(16, 185, 129, 0.3)" : "1px solid var(--ohmni-border)",
                fontWeight: 600,
              }}
            >
              {evidenceCount} {evidenceCount === 1 ? "FACT" : "FACTS"}
            </span>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "4px",
              fontSize: "0.59375rem",
              color: "var(--ohmni-text-muted)",
              fontFamily: "var(--font-mono)",
            }}
          >
            <Shield size={10} color="var(--ohmni-text-muted)" />
            <span>HYPOTHESES &amp; EVIDENCE GRAPH</span>
          </div>
          <span
            style={{
              fontSize: "0.5625rem",
              color: "var(--ohmni-text-disabled)",
              fontFamily: "var(--font-mono)",
            }}
          >
            H-xxx / E-xxx
          </span>
        </div>
      </div>

      {/* 2. Top Tier: ACTIVE HYPOTHESES ("WHAT MIGHT EXPLAIN IT?") */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          maxHeight: "45%",
          minHeight: "140px",
          borderBottom: "1px solid var(--ohmni-border)",
          background: "var(--ohmni-surface)",
          flexShrink: 0,
        }}
      >
        {/* Section Header */}
        <div
          style={{
            padding: "0.5rem 1rem",
            background: "rgba(20, 25, 34, 0.6)",
            borderBottom: "1px solid var(--ohmni-border-subtle)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <Lightbulb size={12} color="var(--ohmni-accent)" />
            <span
              className="label-technical"
              style={{
                fontSize: "0.65625rem",
                color: "var(--ohmni-text-primary)",
                fontWeight: 700,
                letterSpacing: "0.06em",
              }}
            >
              ACTIVE HYPOTHESES
            </span>
          </div>

          <span
            className="font-mono"
            style={{
              fontSize: "0.59375rem",
              color: "var(--ohmni-text-muted)",
            }}
          >
            {activeHypotheses.length} ACTIVE
          </span>
        </div>

        {/* Hypotheses Content List */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "0.625rem 0.75rem",
            display: "flex",
            flexDirection: "column",
            gap: "0.5rem",
          }}
        >
          {hypotheses.length === 0 ? (
            /* Empty State: Strictly NO seeded fake hypotheses */
            <div
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                textAlign: "center",
                padding: "1rem 0.5rem",
                borderRadius: "var(--radius-md)",
                border: "1px dashed var(--ohmni-border-subtle)",
                background: "rgba(14, 18, 23, 0.4)",
              }}
            >
              <Lightbulb size={18} color="var(--ohmni-text-muted)" style={{ opacity: 0.5, marginBottom: "0.375rem" }} />
              <div
                className="label-technical"
                style={{
                  color: "var(--ohmni-text-secondary)",
                  fontSize: "0.65625rem",
                  marginBottom: "0.25rem",
                }}
              >
                NO HYPOTHESES PROPOSED YET
              </div>
              <p
                style={{
                  fontSize: "0.625rem",
                  color: "var(--ohmni-text-muted)",
                  margin: 0,
                  maxWidth: "220px",
                  lineHeight: 1.35,
                }}
              >
                Diagnostic interpretations are synthesized by agents via WebMCP based on factual evidence.
              </p>
            </div>
          ) : (
            <AnimatePresence initial={false}>
              {hypotheses.map((h) => (
                <HypothesisCard
                  key={h.id}
                  hypothesis={h}
                  isSelected={selectedHypothesisId === h.id}
                  onSelect={handleHypothesisClick}
                  onSelectEvidenceId={handleSelectEvidenceIdFromHypothesis}
                  isReferencedBySelectedEvidence={hypothesesCitingSelectedEvidence.has(h.id)}
                />
              ))}
            </AnimatePresence>
          )}
        </div>
      </div>

      {/* 3. Bottom Tier: EVIDENCE LEDGER ("WHAT HAPPENED?") */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          minHeight: 0,
          background: "var(--ohmni-surface)",
        }}
      >
        {/* Section Header */}
        <div
          style={{
            padding: "0.5rem 1rem",
            background: "rgba(20, 25, 34, 0.6)",
            borderBottom: "1px solid var(--ohmni-border-subtle)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <Layers size={12} color="var(--ohmni-text-muted)" />
            <span
              className="label-technical"
              style={{
                fontSize: "0.65625rem",
                color: "var(--ohmni-text-primary)",
                fontWeight: 700,
                letterSpacing: "0.06em",
              }}
            >
              EVIDENCE LEDGER
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <span
              style={{
                fontSize: "0.5625rem",
                color: "var(--ohmni-text-disabled)",
                fontFamily: "var(--font-mono)",
              }}
            >
              IMMUTABLE FACTS
            </span>
          </div>
        </div>

        {/* Evidence Content List */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "0.625rem 0.75rem",
            display: "flex",
            flexDirection: "column",
            gap: "0.5rem",
          }}
        >
          {evidenceCount === 0 ? (
            /* Standby State */
            <div
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                textAlign: "center",
                padding: "1.5rem 0.75rem",
                borderRadius: "var(--radius-md)",
                border: "1px dashed var(--ohmni-border-subtle)",
                background: "rgba(14, 18, 23, 0.4)",
              }}
            >
              <Shield size={20} color="var(--ohmni-text-muted)" style={{ opacity: 0.5, marginBottom: "0.5rem" }} />
              <div
                className="label-technical"
                style={{
                  color: "var(--ohmni-text-secondary)",
                  fontSize: "0.65625rem",
                  marginBottom: "0.25rem",
                }}
              >
                NO EVIDENCE RECORDED YET
              </div>
              <p
                style={{
                  fontSize: "0.625rem",
                  color: "var(--ohmni-text-muted)",
                  margin: 0,
                  maxWidth: "220px",
                  lineHeight: 1.35,
                }}
              >
                Diagnostic experiments and human physical inspections automatically record empirical observations here.
              </p>
            </div>
          ) : (
            <AnimatePresence initial={false}>
              {evidenceRecords.map((record) => {
                const isSelected = selectedEvidenceId === record.id;
                const isSupports = supportingEvidenceSet.has(record.id);
                const isContradicts = contradictingEvidenceSet.has(record.id);
                const isExpHighlighted =
                  Boolean(highlightedExperimentId) &&
                  Boolean(record.experimentId) &&
                  record.experimentId === highlightedExperimentId;

                const badgeStyle = getTypeBadgeStyle(record.type);

                return (
                  <motion.div
                    key={record.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.96 }}
                    transition={{ duration: 0.18 }}
                    onClick={() => handleEvidenceClick(record)}
                    style={{
                      padding: "0.625rem 0.75rem",
                      borderRadius: "var(--radius-md)",
                      background: isSelected
                        ? "rgba(56, 189, 248, 0.08)"
                        : isSupports
                          ? "rgba(16, 185, 129, 0.08)"
                          : isContradicts
                            ? "rgba(239, 68, 68, 0.08)"
                            : isExpHighlighted
                              ? "rgba(245, 158, 11, 0.06)"
                              : "var(--ohmni-surface-raised)",
                      border: isSelected
                        ? "1px solid var(--ohmni-accent)"
                        : isSupports
                          ? "1px solid #10b981"
                          : isContradicts
                            ? "1px solid #ef4444"
                            : isExpHighlighted
                              ? "1px solid var(--ohmni-warning)"
                              : "1px solid var(--ohmni-border)",
                      boxShadow: isSelected
                        ? "0 0 10px rgba(56, 189, 248, 0.15)"
                        : isSupports
                          ? "0 0 10px rgba(16, 185, 129, 0.15)"
                          : isContradicts
                            ? "0 0 10px rgba(239, 68, 68, 0.15)"
                            : "none",
                      cursor: "pointer",
                      display: "flex",
                      flexDirection: "column",
                      gap: "0.375rem",
                      transition: "all var(--duration-micro) ease",
                    }}
                  >
                    {/* Relationship callout if active hypothesis selected */}
                    {isSupports && (
                      <div
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                          fontSize: "0.5625rem",
                          fontWeight: 700,
                          color: "#10b981",
                          fontFamily: "var(--font-mono)",
                          letterSpacing: "0.04em",
                        }}
                      >
                        <span>✓ SUPPORTS {activeSelectedHypothesis?.id}</span>
                      </div>
                    )}
                    {isContradicts && (
                      <div
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                          fontSize: "0.5625rem",
                          fontWeight: 700,
                          color: "#ef4444",
                          fontFamily: "var(--font-mono)",
                          letterSpacing: "0.04em",
                        }}
                      >
                        <span>✗ CONTRADICTS {activeSelectedHypothesis?.id}</span>
                      </div>
                    )}

                    {/* Header: ID, Type Badge, Source Badge */}
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
                          {record.id}
                        </span>

                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "3px",
                            fontSize: "0.5625rem",
                            padding: "1px 5px",
                            borderRadius: "var(--radius-sm)",
                            background: badgeStyle.background,
                            color: badgeStyle.color,
                            border: badgeStyle.border,
                            fontWeight: 600,
                            letterSpacing: "0.02em",
                          }}
                        >
                          {getTypeIcon(record.type)}
                          {record.type.toUpperCase().replace("_", " ")}
                        </span>
                      </div>

                      {getSourceBadge(record.source)}
                    </div>

                    {/* Factual Summary */}
                    <p
                      style={{
                        margin: 0,
                        fontSize: "0.71875rem",
                        lineHeight: 1.38,
                        color: "var(--ohmni-text-primary)",
                      }}
                    >
                      {record.summary}
                    </p>

                    {/* Provenance Footer */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        fontSize: "0.59375rem",
                        color: "var(--ohmni-text-disabled)",
                        fontFamily: "var(--font-mono)",
                        paddingTop: "2px",
                      }}
                    >
                      <span>
                        {record.provenance.toolName || record.provenance.capability || record.provenance.origin}
                      </span>
                      {record.experimentId && (
                        <span style={{ color: "var(--ohmni-text-muted)" }}>
                          {record.experimentId}
                        </span>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          )}
        </div>
      </div>
    </aside>
  );
};
