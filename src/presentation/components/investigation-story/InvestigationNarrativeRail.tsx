/**
 * Chronological Live Investigation Narrative Rail (Right 30%).
 * Milestone 7.14 — Fix State Machine & Truthful Narrative Rail.
 *
 * Invariants:
 * 1. Truthful Completed Events: ONLY events with status === "completed" appear under History/Completed.
 * 2. Single Approval UI: When in approval state, right rail shows "WAITING FOR YOU" notice only.
 *    No duplicate Approve/Deny buttons in the sidebar. Main canvas owns the decision.
 * 3. Minimal Clean Rail:
 *    - Header: Gemini ● Live
 *    - GOAL
 *    - CURRENT ACTION (if active or waiting approval)
 *    - HISTORY (clean vertical timeline)
 */

import React, { useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Play, Square, Check, ShieldAlert, RotateCcw, Activity, Clock, X, AlertCircle } from "lucide-react";
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
}) => {
  const active = agentState.status === "investigating" || agentState.status === "approval";
  const isIdle = agentState.status === "idle" || agentState.status === "stopped";
  const currentGoal = agentState.goal || "The controller restarts when the fan turns on.";
  const canStart = agentState.providerAvailable && currentGoal.trim().length > 0 && isIdle;

  const [goalText, setGoalText] = useState(currentGoal);
  const [copied, setCopied] = useState(false);

  const handleGoalChange = (
    e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement> | React.FormEvent<HTMLTextAreaElement | HTMLInputElement>
  ) => {
    const value = (e.target as HTMLInputElement | HTMLTextAreaElement).value;
    setGoalText(value);
    onSetGoal(value);
  };

  const getHumanToolName = (toolName: string) => {
    switch (toolName) {
      case "read_device_info":
        return "Read device descriptor";
      case "read_reset_history":
        return "Read reset history";
      case "read_system_health":
        return "Read system health";
      case "measure_supply_voltage":
        return "Measure supply voltage";
      case "run_relay_stress_test":
        return "Controlled relay stress test";
      case "list_evidence":
        return "List empirical evidence";
      case "get_evidence":
        return "Inspect evidence record";
      case "propose_hypothesis":
        return "Propose diagnostic hypothesis";
      case "update_hypothesis":
        return "Update diagnostic hypothesis";
      case "link_evidence":
        return "Link evidence to hypothesis";
      case "confirm_hypothesis":
        return "Confirm root cause hypothesis";
      case "reject_hypothesis":
        return "Reject diagnostic hypothesis";
      case "request_human_intervention":
        return "Request physical intervention";
      default:
        return toolName.replace(/_/g, " ");
    }
  };

  // Strictly filter completed events: status === "completed" ONLY
  const completedEvents = useMemo(() => {
    const events: { id: string; title: string; tool: string; durationMs?: number }[] = [];

    agentState.activity.forEach((act, idx) => {
      if (act.status === "completed") {
        events.push({
          id: `evt-${idx}-${act.call.name}`,
          title: getHumanToolName(act.call.name),
          tool: act.call.name,
          durationMs: act.durationMs,
        });
      }
    });

    return events;
  }, [agentState.activity]);

  const activeTool = agentState.activity.length > 0 ? agentState.activity[agentState.activity.length - 1] : null;
  const isExecutingTool = activeTool?.status === "requested";
  const isWaitingApproval = agentState.status === "approval";

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
      {/* Header: Gemini ● Live */}
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
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <AgentOrbNode
            status={agentState.status}
            isExecutingTool={isExecutingTool || isWaitingApproval}
            size={20}
          />
          <div>
            <div style={{ fontSize: "14px", fontWeight: 800, color: "var(--ohmni-lab-text)", letterSpacing: "-0.01em" }}>
              Gemini
            </div>
            <div
              data-testid="bench-agent-status"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "5px",
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
              <span
                style={{
                  display: "inline-block",
                  width: "6px",
                  height: "6px",
                  borderRadius: "50%",
                  background: active
                    ? "var(--ohmni-lab-brand)"
                    : agentState.status === "completed"
                    ? "var(--ohmni-lab-verified)"
                    : agentState.status === "failed"
                    ? "var(--ohmni-lab-fault)"
                    : "#94A3B8",
                }}
              />
              <span>{active ? "Live" : isIdle ? "Ready" : agentState.status.toUpperCase()}</span>
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
              display: "flex",
              alignItems: "center",
              gap: "4px",
            }}
          >
            <Square size={10} />
            <span>Stop</span>
          </button>
        )}
      </div>

      {/* Narrative Stream */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "1.5rem",
          display: "flex",
          flexDirection: "column",
          gap: "1.5rem",
        }}
      >
        {/* GOAL */}
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <div
            className="font-mono"
            style={{
              fontSize: "10.5px",
              fontWeight: 700,
              color: "var(--ohmni-lab-muted)",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
            }}
          >
            GOAL
          </div>
          {isIdle ? (
            <textarea
              data-testid="bench-agent-goal-input"
              value={goalText}
              onChange={handleGoalChange}
              onInput={handleGoalChange}
              rows={2}
              style={{
                background: "var(--ohmni-lab-soft-raised)",
                border: "1px solid var(--ohmni-lab-border)",
                borderRadius: "var(--radius-md)",
                padding: "0.75rem 0.85rem",
                outline: "none",
                color: "var(--ohmni-lab-text)",
                fontSize: "13px",
                fontFamily: "var(--font-sans)",
                fontWeight: 500,
                lineHeight: 1.45,
                resize: "none",
              }}
            />
          ) : (
            <div
              style={{
                fontSize: "13px",
                fontWeight: 500,
                color: "var(--ohmni-lab-text)",
                lineHeight: 1.45,
                background: "var(--ohmni-lab-soft-raised)",
                padding: "0.75rem 0.85rem",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--ohmni-lab-border)",
              }}
            >
              {goalText}
            </div>
          )}
        </div>

        {/* Start Button when Idle */}
        {isIdle && (
          <button
            data-testid="bench-agent-start"
            id="start-agent-btn"
            onClick={onStartAgent}
            disabled={!canStart}
            className="btn-primary"
            style={{
              width: "100%",
              padding: "12px",
              fontSize: "14px",
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
            }}
          >
            <Play size={14} />
            <span>Begin investigation</span>
          </button>
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

        {/* CURRENT ACTION */}
        {isWaitingApproval ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <div
              className="font-mono"
              style={{
                fontSize: "10.5px",
                fontWeight: 700,
                color: "var(--ohmni-lab-action)",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
              }}
            >
              WAITING FOR YOU
            </div>
            <div
              style={{
                background: "rgba(255, 181, 74, 0.08)",
                border: "1px solid rgba(255, 181, 74, 0.35)",
                borderRadius: "var(--radius-md)",
                padding: "1rem 1.15rem",
                display: "flex",
                flexDirection: "column",
                gap: "6px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "var(--ohmni-lab-action)", fontSize: "11px", fontWeight: 700 }}>
                <ShieldAlert size={14} />
                <span>AUTHORIZATION REQUIRED</span>
              </div>
              <div style={{ fontSize: "13.5px", fontWeight: 700, color: "var(--ohmni-lab-text)" }}>
                {getHumanToolName(agentState.approval.tool.name)}
              </div>
              <div className="font-mono" style={{ fontSize: "10.5px", color: "var(--ohmni-lab-muted)" }}>
                {agentState.approval.tool.name}
              </div>
              <p style={{ margin: "4px 0 0", fontSize: "12px", color: "var(--ohmni-lab-muted)", lineHeight: 1.4 }}>
                Review safety envelope and authorize test in the main canvas.
              </p>
            </div>
          </div>
        ) : active && activeTool && isExecutingTool ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <div
              className="font-mono"
              style={{
                fontSize: "10.5px",
                fontWeight: 700,
                color: "var(--ohmni-lab-brand)",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
              }}
            >
              CURRENT ACTION
            </div>
            <div
              style={{
                background: "rgba(73, 103, 255, 0.06)",
                border: "1px solid var(--ohmni-lab-brand)",
                borderRadius: "var(--radius-md)",
                padding: "1rem 1.15rem",
                display: "flex",
                flexDirection: "column",
                gap: "6px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "var(--ohmni-lab-brand)", fontSize: "11px", fontWeight: 700 }}>
                <Activity size={13} className="animate-spin" />
                <span>EXECUTING INSTRUMENT</span>
              </div>
              <div style={{ fontSize: "13.5px", fontWeight: 700, color: "var(--ohmni-lab-text)" }}>
                {getHumanToolName(activeTool.call.name)}
              </div>
              <div className="font-mono" style={{ fontSize: "10.5px", color: "var(--ohmni-lab-muted)" }}>
                {activeTool.call.name}
              </div>
            </div>
          </div>
        ) : null}

        {/* HISTORY (Vertical Timeline) */}
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <div
            className="font-mono"
            style={{
              fontSize: "10.5px",
              fontWeight: 700,
              color: "var(--ohmni-lab-muted)",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <span>HISTORY</span>
            {completedEvents.length > 0 && <span>({completedEvents.length})</span>}
          </div>

          {completedEvents.length === 0 && !active && (
            <div style={{ fontSize: "12px", color: "var(--ohmni-lab-muted)", fontStyle: "italic", padding: "4px 0" }}>
              No instrument actions executed yet.
            </div>
          )}

          {/* Timeline items */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              position: "relative",
              paddingLeft: "18px",
            }}
          >
            {/* Timeline vertical spine line */}
            {(completedEvents.length > 1 || (completedEvents.length > 0 && active)) && (
              <div
                style={{
                  position: "absolute",
                  left: "6px",
                  top: "10px",
                  bottom: "10px",
                  width: "1.5px",
                  background: "var(--ohmni-lab-border)",
                }}
              />
            )}

            {completedEvents.map((evt) => (
              <div
                key={evt.id}
                data-testid="bench-agent-activity-row"
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "10px",
                  padding: "6px 0",
                  position: "relative",
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    left: "-18px",
                    top: "9px",
                    width: "14px",
                    height: "14px",
                    borderRadius: "50%",
                    background: "var(--ohmni-lab-raised)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    zIndex: 1,
                  }}
                >
                  <Check size={11} color="var(--ohmni-lab-verified)" strokeWidth={3} />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "1px" }}>
                  <span style={{ fontSize: "12.5px", fontWeight: 600, color: "var(--ohmni-lab-text)" }}>
                    {evt.title}
                  </span>
                  <span className="font-mono" style={{ fontSize: "10px", color: "var(--ohmni-lab-muted)" }}>
                    {evt.tool}
                  </span>
                </div>
              </div>
            ))}

            {/* In-progress / Pending step on timeline if active */}
            {isWaitingApproval && (
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "10px",
                  padding: "6px 0",
                  position: "relative",
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    left: "-18px",
                    top: "9px",
                    width: "14px",
                    height: "14px",
                    borderRadius: "50%",
                    background: "var(--ohmni-lab-raised)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    zIndex: 1,
                  }}
                >
                  <span
                    style={{
                      width: "6px",
                      height: "6px",
                      borderRadius: "50%",
                      background: "var(--ohmni-lab-action)",
                    }}
                  />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "1px" }}>
                  <span style={{ fontSize: "12.5px", fontWeight: 600, color: "var(--ohmni-lab-action)" }}>
                    Waiting for approval
                  </span>
                  <span className="font-mono" style={{ fontSize: "10px", color: "var(--ohmni-lab-muted)" }}>
                    {agentState.approval.tool.name}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
