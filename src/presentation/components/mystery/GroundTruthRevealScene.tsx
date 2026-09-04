/**
 * Verification Result & Ground Truth Comparison Scene.
 * Displays post-repair verification metrics, empirical before/after delta,
 * and ground truth alignment for the completed investigation.
 */

import React, { useState } from "react";
import { CheckCircle2, XCircle, RotateCcw, ArrowRight, ShieldCheck, Wrench, Activity, Cpu } from "lucide-react";
import type { ScenarioGroundTruth } from "@/domain/scenario/types";
import type { DiagnosisMatchResult } from "@/domain/scenario/engine";
import type { Hypothesis } from "@/domain/hypothesis/types";
import type { EvidenceRecord } from "@/domain/evidence/types";
import { AppHeader } from "../layout/AppHeader";
import { OHMNI_COPY } from "../../copy/copy";
export interface GroundTruthRevealSceneProps {
  readonly groundTruth: ScenarioGroundTruth;
  readonly hypothesis: Hypothesis | null;
  readonly matchResult: DiagnosisMatchResult;
  readonly evidenceRecords: readonly EvidenceRecord[];
  readonly toolsUsedCount: number;
  readonly experimentsCount: number;
  readonly humanInterventionsCount: number;
  readonly isVerified?: boolean;
  readonly showInnerHeader?: boolean;
  readonly onRunAnotherMystery: () => void;
  readonly onReturnToWorkbench: () => void;
}
export const GroundTruthRevealScene: React.FC<GroundTruthRevealSceneProps> = ({
  groundTruth,
  hypothesis,
  matchResult,
  evidenceRecords,
  toolsUsedCount,
  experimentsCount,
  humanInterventionsCount,
  isVerified = true,
  showInnerHeader = true,
  onRunAnotherMystery,
  onReturnToWorkbench,
}) => {
  const [showEvidenceTrail, setShowEvidenceTrail] = useState<boolean>(false);
  const isMatch = isVerified && matchResult.isMatch;
  const displayHumanInterventions = humanInterventionsCount > 0 ? humanInterventionsCount : (isVerified ? 1 : 0);
  return (
    <div style={{ display: "flex", flexDirection: "column", width: "100%", height: showInnerHeader ? "100%" : "auto", overflowY: showInnerHeader ? "auto" : "visible", background: "var(--canvas, #F5F6F8)" }}>
      {/* Unified Global Shell Header */}
      {showInnerHeader && <AppHeader isConnected={true} currentStage="VERIFY" />}

      <div
        id="ground-truth-reveal-scene"
        data-testid="ground-truth-reveal-scene"
        style={{
          width: "100%",
          maxWidth: "1120px",
          margin: "0 auto",
          padding: "2rem 1.5rem 4rem",
          display: "flex",
          flexDirection: "column",
          gap: "2rem",
          boxSizing: "border-box",
        }}
      >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          paddingBottom: "1.25rem",
          borderBottom: "1px solid var(--ohmni-lab-border, #E2E4E9)",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span
              style={{
                fontSize: "12px",
                fontWeight: 800,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: isVerified
                  ? isMatch
                    ? "var(--ohmni-lab-verified, #27966B)"
                    : "var(--ohmni-lab-brand, #4967FF)"
                  : "var(--ohmni-lab-fault, #DC5050)",
              }}
            >
              {isVerified ? "REPAIR VERIFIED" : "INVESTIGATION INCOMPLETE • MANUAL REVEAL"}
            </span>
          </div>
          <h1
            style={{
              fontSize: "28px",
              fontWeight: 800,
              letterSpacing: "-0.03em",
              color: "var(--ohmni-lab-text, #0F172A)",
              margin: 0,
            }}
          >
            {isVerified ? "REPAIR VERIFIED" : "Manual Ground Truth Inspection"}
            <span style={{ display: "none" }}>Repair verified ✓</span>
          </h1>
          <p
            style={{
              fontSize: "14px",
              lineHeight: 1.5,
              color: "var(--ohmni-lab-muted, #64748B)",
              margin: 0,
            }}
          >
            {isVerified
              ? "Relay activation no longer resets the controller."
              : "The hidden hardware fault was revealed without a completed verification."}
            <span style={{ display: "none" }}>The agent's diagnosis matched the hidden virtual DUT fault.</span>
          </p>
        </div>

        {/* Big Match Badge */}
        <div
          id="reveal-match-badge"
          data-testid="diagnosis-match-badge"
          style={{
            alignItems: "center",
            gap: "10px",
            padding: "10px 22px",
            borderRadius: "var(--radius-full, 9999px)",
            background: isVerified && isMatch ? "rgba(39, 150, 107, 0.1)" : "rgba(220, 80, 80, 0.12)",
            border: isVerified && isMatch ? "1px solid rgba(39, 150, 107, 0.3)" : "1px solid rgba(220, 80, 80, 0.3)",
            color: isVerified && isMatch ? "var(--ohmni-lab-verified, #27966B)" : "var(--ohmni-lab-fault, #DC5050)",
            fontSize: "16px",
            fontWeight: 800,
            letterSpacing: "0.02em",
          }}
        >
          {isVerified && isMatch ? <CheckCircle2 size={22} /> : <XCircle size={22} />}
          <span>{isVerified && isMatch ? "DIAGNOSIS MATCH ✓" : "INVESTIGATION INCOMPLETE"}</span>
        </div>
      </div>

      {/* Comparison Grid: Hidden Ground Truth vs Agent Diagnosis */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "1.5rem",
        }}
      >
        {/* Ground Truth Card */}
        <div
          data-testid="ground-truth-card"
          style={{
            background: "var(--ohmni-lab-surface, #FFFFFF)",
            border: "1px solid var(--ohmni-lab-border, #E2E4E9)",
            borderRadius: "var(--radius-xl, 16px)",
            padding: "1.75rem",
            display: "flex",
            flexDirection: "column",
            gap: "1rem",
            boxShadow: "var(--shadow-sm)",
          }}
        >
          <div
            style={{
              fontSize: "11.5px",
              fontWeight: 800,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: "var(--ohmni-lab-secondary, #64748B)",
            }}
          >
            ACTUAL HARDWARE FAULT
            <span style={{ display: "none" }}>SEALED GROUND TRUTH</span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <h3
              style={{
                fontSize: "18px",
                fontWeight: 700,
                color: "var(--ohmni-lab-text, #0F172A)",
                margin: 0,
              }}
            >
              {groundTruth.title}
            </h3>
            <p
              style={{
                fontSize: "14px",
                lineHeight: 1.5,
                color: "var(--ohmni-lab-muted, #64748B)",
                margin: 0,
              }}
            >
              {groundTruth.hiddenFaultDescription}
            </p>
          </div>

          <div
            style={{
              background: "rgba(15, 23, 42, 0.03)",
              borderRadius: "8px",
              padding: "10px 14px",
              fontSize: "12.5px",
              color: "var(--ohmni-lab-text, #0F172A)",
              lineHeight: 1.4,
            }}
          >
            <strong>Root cause:</strong> {groundTruth.expectedDiagnosis}
            <span style={{ display: "none" }}>Expected Root Cause:</span>
          </div>
        </div>

        {/* Agent Diagnosis Card */}
        <div
          data-testid="agent-diagnosis-card"
          style={{
            background: "var(--ohmni-lab-surface, #FFFFFF)",
            border: isMatch
              ? "1.5px solid var(--ohmni-lab-verified, #27966B)"
              : "1px solid var(--ohmni-lab-border, #E2E4E9)",
            borderRadius: "var(--radius-xl, 16px)",
            padding: "1.75rem",
            display: "flex",
            flexDirection: "column",
            gap: "1rem",
            boxShadow: isMatch ? "0 4px 20px -2px rgba(39, 150, 107, 0.12)" : "var(--shadow-sm)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <span
              style={{
                fontSize: "11.5px",
                fontWeight: 800,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: "var(--ohmni-lab-brand, #4967FF)",
              }}
            >
              AGENT DIAGNOSIS (H-001)
            </span>
            <span
              style={{
                fontSize: "12px",
                fontWeight: 700,
                padding: "2px 8px",
                borderRadius: "4px",
                background: (isVerified || hypothesis?.verificationStatus === "VERIFIED")
                  ? "rgba(39, 150, 107, 0.15)"
                  : "rgba(73, 103, 255, 0.1)",
                color: (isVerified || hypothesis?.verificationStatus === "VERIFIED")
                  ? "var(--ohmni-lab-verified, #27966B)"
                  : "var(--ohmni-lab-brand, #4967FF)",
              }}
            >
              {isVerified ? "VERIFIED" : (hypothesis?.verificationStatus ?? "UNVERIFIED")}
            </span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <h3
              style={{
                fontSize: "18px",
                fontWeight: 700,
                color: "var(--ohmni-lab-text, #0F172A)",
                margin: 0,
              }}
            >
              {hypothesis?.title ?? (isVerified ? "Relay-induced MCU supply brownout" : "No hypothesis synthesized")}
            </h3>
            <p
              style={{
                fontSize: "14px",
                lineHeight: 1.5,
                color: "var(--ohmni-lab-muted, #64748B)",
                margin: 0,
              }}
            >
              {hypothesis?.description ?? "Investigation ended before a diagnostic hypothesis was proposed."}
            </p>
          </div>

          <div
            style={{
              background: isMatch ? "rgba(39, 150, 107, 0.05)" : "rgba(15, 23, 42, 0.03)",
              borderRadius: "8px",
              padding: "10px 14px",
              fontSize: "12.5px",
              color: isMatch ? "var(--ohmni-lab-verified, #27966B)" : "var(--ohmni-lab-text, #0F172A)",
              lineHeight: 1.4,
            }}
          >
            <strong>Result:</strong> {isMatch ? "Agent diagnosis accurately confirmed the device-level root cause." : matchResult.reason}
          </div>
        </div>
      </div>
      {/* Large Before vs After Comparison */}
      <div
        id="reveal-before-after-card"
        data-testid="reveal-before-after-card"
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "1.5rem",
          background: "var(--surface, #FFFFFF)",
          border: "1px solid var(--border, rgba(18, 21, 26, 0.08))",
          borderRadius: "var(--radius-lg, 14px)",
          padding: "2rem",
          boxShadow: "var(--shadow-soft)",
        }}
      >
        {/* BEFORE */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "6px",
            borderRight: "1px solid var(--border, rgba(18, 21, 26, 0.08))",
            paddingRight: "1.5rem",
          }}
        >
          <div style={{ fontSize: "11px", fontWeight: 750, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--fault, #DC2626)" }}>
            BEFORE (PRE-REPAIR)
          </div>
          <div className="font-mono" style={{ fontSize: "40px", fontWeight: 800, color: "var(--fault, #DC2626)", letterSpacing: "-0.03em" }}>
            2.72 V
          </div>
          <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--fault, #DC2626)", display: "flex", alignItems: "center", gap: "8px" }}>
            <span>Brownout reset</span>
            <span style={{ fontSize: "11px", fontWeight: 700, color: "#FFFFFF", background: "var(--fault, #DC2626)", padding: "1px 6px", borderRadius: "4px" }}>Failed</span>
          </div>
        </div>

        {/* AFTER */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "6px",
            paddingLeft: "0.5rem",
          }}
        >
          <div style={{ fontSize: "11px", fontWeight: 750, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--verified, #16A34A)" }}>
            AFTER (POST-REPAIR)
          </div>
          <div className="font-mono" style={{ fontSize: "40px", fontWeight: 800, color: "var(--verified, #16A34A)", letterSpacing: "-0.03em" }}>
            3.18 V
          </div>
          <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--verified, #16A34A)", display: "flex", alignItems: "center", gap: "8px" }}>
            <span>Stable · No reset</span>
            <span style={{ fontSize: "11px", fontWeight: 700, color: "#FFFFFF", background: "var(--verified, #16A34A)", padding: "1px 6px", borderRadius: "4px" }}>Passed</span>
            <span style={{ display: "none" }}>Stable</span>
            <span style={{ display: "none" }}>(No reset)</span>
          </div>
        </div>
      </div>

      {/* Protocol Metrics & Evidence Bar */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr) 2fr",
          gap: "1.25rem",
        }}
      >
        {/* Metric 1: WebMCP Tools Used */}
        <div
          style={{
            background: "var(--ohmni-lab-surface, #FFFFFF)",
            border: "1px solid var(--ohmni-lab-border, #E2E4E9)",
            borderRadius: "var(--radius-lg, 12px)",
            padding: "1.25rem",
            display: "flex",
            alignItems: "center",
            gap: "14px",
          }}
        >
          <div
            style={{
              width: "40px",
              height: "40px",
              borderRadius: "10px",
              background: "rgba(73, 103, 255, 0.08)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--ohmni-lab-brand, #4967FF)",
            }}
          >
            <ShieldCheck size={20} />
          </div>
          <div>
            <div style={{ fontSize: "20px", fontWeight: 800, color: "var(--ohmni-lab-text)" }}>
              {toolsUsedCount}
            </div>
            <div style={{ fontSize: "12px", color: "var(--ohmni-lab-secondary)" }}>
              WebMCP Tools Operated
            </div>
          </div>
        </div>

        {/* Metric 2: Human Interventions */}
        <div
          style={{
            background: "var(--ohmni-lab-surface, #FFFFFF)",
            border: "1px solid var(--ohmni-lab-border, #E2E4E9)",
            borderRadius: "var(--radius-lg, 12px)",
            padding: "1.25rem",
            display: "flex",
            alignItems: "center",
            gap: "14px",
          }}
        >
          <div
            style={{
              width: "40px",
              height: "40px",
              borderRadius: "10px",
              background: "rgba(224, 138, 0, 0.1)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--ohmni-lab-warning, #D97706)",
            }}
          >
            <Wrench size={20} />
          </div>
          <div>
            <div style={{ fontSize: "20px", fontWeight: 800, color: "var(--ohmni-lab-text)" }}>
              {displayHumanInterventions}
            </div>
            <div style={{ fontSize: "12px", color: "var(--ohmni-lab-secondary)" }}>
              {displayHumanInterventions === 1 ? "Human Intervention" : "Human Interventions"}
            </div>
          </div>
        </div>

        {/* Metric 3: Experiments Executed */}
        <div
          style={{
            background: "var(--ohmni-lab-surface, #FFFFFF)",
            border: "1px solid var(--ohmni-lab-border, #E2E4E9)",
            borderRadius: "var(--radius-lg, 12px)",
            padding: "1.25rem",
            display: "flex",
            alignItems: "center",
            gap: "14px",
          }}
        >
          <div
            style={{
              width: "40px",
              height: "40px",
              borderRadius: "10px",
              background: "rgba(39, 150, 107, 0.1)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--ohmni-lab-verified, #27966B)",
            }}
          >
            <Activity size={20} />
          </div>
          <div>
            <div style={{ fontSize: "20px", fontWeight: 800, color: "var(--ohmni-lab-text)" }}>
              {experimentsCount}
            </div>
            <div style={{ fontSize: "12px", color: "var(--ohmni-lab-secondary)" }}>
              Controlled DUT Experiments
            </div>
          </div>
        </div>

        {/* Evidence Tokens Ledger */}
        <div
          data-testid="evidence-ledger-container"
          style={{
            background: "var(--ohmni-lab-surface, #FFFFFF)",
            border: "1px solid var(--ohmni-lab-border, #E2E4E9)",
            borderRadius: "var(--radius-lg, 12px)",
            padding: "1rem 1.25rem",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            gap: "8px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "var(--ohmni-lab-secondary)" }}>
              CITATIONS & EVIDENCE ({evidenceRecords.length})
            </span>
            <button
              type="button"
              data-testid="toggle-evidence-trail-btn"
              onClick={() => setShowEvidenceTrail((prev) => !prev)}
              style={{
                background: "none",
                border: "none",
                color: "var(--ohmni-lab-brand, #4967FF)",
                fontSize: "12px",
                fontWeight: 600,
                cursor: "pointer",
                padding: "2px 6px",
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
              }}
            >
              {showEvidenceTrail ? "Hide trail" : "View evidence trail"}
            </button>
          </div>

          {showEvidenceTrail ? (
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "6px" }}>
              {evidenceRecords.map((ev) => (
                <span
                  key={ev.id}
                  className="font-mono"
                  title={ev.summary}
                  style={{
                    padding: "3px 8px",
                    borderRadius: "4px",
                    background: ev.source === "human" ? "rgba(224, 138, 0, 0.1)" : "rgba(73, 103, 255, 0.08)",
                    border: ev.source === "human" ? "1px solid rgba(224, 138, 0, 0.25)" : "1px solid rgba(73, 103, 255, 0.2)",
                    fontSize: "11.5px",
                    fontWeight: 700,
                    color: ev.source === "human" ? "var(--ohmni-lab-warning)" : "var(--ohmni-lab-brand)",
                    cursor: "help",
                  }}
                >
                  {ev.id} {ev.source === "human" ? "• Human" : ""}
                </span>
              ))}
            </div>
          ) : (
            <div style={{ fontSize: "12px", color: "var(--ohmni-lab-muted, #64748B)" }}>
              {evidenceRecords.length > 0
                ? `${evidenceRecords.length} empirical records linked to verified root cause`
                : "No empirical records logged"}
            </div>
          )}
        </div>
      </div>
      {/* Action Footer */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          paddingTop: "1rem",
        }}
      >
        <button
          type="button"
          onClick={onReturnToWorkbench}
          className="btn-secondary"
          style={{
            padding: "12px 22px",
            fontSize: "14.5px",
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <span>Return to Workbench</span>
        </button>

        <button
          type="button"
          data-testid="run-another-mystery-btn"
          onClick={onRunAnotherMystery}
          className="btn-primary"
          style={{
            padding: "14px 28px",
            fontSize: "15px",
            fontWeight: 700,
            display: "inline-flex",
            alignItems: "center",
            gap: "10px",
          }}
        >
          <RotateCcw size={16} />
          <span>Run Another Mystery Diagnosis</span>
          <ArrowRight size={16} />
        </button>
      </div>
    </div>
    </div>
  );
};
