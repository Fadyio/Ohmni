/**
 * Scene 6 — Neutral Diagnostic Assessment & Completion Scene.
 * Milestone 7.15 — Truthful Assessment Render (No manufactured hypothesis artifacts).
 *
 * Requirements:
 * - Rendered when agent finishes (status === "completed") but NO formal hypothesis was synthesized.
 * - Displays the model's actual final textual assessment and diagnostic reasoning.
 * - Zero artificial or manufactured hypothesis placeholders.
 */

import React from "react";
import { motion } from "motion/react";
import { CheckCircle2, MessageSquare, RotateCcw, Activity } from "lucide-react";

export interface AssessmentSceneProps {
  readonly assessment: string;
  readonly steps?: number;
  readonly onRestart?: () => void;
}

export const AssessmentScene: React.FC<AssessmentSceneProps> = ({
  assessment,
  steps = 0,
  onRestart,
}) => {
  const cleanAssessment = assessment.trim() || "Agent finished diagnostic investigation.";

  return (
    <motion.div
      data-scene="completed"
      data-testid="completion-scene"
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "1.75rem",
        height: "100%",
        color: "var(--ohmni-lab-text)",
      }}
    >
      {/* Header Tag */}
      <div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            color: "var(--ohmni-lab-verified)",
            fontSize: "12.5px",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}
        >
          <CheckCircle2 size={14} />
          INVESTIGATION COMPLETE • DIAGNOSTIC ASSESSMENT
        </div>
        <h2
          style={{
            fontSize: "32px",
            fontWeight: 800,
            color: "var(--ohmni-lab-text)",
            margin: "4px 0 0",
            letterSpacing: "-0.02em",
          }}
        >
          Diagnostic Findings
        </h2>
      </div>

      {/* Main Assessment Container */}
      <div
        data-testid="completion-card"
        style={{
          background: "var(--ohmni-lab-raised)",
          border: "1.5px solid var(--ohmni-lab-border)",
          borderRadius: "var(--radius-xl)",
          padding: "2rem",
          boxShadow: "var(--shadow-card)",
          display: "flex",
          flexDirection: "column",
          gap: "1.5rem",
        }}
      >
        {/* Top Status Badge */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span
              style={{
                fontSize: "11px",
                fontWeight: 800,
                padding: "3px 10px",
                borderRadius: "var(--radius-full)",
                background: "rgba(79, 209, 154, 0.15)",
                color: "var(--ohmni-lab-verified)",
                border: "1px solid rgba(79, 209, 154, 0.3)",
              }}
            >
              FINAL ASSESSMENT
            </span>
            {steps > 0 && (
              <span className="font-mono" style={{ fontSize: "12px", color: "var(--ohmni-lab-muted)" }}>
                {steps} {steps === 1 ? "turn" : "turns"} executed
              </span>
            )}
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              color: "var(--ohmni-lab-muted)",
              fontSize: "12px",
              fontWeight: 600,
            }}
          >
            <Activity size={14} />
            <span>NO FORMAL HYPOTHESIS SYNTHESIZED</span>
          </div>
        </div>

        {/* Assessment Message Body */}
        <div
          style={{
            background: "var(--ohmni-lab-soft-raised)",
            border: "1px solid var(--ohmni-lab-border)",
            borderRadius: "var(--radius-lg)",
            padding: "1.25rem 1.5rem",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              color: "var(--ohmni-lab-brand)",
              fontSize: "12px",
              fontWeight: 700,
              textTransform: "uppercase",
              marginBottom: "8px",
            }}
          >
            <MessageSquare size={14} />
            <span>Agent Assessment</span>
          </div>
          <p
            data-testid="completion-assessment-text"
            style={{
              fontSize: "15px",
              lineHeight: 1.6,
              color: "var(--ohmni-lab-text)",
              margin: 0,
              whiteSpace: "pre-wrap",
            }}
          >
            {cleanAssessment}
          </p>
        </div>

        {/* Bottom Actions */}
        {onRestart && (
          <div
            style={{
              paddingTop: "1rem",
              borderTop: "1px solid var(--ohmni-lab-border)",
              display: "flex",
              justifyContent: "flex-end",
            }}
          >
            <button
              onClick={onRestart}
              className="btn-primary"
              style={{
                background: "var(--ohmni-lab-raised)",
                border: "1px solid var(--ohmni-lab-border)",
                color: "var(--ohmni-lab-text)",
                padding: "10px 18px",
                fontSize: "13px",
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <RotateCcw size={14} />
              <span>Start new investigation</span>
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
};
