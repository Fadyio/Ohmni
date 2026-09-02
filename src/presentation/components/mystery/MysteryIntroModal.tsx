/**
 * Mystery Fault Introduction Modal.
 * Master Milestone 8 — Blind Hardware Investigation Mode.
 *
 * Conceals hidden scenario ground truth from the user and agent,
 * displaying only the observable public symptom and sealed status.
 */

import React from "react";
import { Lock, Play, ShieldAlert, Cpu, ArrowRight } from "lucide-react";
import type { ScenarioSession } from "@/domain/scenario/types";

export interface MysteryIntroModalProps {
  readonly session: ScenarioSession;
  readonly isDevMode?: boolean;
  readonly onBegin: () => void;
  readonly onCancel?: () => void;
}

export const MysteryIntroModal: React.FC<MysteryIntroModalProps> = ({
  session,
  isDevMode = false,
  onBegin,
  onCancel,
}) => {
  return (
    <div
      id="mystery-intro-overlay"
      data-testid="mystery-intro-overlay"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        backgroundColor: "rgba(10, 15, 25, 0.75)",
        backdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100,
        padding: "1.5rem",
        boxSizing: "border-box",
      }}
    >
      <div
        id="mystery-intro-card"
        data-testid="mystery-intro-card"
        style={{
          width: "100%",
          maxWidth: "580px",
          background: "var(--ohmni-lab-surface, #FFFFFF)",
          borderRadius: "var(--radius-xl, 16px)",
          border: "1px solid var(--ohmni-lab-border, #E2E4E9)",
          boxShadow: "0 24px 48px -12px rgba(10, 15, 25, 0.22)",
          padding: "2.25rem",
          display: "flex",
          flexDirection: "column",
          gap: "1.5rem",
          boxSizing: "border-box",
          position: "relative",
        }}
      >
        {/* Header Badges */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span
              className="font-mono"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "4px 10px",
                borderRadius: "var(--radius-full, 9999px)",
                background: "rgba(73, 103, 255, 0.08)",
                border: "1px solid rgba(73, 103, 255, 0.2)",
                fontSize: "12px",
                fontWeight: 700,
                color: "var(--ohmni-lab-brand, #4967FF)",
              }}
            >
              <Cpu size={14} />
              {session.sessionId}
            </span>
            {isDevMode && (
              <span
                style={{
                  padding: "3px 8px",
                  borderRadius: "4px",
                  background: "rgba(224, 138, 0, 0.12)",
                  color: "var(--ohmni-lab-warning, #D97706)",
                  fontSize: "10.5px",
                  fontWeight: 700,
                  fontFamily: "monospace",
                }}
              >
                DEV MODE: {session.scenarioId}
              </span>
            )}
          </div>

          {/* Sealed Truth Indicator */}
          <div
            title="The scenario state is held outside the model/tool context and is revealed only after verification."
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "4px 10px",
              borderRadius: "var(--radius-full, 9999px)",
              background: "rgba(15, 23, 42, 0.06)",
              border: "1px solid rgba(15, 23, 42, 0.12)",
              fontSize: "11.5px",
              fontWeight: 600,
              color: "var(--ohmni-lab-secondary, #64748B)",
              cursor: "help",
            }}
          >
            <Lock size={12} />
            <span>SEALED GROUND TRUTH</span>
          </div>
        </div>

        {/* Title and Intro */}
        <div>
          <h2
            style={{
              fontSize: "22px",
              fontWeight: 800,
              letterSpacing: "-0.02em",
              color: "var(--ohmni-lab-text, #0F172A)",
              margin: "0 0 6px 0",
            }}
          >
            Mystery Hardware Investigation
          </h2>
          <p
            style={{
              fontSize: "14px",
              lineHeight: 1.5,
              color: "var(--ohmni-lab-muted, #64748B)",
              margin: 0,
            }}
          >
            A physical or configuration fault has been injected into this {session.deviceModel}.
            Neither you nor Gemini has been told what it is.
          </p>
        </div>

        {/* Public Symptom Card */}
        <div
          style={{
            background: "rgba(73, 103, 255, 0.04)",
            border: "1px solid rgba(73, 103, 255, 0.15)",
            borderRadius: "var(--radius-lg, 12px)",
            padding: "1.25rem",
            display: "flex",
            flexDirection: "column",
            gap: "6px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              fontSize: "11px",
              fontWeight: 700,
              letterSpacing: "0.05em",
              textTransform: "uppercase",
              color: "var(--ohmni-lab-brand, #4967FF)",
            }}
          >
            <ShieldAlert size={14} />
            <span>REPORTED SYMPTOM</span>
          </div>
          <p
            data-testid="mystery-symptom-text"
            style={{
              fontSize: "15px",
              fontWeight: 600,
              lineHeight: 1.45,
              color: "var(--ohmni-lab-text, #0F172A)",
              margin: 0,
            }}
          >
            "{session.publicSymptom}"
          </p>
        </div>

        {/* Blind Rules summary */}
        <div
          style={{
            fontSize: "12.5px",
            color: "var(--ohmni-lab-secondary, #64748B)",
            lineHeight: 1.5,
            padding: "0.5rem 0",
          }}
        >
          Ground truth remains cryptographically sealed until Gemini reaches an experimentally verified diagnosis or you reveal it.
        </div>

        {/* Action Buttons */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "12px", marginTop: "4px" }}>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="btn-secondary"
              style={{
                padding: "10px 18px",
                fontSize: "14px",
              }}
            >
              Cancel
            </button>
          )}
          <button
            type="button"
            data-testid="begin-mystery-btn"
            id="begin-mystery-btn"
            onClick={onBegin}
            className="btn-primary"
            style={{
              padding: "12px 24px",
              fontSize: "14.5px",
              fontWeight: 700,
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <Play size={16} />
            <span>Begin Investigation</span>
            <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};
