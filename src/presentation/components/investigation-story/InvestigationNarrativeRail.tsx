/**
 * Chronological Live Investigation Narrative Rail (Right 30%).
 * Milestone 7.13 — Visual Rescue: 3D OHMNI Identity + Cohesive Product UI
 *
 * Requirements:
 * - Abstract Agent Orb Node with active luminous core.
 * - Cohesive light surface palette (#FFFFFF, #ECEFF4, #12151A).
 * - Start state:
 *     AGENT
 *     Ready.
 *     Goal: "The controller restarts when the fan turns on."
 *     [ Begin investigation ]
 * - During investigation:
 *     Real active action callout with tool metadata
 *     Human approval gate with [ Approve ] / [ Deny ]
 *     Chronological list of completed empirical events
 */

import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Play, Square, CheckCircle2, ShieldAlert, RotateCcw, Activity } from "lucide-react";
import { AgentOrbNode } from "../agent/AgentOrbNode";
import type { BenchAgentState } from "../../hooks/useBenchAgent";

export interface InvestigationNarrativeRailProps {
  readonly agentState: BenchAgentState;
  readonly onSetGoal: (goal: string) => void;
  readonly onStartAgent: () => void;
  readonly onStopAgent: () => void;
  readonly onApprove?: () => void;
  readonly onDeny?: () => void;
  readonly onSelectScene?: (scene: "ready" | "observing" | "test-request" | "running" | "evidence" | "hypothesis") => void;
}

