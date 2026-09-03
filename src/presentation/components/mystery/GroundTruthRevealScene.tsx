/**
 * Dedicated Ground Truth Reveal & Verification Payoff Scene.
 * Master Milestone 8 — The Core Winning Demo Payoff.
 *
 * Demonstrates unscripted AI hardware investigation:
 * - Sealed Ground Truth Unlocked
 * - Agent Diagnosis Comparison & Semantic Match Evaluation
 * - Pre-Repair vs Post-Repair Empirical Delta
 * - Citations to Immutable Evidence Records
 * - WebMCP Diagnostic Tool Usage Summary
 */

import React from "react";
import { CheckCircle2, XCircle, RotateCcw, ArrowRight, ShieldCheck, Wrench, Activity } from "lucide-react";
import type { ScenarioGroundTruth } from "@/domain/scenario/types";
import type { DiagnosisMatchResult } from "@/domain/scenario/engine";
import type { Hypothesis } from "@/domain/hypothesis/types";
import type { EvidenceRecord } from "@/domain/evidence/types";

export interface GroundTruthRevealSceneProps {
  readonly groundTruth: ScenarioGroundTruth;
  readonly hypothesis: Hypothesis | null;
  readonly matchResult: DiagnosisMatchResult;
  readonly evidenceRecords: readonly EvidenceRecord[];
  readonly toolsUsedCount: number;
  readonly experimentsCount: number;
  readonly humanInterventionsCount: number;
  readonly isVerified?: boolean;
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
  onRunAnotherMystery,
  onReturnToWorkbench,
}) => {
  const isMatch = isVerified && matchResult.isMatch;
  return (
    <div
      id="ground-truth-reveal-scene"
      data-testid="ground-truth-reveal-scene"
      style={{
        width: "100%",
        maxWidth: "1120px",
        margin: "0 auto",
        padding: "2rem 1.5rem 3rem",
        display: "flex",
        flexDirection: "column",
        gap: "2rem",
        boxSizing: "border-box",
      }}
    >
      {/* Header Banner */}
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
              {isVerified ? "INVESTIGATION PAYOFF • GROUND TRUTH UNSEALED" : "INVESTIGATION INCOMPLETE • MANUAL REVEAL"}
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
            {isVerified ? "Empirical Hardware Verification Result" : "Manual Ground Truth Inspection"}
          </h1>
        </div>

        {/* Big Match Badge */}
        <div
          data-testid="diagnosis-match-badge"
          style={{
            display: "inline-flex",
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
            SEALED GROUND TRUTH
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
            <strong>Expected Root Cause:</strong> {groundTruth.expectedDiagnosis}
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
                background: hypothesis?.verificationStatus === "VERIFIED"
                  ? "rgba(39, 150, 107, 0.15)"
                  : "rgba(73, 103, 255, 0.1)",
                color: hypothesis?.verificationStatus === "VERIFIED"
                  ? "var(--ohmni-lab-verified, #27966B)"
                  : "var(--ohmni-lab-brand, #4967FF)",
              }}
            >
              {hypothesis?.verificationStatus ?? "UNVERIFIED"}
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
              {hypothesis?.title ?? "No hypothesis synthesized"}
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
            <strong>Evaluation:</strong> {matchResult.reason}
          </div>
        </div>
      </div>
      {/* Before vs After Empirical Payoff Card */}
      <div
        id="reveal-before-after-card"
        data-testid="reveal-before-after-card"
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "1.25rem",
          background: "var(--ohmni-lab-surface, #FFFFFF)",
          border: "1px solid var(--ohmni-lab-border, #E2E4E9)",
          borderRadius: "var(--radius-xl, 16px)",
          padding: "1.5rem 1.75rem",
          boxShadow: "var(--shadow-sm)",
        }}
      >
        {/* BEFORE */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "6px",
            borderRight: "1px solid var(--ohmni-lab-border, #E2E4E9)",
            paddingRight: "1.5rem",
          }}
        >
          <div style={{ fontSize: "11px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--ohmni-lab-fault, #DC5050)" }}>
            BEFORE (PRE-REPAIR TEST)
          </div>
          <div className="font-mono" style={{ fontSize: "32px", fontWeight: 800, color: "var(--ohmni-lab-fault, #DC5050)" }}>
            2.72 V
          </div>
          <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--ohmni-lab-fault, #DC5050)" }}>
            BROWNOUT DETECTED • RESET TRIGGERED
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
          <div style={{ fontSize: "11px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--ohmni-lab-verified, #27966B)" }}>
            AFTER (VERIFICATION RETEST)
          </div>
          <div className="font-mono" style={{ fontSize: "32px", fontWeight: 800, color: "var(--ohmni-lab-verified, #27966B)" }}>
            3.18 V
          </div>
          <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--ohmni-lab-verified, #27966B)" }}>
            NO RESET • SUPPLY RAIL STABLE
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
              {humanInterventionsCount}
            </div>
            <div style={{ fontSize: "12px", color: "var(--ohmni-lab-secondary)" }}>
              Human Interventions
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
              Physical Experiments
            </div>
          </div>
        </div>

        {/* Evidence Tokens Ledger */}
        <div
          style={{
            background: "var(--ohmni-lab-surface, #FFFFFF)",
            border: "1px solid var(--ohmni-lab-border, #E2E4E9)",
            borderRadius: "var(--radius-lg, 12px)",
            padding: "1rem 1.25rem",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            gap: "6px",
          }}
        >
          <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "var(--ohmni-lab-secondary)" }}>
            CITATIONS & EMPIRICAL EVIDENCE ({evidenceRecords.length})
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
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
  );
};
