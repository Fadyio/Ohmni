/**
 * Investigation Panel Component.
 * Right-side workspace housing the Immutable Evidence Ledger and Agent Hypothesis Synthesis.
 */

import React, { useState } from "react";
import { Layers } from "lucide-react";
import type { EvidenceStore } from "@/domain/evidence/store";
import type { HypothesisStore } from "@/domain/hypothesis/store";
import type { EvidenceRecord } from "@/domain/evidence/types";
import type { Hypothesis } from "@/domain/hypothesis/types";
import { useEvidenceStore } from "@/presentation/hooks/useEvidenceStore";
import { useHypothesisStore } from "@/presentation/hooks/useHypothesisStore";
import { HypothesisCard } from "./HypothesisCard";
import { EvidenceLedger } from "./EvidenceLedger";

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
  const [activeTab, setActiveTab] = useState<"hypotheses" | "evidence">("hypotheses");
  const { records } = useEvidenceStore(evidenceStore);
  const { hypotheses } = useHypothesisStore(hypothesisStore);

  return (
    <aside
      style={{
        display: "flex",
        flexDirection: "column",
        background: "var(--ohmni-surface)",
        borderLeft: "1px solid var(--ohmni-border)",
        height: "100%",
        overflow: "hidden",
      }}
    >
      {/* Panel Header */}
      <header
        style={{
          flex: "none",
          padding: "10px 14px",
          background: "var(--ohmni-surface-raised)",
          borderBottom: "1px solid var(--ohmni-border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <div
            style={{
              width: "24px",
              height: "24px",
              borderRadius: "var(--radius-sm)",
              background: "rgba(79, 107, 255, 0.15)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--ohmni-brand-hover)",
            }}
          >
            <Layers size={14} />
          </div>
          <span className="panel-heading" style={{ color: "var(--ohmni-text-primary)" }}>
            INVESTIGATION
          </span>
        </div>

        {/* Tab Toggle Buttons */}
        <div
          style={{
            display: "flex",
            background: "var(--ohmni-surface)",
            padding: "2px",
            borderRadius: "var(--radius-sm)",
            border: "1px solid var(--ohmni-border-subtle)",
          }}
        >
          <button
            onClick={() => setActiveTab("hypotheses")}
            style={{
              padding: "3px 10px",
              borderRadius: "var(--radius-xs)",
              border: "none",
              fontSize: "11px",
              fontWeight: 600,
              cursor: "pointer",
              background: activeTab === "hypotheses" ? "var(--ohmni-surface-raised)" : "transparent",
              color: activeTab === "hypotheses" ? "var(--ohmni-text-primary)" : "var(--ohmni-text-muted)",
              boxShadow: activeTab === "hypotheses" ? "0 1px 4px rgba(0,0,0,0.2)" : "none",
              transition: "all 0.15s ease",
            }}
          >
            Hypotheses ({hypotheses.length})
          </button>

          <button
            onClick={() => setActiveTab("evidence")}
            style={{
              padding: "3px 10px",
              borderRadius: "var(--radius-xs)",
              border: "none",
              fontSize: "11px",
              fontWeight: 600,
              cursor: "pointer",
              background: activeTab === "evidence" ? "var(--ohmni-surface-raised)" : "transparent",
              color: activeTab === "evidence" ? "var(--ohmni-text-primary)" : "var(--ohmni-text-muted)",
              boxShadow: activeTab === "evidence" ? "0 1px 4px rgba(0,0,0,0.2)" : "none",
              transition: "all 0.15s ease",
            }}
          >
            Evidence ({records.length})
          </button>
        </div>
      </header>

      {/* Tab Content */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "12px 14px",
          display: "flex",
          flexDirection: "column",
          gap: "10px",
        }}
      >
        {activeTab === "hypotheses" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {hypotheses.length === 0 ? (
              <div
                style={{
                  textAlign: "center",
                  padding: "2rem 1rem",
                  color: "var(--ohmni-text-muted)",
                  fontSize: "12px",
                  background: "var(--ohmni-surface-raised)",
                  borderRadius: "var(--radius-lg)",
                  border: "1px dashed var(--ohmni-border)",
                }}
              >
                No hypotheses formulated yet. The agent synthesizes grounded hypotheses from empirical evidence.
              </div>
            ) : (
              hypotheses.map((hypo) => (
                <HypothesisCard
                  key={hypo.id}
                  hypothesis={hypo}
                  isSelected={selectedHypothesisId === hypo.id}
                  onSelect={(h) => {
                    onSelectHypothesis?.(h);
                  }}
                  onSelectEvidenceId={(eid) => {
                    onSelectEvidence?.(records.find((r) => r.id === eid) ?? null);
                    setActiveTab("evidence");
                  }}
                />
              ))
            )}
          </div>
        ) : (
          <EvidenceLedger
            evidenceStore={evidenceStore}
            selectedEvidenceId={selectedEvidenceId}
            onSelectEvidence={onSelectEvidence}
            highlightedExperimentId={highlightedExperimentId}
            onHighlightExperiment={onHighlightExperiment}
          />
        )}
      </div>
    </aside>
  );
};