export const InvestigationNarrativeRail: React.FC<InvestigationNarrativeRailProps> = ({
  agentState,
  onSetGoal,
  onStartAgent,
  onStopAgent,
  onApprove,
  onDeny,
}) => {
  const active = agentState.status === "investigating" || agentState.status === "approval";
  const isIdle = agentState.status === "idle" || agentState.status === "stopped";
  const currentGoal = agentState.goal || "The controller restarts when the fan turns on.";
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
    if (toolName.includes("reset")) return "Reading reset history";
    if (toolName.includes("relay") || toolName.includes("stress")) return "Controlled relay actuation test";
    if (toolName.includes("voltage")) return "Measuring supply rail voltage";
    if (toolName.includes("hypothesis") || toolName.includes("propose")) return "Synthesizing root cause hypothesis";
    if (toolName.includes("evidence") || toolName.includes("link")) return "Logging empirical evidence fact";
    return toolName;
  };

  // Derive completed chronological real events from activity
  const completedEvents = useMemo(() => {
    const events: { id: string; title: string; tool: string }[] = [];

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

  const activeTool = agentState.activity.length > 0 ? agentState.activity[agentState.activity.length - 1] : null;
  const isExecutingTool = activeTool?.status === "requested" || activeTool?.status === "waiting-approval";

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
      {/* Rail Header with Abstract Agent Orb Node */}
      <div
        style={{
          padding: "1.25rem 1.5rem",
          borderBottom: "1px solid var(--ohmni-lab-border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: "var(--ohmni-lab-raised)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <AgentOrbNode
            status={agentState.status}
            isExecutingTool={isExecutingTool}
            size={22}
          />

          <div>
            <div style={{ fontSize: "13.5px", fontWeight: 700, color: "var(--ohmni-lab-text)", letterSpacing: "0.01em" }}>
              AGENT INVESTIGATION
            </div>
            <div
              data-testid="bench-agent-status"
              className="font-mono"
              style={{
                fontSize: "11px",
                fontWeight: 600,
                color: active
                  ? "var(--ohmni-lab-brand)"
                  : agentState.status === "completed"
                  ? "var(--ohmni-lab-verified)"
                  : agentState.status === "failed"
                  ? "var(--ohmni-lab-fault)"
                  : "var(--ohmni-lab-muted)",
              }}
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
              borderColor: "rgba(220, 80, 80, 0.3)",
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
        {/* Goal Card */}
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
          <div className="font-mono" style={{ fontSize: "10.5px", fontWeight: 700, color: "var(--ohmni-lab-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            INVESTIGATION GOAL
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
                lineHeight: 1.45,
                resize: "none",
              }}
            />
          ) : (
            <div style={{ fontSize: "13.5px", fontWeight: 600, color: "var(--ohmni-lab-text)", lineHeight: 1.45 }}>
              {goalText}
            </div>
          )}
        </div>

        {/* Start Button when Idle */}
        {isIdle && (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "0.25rem" }}>
            <button
              data-testid="bench-agent-start"
              id="start-agent-btn"
              onClick={onStartAgent}
              disabled={!canStart}
              className="btn-primary"
              style={{
                width: "100%",
                padding: "13px",
                fontSize: "14.5px",
                fontWeight: 700,
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
              background: "rgba(220, 80, 80, 0.06)",
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
                    2
                  );
                  void navigator.clipboard.writeText(details);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
                className="btn-secondary"
                style={{
                  padding: "8px 12px",
                  fontSize: "12px",
                }}
              >
                <span>{copied ? "Copied" : "Copy details"}</span>
              </button>
            </div>
          </div>
        )}

        {/* Approval Card when in Approval State */}
        {agentState.status === "approval" && (
          <div
            data-testid="bench-agent-approval"
            style={{
              background: "rgba(229, 157, 55, 0.08)",
              border: "1.5px solid var(--ohmni-lab-warning)",
              borderRadius: "var(--radius-md)",
              padding: "1.25rem",
              display: "flex",
              flexDirection: "column",
              gap: "10px",
              boxShadow: "0 4px 16px rgba(229, 157, 55, 0.15)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "var(--ohmni-lab-warning)", fontSize: "12px", fontWeight: 700 }}>
              <ShieldAlert size={15} />
              <span>APPROVAL REQUIRED</span>
            </div>
            <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--ohmni-lab-text)" }}>
              {getHumanToolName(agentState.approval.tool.name)}
            </div>
            <div className="font-mono" style={{ fontSize: "11px", color: "var(--ohmni-lab-muted)" }}>
              {agentState.approval.tool.name}
            </div>
            <div style={{ display: "flex", gap: "8px", marginTop: "4px" }}>
              <button
                data-testid="bench-agent-approve"
                onClick={onApprove}
                className="btn-primary"
                style={{
                  padding: "8px 16px",
                  fontSize: "12.5px",
                  background: "var(--ohmni-lab-warning)",
                  color: "#12151A",
                  fontWeight: 800,
                }}
              >
                Approve (A)
              </button>
              <button
                data-testid="bench-agent-deny"
                onClick={onDeny}
                className="btn-secondary"
                style={{
                  padding: "8px 14px",
                  fontSize: "12.5px",
                }}
              >
                Deny (D)
              </button>
            </div>
          </div>
        )}

        {/* Active Tool Call Callout */}
        {active && activeTool && (
          <div
            style={{
              background: "rgba(73, 103, 255, 0.06)",
              border: "1px solid var(--ohmni-lab-brand)",
              borderRadius: "var(--radius-md)",
              padding: "1rem 1.25rem",
              display: "flex",
              flexDirection: "column",
              gap: "6px",
              boxShadow: "0 4px 14px rgba(73, 103, 255, 0.1)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "var(--ohmni-lab-brand)", fontSize: "11.5px", fontWeight: 700 }}>
              <Activity size={13} className="animate-spin" />
              <span>CURRENT INSTRUMENT ACTION</span>
            </div>
            <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--ohmni-lab-text)" }}>
              {getHumanToolName(activeTool.call.name)}
            </div>
            <div className="font-mono" style={{ fontSize: "11px", color: "var(--ohmni-lab-muted)" }}>
              {activeTool.call.name}
            </div>
          </div>
        )}

        {/* Chronological Completed Real Events */}
        {completedEvents.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <div className="font-mono" style={{ fontSize: "11px", fontWeight: 700, color: "var(--ohmni-lab-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
              COMPLETED EVENTS ({completedEvents.length})
            </div>

            {completedEvents.map((evt) => (
              <div
                key={evt.id}
                data-testid="bench-agent-activity-row"
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "10px",
                  padding: "10px 12px",
                  borderRadius: "var(--radius-sm)",
                  background: "var(--ohmni-lab-soft-raised)",
                  border: "1px solid var(--ohmni-lab-border)",
                  fontSize: "12.5px",
                }}
              >
                <CheckCircle2 size={16} color="var(--ohmni-lab-verified)" style={{ marginTop: "1px", flexShrink: 0 }} />
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
