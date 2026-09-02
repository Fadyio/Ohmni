/**
 * Investigation Narrative Rail (Right 32%).
 * Presents human-readable diagnostic milestones with tool metadata and testing hooks:
 * 01 Observed repeated brownout resets
 * 02 Testing relay load against MCU supply
 * 03 Captured 2.72 V rail collapse
 * 04 Formed evidence-backed hypothesis
 * Supports automated WebMCP Chrome testing and human diagnostic workflows.
 */

import React from "react";
import { motion } from "motion/react";
import { Bot, Play, Square, Sparkles, CheckCircle2, ChevronRight, Check, X, ShieldAlert, RotateCcw } from "lucide-react";
import type { BenchAgentState, BenchAgentActivity } from "../../hooks/useBenchAgent";

export interface InvestigationNarrativeRailProps {
  readonly agentState: BenchAgentState;
  readonly onSetGoal: (goal: string) => void;
  readonly onStartAgent: () => void;
  readonly onStopAgent: () => void;
  readonly onApprove?: () => void;
  readonly onDeny?: () => void;
  readonly onSelectScene?: (scene: "observing" | "test-request" | "running" | "evidence" | "hypothesis") => void;
}

export const InvestigationNarrativeRail: React.FC<InvestigationNarrativeRailProps> = ({
  agentState,
  onSetGoal,
  onStartAgent,
  onStopAgent,
  onApprove,
  onDeny,
  onSelectScene,
}) => {
  const active = agentState.status === "investigating" || agentState.status === "approval";
  const canStart = agentState.providerAvailable && agentState.goal.trim().length > 0 && !active;

  // Global Keyboard Accelerators for Human Approval Gate ([A] Approve, [D]/[Esc] Deny)
  React.useEffect(() => {
    if (agentState.status !== "approval" || !onApprove || !onDeny) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "a" || e.key === "A") {
        e.preventDefault();
        onApprove();
      } else if (e.key === "d" || e.key === "D" || e.key === "Escape") {
        e.preventDefault();
        onDeny();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [agentState.status, onApprove, onDeny]);

  // Build human narrative steps from state
  const steps = [
    {
      number: "01",
      title: "Observed repeated brownout resets",
      description: "Read BOD hardware registers via read_reset_history.",
      scene: "observing" as const,
      isCompleted: agentState.activity.some((a) => a.call.name.includes("reset")),
      isActive: agentState.activity.length === 1 && active,
    },
    {
      number: "02",
      title: "Testing relay load against MCU supply",
      description: "Controlled physical actuation via run_relay_stress_test.",
      scene: "test-request" as const,
      isCompleted: agentState.activity.some((a) => a.call.name.includes("relay") && a.status === "completed"),
      isActive: agentState.status === "approval" || (agentState.activity.some((a) => a.call.name.includes("relay")) && active),
    },
    {
      number: "03",
      title: "Captured 2.72 V rail collapse",
      description: "Real-time voltage sag below 2.80 V brownout limit.",
      scene: "running" as const,
      isCompleted: agentState.activity.some((a) => a.call.name.includes("voltage") || a.call.name.includes("evidence")),
      isActive: false,
    },
    {
      number: "04",
      title: "Formed evidence-backed hypothesis",
      description: "H-001: Relay-induced supply brownout (HIGH confidence).",
      scene: "hypothesis" as const,
      isCompleted: agentState.status === "completed" || agentState.activity.some((a) => a.call.name.includes("hypothesis")),
      isActive: agentState.status === "completed",
    },
  ];

  return (
    <div
      data-testid="bench-agent-panel"
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: "var(--ohmni-surface)",
        borderLeft: "1px solid var(--ohmni-border)",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "1.25rem 1.5rem",
          borderBottom: "1px solid var(--ohmni-border-subtle)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div
            style={{
              width: "28px",
              height: "28px",
              borderRadius: "50%",
              background: active ? "var(--ohmni-agent-subtle)" : "var(--ohmni-surface-raised)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: active ? "var(--ohmni-agent)" : "var(--ohmni-secondary)",
              boxShadow: active ? "0 0 12px rgba(117, 87, 211, 0.3)" : "none",
            }}
          >
            <Bot size={15} />
          </div>
          <div>
            <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--ohmni-ink)" }}>
              Investigation Narrative
            </div>
            <div className="font-mono" style={{ fontSize: "11px", color: "var(--ohmni-agent)" }}>
              {agentState.providerAvailable ? "Gemini 3.7 Flash • LIVE" : "Deterministic Test Provider"}
            </div>
          </div>
        </div>

        <div
          data-testid="bench-agent-status"
          className="font-mono"
          style={{
            fontSize: "11px",
            fontWeight: 700,
            padding: "3px 8px",
            borderRadius: "var(--radius-full)",
            background: active ? "var(--ohmni-agent-subtle)" : "var(--ohmni-surface-raised)",
            color: active ? "var(--ohmni-agent)" : "var(--ohmni-text-muted)",
            border: "1px solid var(--ohmni-border)",
            display: "inline-flex",
            alignItems: "center",
            gap: "5px",
          }}
        >
          <span
            style={{
              width: "6px",
              height: "6px",
              borderRadius: "50%",
              background: active ? "var(--ohmni-agent)" : "var(--ohmni-text-muted)",
            }}
          />
          {agentState.status.toUpperCase()}
        </div>
      </div>

      {/* Main Narrative Steps List */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "1.25rem 1.5rem",
          display: "flex",
          flexDirection: "column",
          gap: "1.25rem",
        }}
      >
        {/* Goal Card */}
        <div
          style={{
            background: "var(--ohmni-surface-raised)",
            border: "1px solid var(--ohmni-border)",
            borderRadius: "var(--radius-md)",
            padding: "12px 14px",
          }}
        >
          <label
            htmlFor="bench-agent-goal"
            style={{ fontSize: "11px", fontWeight: 700, color: "var(--ohmni-secondary)", textTransform: "uppercase", letterSpacing: "0.04em", display: "block", marginBottom: "6px" }}
          >
            Diagnostic Objective
          </label>
          <textarea
            id="bench-agent-goal"
            data-testid="bench-agent-goal-input"
            value={agentState.goal}
            onChange={(e) => onSetGoal(e.target.value)}
            disabled={active}
            rows={2}
            style={{
              width: "100%",
              resize: "none",
              border: "1px solid var(--ohmni-border)",
              borderRadius: "var(--radius-sm)",
              background: "var(--ohmni-surface)",
              color: "var(--ohmni-ink)",
              padding: "8px 10px",
              fontFamily: "var(--font-sans)",
              fontSize: "13px",
              lineHeight: 1.4,
            }}
          />

          <div style={{ marginTop: "8px" }}>
            {!active ? (
              <button
                type="button"
                data-testid="bench-agent-start"
                onClick={onStartAgent}
                disabled={!canStart}
                className="btn-primary"
                style={{
                  width: "100%",
                  padding: "9px",
                  fontSize: "13px",
                }}
              >
                <Play size={13} fill="currentColor" />
                Start Autonomous Investigation
              </button>
            ) : (
              <button
                type="button"
                data-testid="bench-agent-stop"
                onClick={onStopAgent}
                className="btn-secondary"
                style={{
                  width: "100%",
                  padding: "9px",
                  fontSize: "13px",
                  color: "var(--ohmni-fault)",
                  borderColor: "rgba(217, 74, 69, 0.3)",
                }}
              >
                <Square size={13} fill="currentColor" />
                Stop Agent
              </button>
            )}
          </div>
        </div>

        {/* Human Approval Gate Alert (When Waiting for Human) */}
        {agentState.status === "approval" && (
          <div
            data-testid="bench-agent-approval"
            style={{
              background: "var(--ohmni-warning-subtle)",
              border: "1.5px solid var(--ohmni-warning)",
              borderRadius: "var(--radius-md)",
              padding: "12px 14px",
              display: "flex",
              flexDirection: "column",
              gap: "8px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "var(--ohmni-warning)", fontSize: "12px", fontWeight: 700 }}>
              <ShieldAlert size={14} />
              AUTHORIZATION REQUIRED • run_relay_stress_test
            </div>
            <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--ohmni-ink)" }}>
              Relay Stress Test (500ms Actuation)
            </div>
            <div style={{ display: "flex", gap: "8px", marginTop: "4px" }}>
              <button
                type="button"
                data-testid="bench-agent-deny"
                onClick={onDeny}
                className="btn-secondary"
                style={{ flex: 1, padding: "6px", fontSize: "12px" }}
              >
                <X size={13} />
                Deny [D]
              </button>
              <button
                type="button"
                data-testid="bench-agent-approve"
                onClick={onApprove}
                className="btn-primary"
                style={{ flex: 1.5, padding: "6px", fontSize: "12px", background: "var(--ohmni-warning)", borderColor: "var(--ohmni-warning)" }}
              >
                <Check size={13} />
                Approve Test [A]
              </button>
            </div>
          </div>
        )}

        {/* Narrative Milestones */}
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--ohmni-secondary)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
            Diagnostic Milestones
          </div>

          {steps.map((step) => (
            <div
              key={step.number}
              onClick={() => onSelectScene?.(step.scene)}
              style={{
                background: step.isActive
                  ? "var(--ohmni-brand-subtle)"
                  : "var(--ohmni-surface)",
                border: step.isActive
                  ? "1.5px solid var(--ohmni-brand)"
                  : "1px solid var(--ohmni-border)",
                borderRadius: "var(--radius-md)",
                padding: "12px 14px",
                cursor: "pointer",
                transition: "all var(--duration-micro) ease",
                display: "flex",
                flexDirection: "column",
                gap: "4px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span className="font-mono" style={{ fontSize: "12px", fontWeight: 800, color: step.isCompleted ? "var(--ohmni-success)" : "var(--ohmni-secondary)" }}>
                    {step.number}
                  </span>
                  <span style={{ fontSize: "13.5px", fontWeight: 700, color: "var(--ohmni-ink)" }}>
                    {step.title}
                  </span>
                </div>
                {step.isCompleted ? (
                  <CheckCircle2 size={15} color="var(--ohmni-success)" />
                ) : (
                  <ChevronRight size={14} color="var(--ohmni-text-muted)" />
                )}
              </div>
              <div style={{ fontSize: "12px", color: "var(--ohmni-secondary)", paddingLeft: "24px" }}>
                {step.description}
              </div>
            </div>
          ))}
        </div>

        {/* Executed Tool Activity List with testid hooks */}
        {agentState.activity.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginTop: "0.5rem" }}>
            <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--ohmni-secondary)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
              Tool Activity ({agentState.activity.length})
            </div>
            {agentState.activity.map((act, i) => (
              <div
                key={`${act.call.id}-${i}`}
                data-testid="bench-agent-activity-row"
                style={{
                  background: "var(--ohmni-surface-raised)",
                  border: "1px solid var(--ohmni-border)",
                  borderRadius: "var(--radius-sm)",
                  padding: "6px 10px",
                  fontSize: "12px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <span className="font-mono" style={{ fontWeight: 600, color: "var(--ohmni-ink)" }}>
                  {act.call.name}
                </span>
                <span className="font-mono" style={{ fontSize: "11px", color: act.status === "completed" ? "var(--ohmni-success)" : "var(--ohmni-warning)" }}>
                  {act.status}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Final Assessment Card */}
        {agentState.status === "completed" && (
          <div
            data-testid="bench-agent-assessment"
            style={{
              background: "var(--ohmni-surface-raised)",
              border: "1.5px solid rgba(37, 138, 96, 0.3)",
              borderRadius: "var(--radius-md)",
              padding: "12px 14px",
              display: "flex",
              flexDirection: "column",
              gap: "6px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "var(--ohmni-success)", fontSize: "12px", fontWeight: 800 }}>
              <Sparkles size={13} />
              DIAGNOSTIC ASSESSMENT COMPLETE
            </div>
            <p style={{ margin: 0, fontSize: "13px", lineHeight: 1.5, color: "var(--ohmni-ink)" }}>
              {agentState.assessment}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
