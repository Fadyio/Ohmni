/**
 * Chronological Live Investigation Narrative Rail (Right 25%).
 *
 * Requirements:
 * - NO STATIC 4-STEP RAIL. Zero future milestones.
 * - Start state:
 *     AGENT
 *     Ready.
 *     Goal: "The controller unexpectedly restarts when the fan turns on."
 *     [ Begin investigation ]
 * - During investigation:
 *     Active status chip (OBSERVING, INVESTIGATING, APPROVAL, COMPLETED).
 *     Human tool title (e.g. "Reading device reset history") + small metadata (read_reset_history).
 *     Chronological list of REAL completed events as they happen.
 */

import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Bot, Play, Square, Sparkles, CheckCircle2, ChevronRight, Check, X, ShieldAlert, RotateCcw, Activity } from "lucide-react";
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
  const isIdle = agentState.status === "idle" || agentState.status === "stopped";
  const currentGoal = agentState.goal || "The controller unexpectedly restarts when the fan turns on. Investigate the cause using the available instruments.";
  const canStart = agentState.providerAvailable && currentGoal.trim().length > 0 && isIdle;

  // Local state for editable goal input
  const [goalText, setGoalText] = useState(currentGoal);
  const [copied, setCopied] = useState(false);
  const handleGoalChange = (e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement> | React.FormEvent<HTMLTextAreaElement | HTMLInputElement>) => {
    const val = (e.target as HTMLTextAreaElement | HTMLInputElement).value;
    setGoalText(val);
    onSetGoal(val);
  };

  // Global Keyboard Accelerators for Human Approval Gate ([A] Approve, [D]/[Esc] Deny)
  useEffect(() => {
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

  // Generate human-friendly label from tool call name
  const getHumanToolName = (toolName: string) => {
    if (toolName.includes("reset")) return "Reading device reset history";
    if (toolName.includes("relay") || toolName.includes("stress")) return "Controlled relay actuation test";
    if (toolName.includes("voltage")) return "Measuring supply rail voltage";
    if (toolName.includes("hypothesis") || toolName.includes("propose")) return "Synthesizing root cause hypothesis";
    if (toolName.includes("evidence") || toolName.includes("link")) return "Logging empirical evidence fact";
    return toolName;
  };

  // Derive completed chronological real events from activity
  const completedEvents = useMemo(() => {
    const events: { id: string; title: string; tool: string; time?: string }[] = [];

    agentState.activity.forEach((act, idx) => {
      if (act.status === "completed" || act.status === "requested" || act.status === "waiting-approval") {
        const title = getHumanToolName(act.call.name);
        if (!events.some((e) => e.title === title)) {
          events.push({
            id: `evt-${idx}-${act.call.name}`,
            title,
            tool: act.call.name,
          });
        }
      }
    });
    return events;
  }, [agentState.activity]);

  return (
    <div
      data-testid="bench-agent-panel"
      id="bench-agent-panel"
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: "var(--ohmni-lab-raised)",
        borderLeft: "1px solid var(--ohmni-lab-border)",
        overflow: "hidden",
        color: "var(--ohmni-lab-text)",
      }}
    >
      {/* Rail Header */}
      <div
        style={{
          padding: "1.25rem 1.5rem",
          borderBottom: "1px solid var(--ohmni-lab-border)",
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
              background: active ? "rgba(85, 112, 255, 0.15)" : "var(--ohmni-lab-soft-raised)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: active ? "var(--ohmni-lab-brand)" : "var(--ohmni-lab-muted)",
              border: `1px solid ${active ? "var(--ohmni-lab-brand)" : "var(--ohmni-lab-border)"}`,
            }}
          >
            <Bot size={15} />
          </div>

          <div>
            <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--ohmni-lab-text)", letterSpacing: "0.02em" }}>
              BENCH AGENT INVESTIGATION
            </div>
            <div
              data-testid="bench-agent-status"
              className="font-mono"
              style={{ fontSize: "11px", color: active ? "var(--ohmni-lab-signal)" : "var(--ohmni-lab-muted)" }}
            >
              {agentState.status.toUpperCase()}
            </div>
          </div>
        </div>

        {active && (
          <button
            onClick={onStopAgent}
            className="btn-secondary"
            style={{
              padding: "4px 10px",
              fontSize: "11px",
              color: "var(--ohmni-lab-fault)",
              borderColor: "rgba(255, 89, 95, 0.3)",
            }}
          >
            <Square size={11} />
            <span>Stop</span>
          </button>
        )}
      </div>

      {/* Main Narrative Stream */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "1.5rem",
          display: "flex",
          flexDirection: "column",
          gap: "1.25rem",
        }}
      >
        {/* Goal Card with Input */}
        <div
          style={{
            background: "var(--ohmni-lab-soft-raised)",
            border: "1px solid var(--ohmni-lab-border)",
            borderRadius: "var(--radius-md)",
            padding: "1rem 1.25rem",
            display: "flex",
            flexDirection: "column",
            gap: "6px",
          }}
        >
          <div className="font-mono" style={{ fontSize: "11px", fontWeight: 700, color: "var(--ohmni-lab-muted)", textTransform: "uppercase" }}>
            DIAGNOSTIC GOAL
          </div>
          {isIdle ? (
            <textarea
              data-testid="bench-agent-goal-input"
              value={goalText}
              onChange={handleGoalChange}
              onInput={handleGoalChange}
              rows={2}
              style={{
                background: "transparent",
                border: "none",
                outline: "none",
                color: "var(--ohmni-lab-text)",
                fontSize: "13.5px",
                fontFamily: "var(--font-sans)",
                fontWeight: 600,
                lineHeight: 1.4,
                resize: "none",
              }}
            />
          ) : (
            <div style={{ fontSize: "13.5px", fontWeight: 600, color: "var(--ohmni-lab-text)", lineHeight: 1.4 }}>
              {goalText}
            </div>
          )}
        </div>

        {/* Start Button when Idle */}
        {isIdle && (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "0.5rem" }}>
            <button
              data-testid="bench-agent-start"
              id="start-agent-btn"
              onClick={onStartAgent}
              disabled={!canStart}
              className="btn-primary"
              style={{
                width: "100%",
                background: "var(--ohmni-lab-brand)",
                padding: "12px",
                fontSize: "14px",
                fontWeight: 700,
                boxShadow: "0 0 20px rgba(85, 112, 255, 0.25)",
              }}
            >
              <Play size={15} />
              <span>Begin investigation</span>
            </button>
          </div>
        )}
        {/* Failure Diagnostic Block */}
        {agentState.status === "failed" && (
          <div
            data-testid="bench-agent-failed-diagnostic"
            style={{
              background: "rgba(255, 89, 95, 0.08)",
              border: "1px solid var(--ohmni-lab-fault)",
              borderRadius: "var(--radius-md)",
              padding: "1.25rem",
              display: "flex",
              flexDirection: "column",
              gap: "10px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "var(--ohmni-lab-fault)", fontSize: "12px", fontWeight: 700 }}>
              <ShieldAlert size={15} />
              <span>AGENT FAILED</span>
            </div>
            <div style={{ fontSize: "13px", color: "var(--ohmni-lab-text)", lineHeight: 1.5, wordBreak: "break-word" }}>
              {agentState.message || "An unexpected error occurred during investigation."}
            </div>
            {agentState.requestId && (
              <div className="font-mono" style={{ fontSize: "11px", color: "var(--ohmni-lab-muted)" }}>
                Request ID: {agentState.requestId}
              </div>
            )}
            <div style={{ display: "flex", gap: "8px", marginTop: "4px" }}>
              <button
                data-testid="bench-agent-retry-btn"
                onClick={onStartAgent}
                className="btn-primary"
                style={{
                  padding: "8px 14px",
                  fontSize: "12px",
                  background: "var(--ohmni-lab-brand)",
                  fontWeight: 700,
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <RotateCcw size={13} />
                <span>Retry</span>
              </button>
              <button
                data-testid="bench-agent-copy-diagnostic-btn"
                onClick={() => {
                  const details = JSON.stringify(
                    {
                      error: "BENCH_AGENT_FAILED",
                      message: agentState.message,
                      requestId: agentState.requestId,
                      steps: agentState.steps,
                      timestamp: new Date().toISOString(),
                    },
                    null,
                    2,
                  );
                  void navigator.clipboard.writeText(details);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
                className="btn-secondary"
                style={{
                  padding: "8px 12px",
                  fontSize: "12px",
                  borderColor: "var(--ohmni-lab-border)",
                  color: "var(--ohmni-lab-text)",
                }}
              >
                <span>{copied ? "Copied" : "Copy diagnostic details"}</span>
              </button>
            </div>
          </div>
        )}

        {/* Approval Modal Card when in Approval State */}
        {agentState.status === "approval" && (
          <div
            data-testid="bench-agent-approval"
            style={{
              background: "rgba(255, 181, 74, 0.08)",
              border: "1px solid var(--ohmni-lab-action)",
              borderRadius: "var(--radius-md)",
              padding: "1rem 1.25rem",
              display: "flex",
              flexDirection: "column",
              gap: "8px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "var(--ohmni-lab-action)", fontSize: "12px", fontWeight: 700 }}>
              <ShieldAlert size={14} />
              <span>APPROVAL REQUIRED</span>
            </div>
            <div style={{ fontSize: "13.5px", fontWeight: 700, color: "var(--ohmni-lab-text)" }}>
              {agentState.approval.tool.name}
            </div>
            <div style={{ display: "flex", gap: "8px", marginTop: "6px" }}>
              <button
                data-testid="bench-agent-approve"
                onClick={onApprove}
                className="btn-primary"
                style={{
                  padding: "6px 14px",
                  fontSize: "12px",
                  background: "var(--ohmni-lab-action)",
                  color: "#090B10",
                  fontWeight: 800,
                }}
              >
                Approve
              </button>
              <button
                data-testid="bench-agent-deny"
                onClick={onDeny}
                className="btn-secondary"
                style={{
                  padding: "6px 14px",
                  fontSize: "12px",
                  borderColor: "var(--ohmni-lab-border)",
                  color: "var(--ohmni-lab-text)",
                }}
              >
                Deny
              </button>
            </div>
          </div>
        )}

        {/* Active Tool Call Callout */}
        {active && agentState.activity.length > 0 && (
          <div
            style={{
              background: "rgba(85, 112, 255, 0.08)",
              border: "1px solid var(--ohmni-lab-brand)",
              borderRadius: "var(--radius-md)",
              padding: "1rem 1.25rem",
              display: "flex",
              flexDirection: "column",
              gap: "6px",
              boxShadow: "0 0 20px rgba(85, 112, 255, 0.12)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "var(--ohmni-lab-signal)", fontSize: "11.5px", fontWeight: 700 }}>
              <Activity size={13} className="animate-spin" />
              <span>CURRENT ACTION</span>
            </div>
            <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--ohmni-lab-text)" }}>
              {getHumanToolName(agentState.activity[agentState.activity.length - 1].call.name)}
            </div>
            <div className="font-mono" style={{ fontSize: "11px", color: "var(--ohmni-lab-muted)" }}>
              {agentState.activity[agentState.activity.length - 1].call.name}
            </div>
          </div>
        )}

        {/* Chronological Completed Real Events */}
        {completedEvents.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <div className="font-mono" style={{ fontSize: "11px", fontWeight: 700, color: "var(--ohmni-lab-muted)", textTransform: "uppercase" }}>
              COMPLETED EVENTS ({completedEvents.length})
            </div>

            {completedEvents.map((evt, idx) => (
              <div
                key={evt.id}
                data-testid="bench-agent-activity-row"
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "10px",
                  padding: "8px 12px",
                  borderRadius: "var(--radius-sm)",
                  background: "var(--ohmni-lab-soft-raised)",
                  border: "1px solid var(--ohmni-lab-border)",
                  fontSize: "12.5px",
                }}
              >
                <CheckCircle2 size={15} color="var(--ohmni-lab-verified)" style={{ marginTop: "2px", flexShrink: 0 }} />
                <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                  <span style={{ fontWeight: 600, color: "var(--ohmni-lab-text)" }}>{evt.title}</span>
                  <span className="font-mono" style={{ fontSize: "10.5px", color: "var(--ohmni-lab-muted)" }}>
                    {evt.tool}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
