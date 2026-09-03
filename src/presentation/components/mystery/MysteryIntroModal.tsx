/**
 * Mystery Fault Introduction Modal.
 * Master Milestone 8 — Blind Hardware Investigation Mode.
 *
 * Conceals hidden scenario ground truth from the user and agent,
 * displaying only the observable public symptom and sealed status.
 */

import React from "react";
import { Lock, Play, ShieldAlert, Cpu, ArrowRight, ShieldCheck } from "lucide-react";
import type { ScenarioSession } from "@/domain/scenario/types";
import type { AgentMode } from "@/infrastructure/bench-agent/types";
import { getAgentIdentity } from "@/presentation/types/agent-identity";

export interface MysteryIntroModalProps {
  readonly session: ScenarioSession;
  readonly isDevMode?: boolean;
  readonly agentMode?: AgentMode;
  readonly liveProvider?: string;
  readonly liveModel?: string;
  readonly onBegin: () => void;
  readonly onCancel?: () => void;
}

export const MysteryIntroModal: React.FC<MysteryIntroModalProps> = ({
  session,
  agentMode = "groq",
  liveProvider,
  liveModel,
  onBegin,
  onCancel,
}) => {
  const identity = getAgentIdentity(agentMode, liveProvider, liveModel);
  const isDemo = identity.isDeterministic;
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
              {isDemo ? "DEMO AGENT • WALKTHROUGH" : session.sessionId}
            </span>
          </div>

          {/* Status Indicator */}
          <div
            data-testid="sealed-truth-indicator"
            title={isDemo ? "Guided fallback walkthrough using browser WebMCP instruments" : "The scenario state is held outside the model context and is revealed only after verification."}
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
            {isDemo ? (
              <>
                <ShieldCheck size={12} color="var(--ohmni-lab-brand, #4967FF)" />
                <span>Deterministic WebMCP walkthrough</span>
              </>
            ) : (
              <>
                <Lock size={12} />
                <span>Hidden from agent context</span>
              </>
            )}
          </div>
        </div>

        {/* Title and Intro */}
        <div>
          <h2
            style={{
              fontSize: "24px",
              fontWeight: 800,
              letterSpacing: "-0.02em",
              color: "var(--ohmni-lab-text, #0F172A)",
              margin: "0 0 6px 0",
            }}
          >
            {isDemo ? "DETERMINISTIC WEBMCP WALKTHROUGH" : "BLIND HARDWARE CHALLENGE"}
          </h2>
          <p
            style={{
              fontSize: "14px",
              lineHeight: 1.5,
              color: "var(--ohmni-lab-muted, #64748B)",
              margin: 0,
            }}
          >
            {isDemo
              ? "This guided fallback demonstrates the same browser instruments, safety gates, evidence system and verification loop without external AI inference."
              : `A fault has been injected into the virtual controller. ${identity.displayName} has not been given the answer.`}
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
        {/* Ground Truth Status */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            fontSize: "13px",
            color: "var(--ohmni-lab-secondary, #64748B)",
            padding: "0.25rem 0",
          }}
        >
          {isDemo ? (
            <>
              <ShieldCheck size={14} color="var(--ohmni-lab-verified, #27966B)" />
              <span><strong>EXECUTION:</strong> Guided WebMCP instrument verification without AI inference.</span>
            </>
          ) : (
            <>
              <Lock size={14} color="var(--ohmni-lab-action, #D97706)" />
              <span><strong>GROUND TRUTH:</strong> Hidden from agent context until reveal.</span>
            </>
          )}
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
              padding: "12px 28px",
              fontSize: "15px",
              fontWeight: 700,
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <Play size={16} />
            <span>{isDemo ? "Begin Walkthrough" : "Begin Investigation"}</span>
            <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};
