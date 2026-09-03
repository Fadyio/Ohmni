/**
 * Chronological Live Investigation Narrative Rail (Right 30%).
 * Milestone 7.14 — Fix State Machine & Truthful Narrative Rail.
 *
 * Invariants:
 * 1. Truthful Tool History: terminal domain-ledger outcomes retain their origin,
 *    status, inputs, and factual result.
 * 2. Single Approval UI: while approval is pending, the rail links back to the
 *    main canvas without duplicating its Approve/Deny controls.
 * 3. The default external-agent state exposes a copyable suggested prompt and
 *    keeps the deterministic built-in demo as a secondary action.
 */

import React, { useMemo, useState } from "react";
import { Square, ShieldAlert, RotateCcw, Activity, Check } from "lucide-react";
import { buildToolReceipt, type BenchAgentState, type ToolReceipt } from "../../hooks/useBenchAgent";
import type { InvestigationPhase } from "@/domain/investigation/lifecycle";
import type { Hypothesis } from "@/domain/hypothesis/types";
import type { AgentMode } from "@/infrastructure/bench-agent/types";
import type { ToolLedgerEntry } from "@/domain/investigation/tool-ledger";
import type { ToolApprovalRequest } from "@/domain/safety/approval-gate";
export interface InvestigationNarrativeRailProps {
  readonly agentState: BenchAgentState;
  readonly investigationPhase?: InvestigationPhase;
  readonly hypothesis?: Hypothesis | null;
  readonly ledgerEntries?: readonly ToolLedgerEntry[];
  readonly pendingApproval?: ToolApprovalRequest | null;
  readonly agentMode?: AgentMode;
  readonly onSetGoal: (goal: string) => void;
  readonly onStartAgent: () => void;
  readonly onStopAgent: () => void;
  readonly onApprove?: () => void;
  readonly onDeny?: () => void;
  readonly onSwitchToDemo?: () => void;
  readonly onSelectScene?: (scene: "ready" | "observing" | "test-request" | "running" | "evidence" | "hypothesis" | "completed" | null) => void;
}

export function getNarrativeRailStatus(options: {
  readonly agentState: BenchAgentState;
  readonly investigationPhase?: InvestigationPhase;
  readonly hypothesis?: Hypothesis | null;
  readonly isIdle: boolean;
  readonly active: boolean;
  readonly isExternal?: boolean;
}): string {
  const { agentState, investigationPhase, hypothesis, isIdle, active, isExternal } = options;

  // 1. Terminal Verified status takes ultimate precedence
  if (investigationPhase === "verified") {
    return "COMPLETED";
  }

  // 2. Fatal / stopped / unavailable errors
  if (agentState.status === "failed" || investigationPhase === "failed") return "FAILED";
  if (agentState.status === "unavailable") return "UNAVAILABLE";
  if (agentState.status === "stopped" || investigationPhase === "stopped") return "STOPPED";

  // 3. Waiting for human interaction / intervention
  if (investigationPhase === "waiting_for_human") return "WAITING FOR YOU";

  // 4. Verification running or pending
  if (investigationPhase === "verification_running") return "VERIFICATION RUNNING";
  if (investigationPhase === "verification_pending") return "VERIFICATION PENDING";

  // 5. Semantic diagnosis formed takes precedence over agent sequence completion
  if (investigationPhase === "hypothesis" || hypothesis !== null) {
    return "DIAGNOSIS FORMED";
  }

  // 6. Approval gate
  if (agentState.status === "approval" || investigationPhase === "waiting_for_approval") {
    return "WAITING FOR APPROVAL";
  }

  // 7. Active experiment or analysis
  if (investigationPhase === "experiment_running") return "EXPERIMENT RUNNING";
  if (investigationPhase === "evidence_review" || investigationPhase === "reasoning") {
    return "ANALYZING EVIDENCE";
  }
  if (investigationPhase === "observing") return "INVESTIGATING";
  if (investigationPhase === "connecting") return "CONNECTING";

  if (
    investigationPhase === "welcome" ||
    investigationPhase === "challenge_ready" ||
    investigationPhase === "ready"
  ) {
    return isExternal ? "READY FOR YOUR AGENT" : isIdle ? "Ready" : "READY";
  }

  // 9. Agent completed execution when no pending semantic phase
  if (agentState.status === "completed") {
    return "COMPLETED";
  }

  if (active) return "Live";
  if (isIdle) return isExternal ? "READY FOR YOUR AGENT" : "Ready";
  return agentState.status.toUpperCase();
}

export const InvestigationNarrativeRail: React.FC<InvestigationNarrativeRailProps> = ({
  agentState,
  investigationPhase,
  hypothesis = null,
  ledgerEntries,
  pendingApproval,
  agentMode,
  onSetGoal,
  onStartAgent,
  onStopAgent,
  onSwitchToDemo,
  onSelectScene,
}) => {
  const effectiveAgentMode: AgentMode = agentMode ?? agentState.agentMode ?? "external";
  const activeLedgerEntry = ledgerEntries?.findLast(
    (entry) =>
      entry.status === "requested" ||
      entry.status === "waiting-approval" ||
      entry.status === "running"
  );
  const active =
    activeLedgerEntry !== undefined ||
    pendingApproval != null ||
    (ledgerEntries === undefined &&
      (agentState.status === "investigating" || agentState.status === "approval"));
  const isIdle =
    activeLedgerEntry === undefined &&
    pendingApproval == null &&
    (agentState.status === "idle" || agentState.status === "stopped");
  const currentGoal = agentState.goal || "The controller restarts when the fan turns on.";
  const suggestedPrompt =
    "The controller restarts unexpectedly whenever the cooling fan relay turns on. Investigate the root cause using the available WebMCP diagnostic instruments, request physical help when needed, and experimentally verify the repair.";


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
      case "read_reset_history":
        return "Reading reset history and reboot cause";
      case "read_system_health":
        return "Checking system health telemetry";
      case "measure_supply_voltage":
        return "Measuring baseline supply voltage";
      case "run_relay_stress_test":
        return "Testing whether relay load collapses MCU power";
      case "list_evidence":
        return "Reviewing empirical evidence records";
      case "get_evidence":
        return "Inspecting evidence record";
      case "propose_hypothesis":
        return "Synthesizing root cause hypothesis";
      case "update_hypothesis":
        return "Elevating hypothesis confidence after retest";
      case "link_evidence":
        return "Linking empirical evidence to hypothesis";
      case "confirm_hypothesis":
        return "Confirming verified root cause";
      case "reject_hypothesis":
        return "Rejecting disproven hypothesis";
      case "request_human_intervention":
        return "Requesting human-gated virtual DUT intervention";
      default:
        return toolName.replace(/_/g, " ");
    }
  };

  const completedEvents = useMemo(() => {
    const events: {
      id: string;
      title: string;
      tool: string;
      durationMs?: number;
      receipt: ToolReceipt;
      origin: ToolLedgerEntry["origin"];
      status: "completed" | "failed" | "denied";
    }[] = [];

    if (ledgerEntries !== undefined) {
      ledgerEntries.forEach((entry) => {
        if (
          entry.status !== "completed" &&
          entry.status !== "failed" &&
          entry.status !== "denied"
        ) {
          return;
        }
        const result =
          typeof entry.result === "string"
            ? entry.result
            : entry.result === undefined
            ? undefined
            : JSON.stringify(entry.result, null, 2);
        events.push({
          id: entry.id,
          title: getHumanToolName(entry.toolName),
          tool: entry.toolName,
          durationMs: entry.durationMs,
          receipt: buildToolReceipt({
            call: { id: entry.id, name: entry.toolName, arguments: entry.input },
            status: entry.status,
            result,
            message: entry.error,
            durationMs: entry.durationMs,
          }),
          origin: entry.origin,
          status: entry.status,
        });
      });
      return events;
    }

    agentState.activity.forEach((activity, index) => {
      if (
        activity.status === "completed" ||
        activity.status === "failed" ||
        activity.status === "denied"
      ) {
        events.push({
          id: `evt-${index}-${activity.call.name}`,
          title: getHumanToolName(activity.call.name),
          tool: activity.call.name,
          durationMs: activity.durationMs,
          receipt: buildToolReceipt(activity),
          origin: agentMode === "demo" ? "demo" : "groq",
          status: activity.status,
        });
      }
    });

    return events;
  }, [agentMode, agentState.activity, ledgerEntries]);

  const agentActiveTool =
    ledgerEntries === undefined && agentState.activity.length > 0
      ? agentState.activity[agentState.activity.length - 1]
      : null;
  const activeToolName = activeLedgerEntry?.toolName ?? agentActiveTool?.call.name;
  const activeToolInput = activeLedgerEntry?.input ?? agentActiveTool?.call.arguments ?? {};
  const isExecutingTool =
    activeLedgerEntry?.status === "requested" ||
    activeLedgerEntry?.status === "running" ||
    agentActiveTool?.status === "requested" ||
    agentActiveTool?.status === "running";
  const isWaitingApproval =
    pendingApproval != null ||
    activeLedgerEntry?.status === "waiting-approval" ||
    (ledgerEntries === undefined && agentState.status === "approval");
  const approvalToolName =
    pendingApproval?.toolName ??
    (ledgerEntries === undefined && agentState.status === "approval"
      ? agentState.approval.tool.name
      : activeLedgerEntry?.toolName);
  const approvalInput =
    pendingApproval?.input ??
    (ledgerEntries === undefined && agentState.status === "approval"
      ? agentState.approval.call?.arguments ?? (agentState.approval as unknown as { arguments?: Record<string, unknown> }).arguments
      : activeLedgerEntry?.input) ??
    {};

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
      {/* Header: Agent ● Status */}
      <div
        style={{
          padding: "1rem 1.25rem",
          borderBottom: "1px solid var(--ohmni-lab-border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: "var(--ohmni-lab-raised)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "9px" }}>
          <span
            aria-hidden="true"
            style={{
              width: "8px",
              height: "8px",
              borderRadius: "50%",
              background: active ? "var(--ohmni-lab-brand)" : "var(--ohmni-lab-verified)",
            }}
          />
          <div>
            <div style={{ fontSize: "13px", fontWeight: 750, color: "var(--ohmni-lab-text)", letterSpacing: "-0.01em" }}>
              {effectiveAgentMode === "demo" ? "Investigation log · Demo Agent" : "Investigation log"}
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
                  : investigationPhase === "verified"
                  ? "var(--ohmni-lab-verified)"
                  : agentState.status === "failed"
                  ? "var(--ohmni-lab-fault)"
                  : isWaitingApproval || investigationPhase === "waiting_for_human"
                  ? "var(--ohmni-lab-action)"
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
                    : investigationPhase === "verified"
                    ? "var(--ohmni-lab-verified)"
                    : agentState.status === "failed"
                    ? "var(--ohmni-lab-fault)"
                    : isWaitingApproval || investigationPhase === "waiting_for_human"
                    ? "var(--ohmni-lab-action)"
                    : (investigationPhase === "hypothesis" || hypothesis !== null)
                    ? "var(--ohmni-lab-brand)"
                    : "#94A3B8",
                }}
              />
              <span>
                {getNarrativeRailStatus({
                  agentState,
                  investigationPhase,
                  hypothesis,
                  isIdle,
                  active,
                  isExternal: agentMode === "external",
                })}
              </span>
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
          padding: "1.25rem",
          display: "flex",
          flexDirection: "column",
          gap: "1.25rem",
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
                background: "transparent",
                border: "1px solid rgba(18, 21, 26, 0.16)",
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
                background: "transparent",
                padding: "0.75rem 0.85rem",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--ohmni-lab-border)",
              }}
            >
              {goalText}
            </div>
          )}
        </div>

        {agentMode === "external" && isIdle && completedEvents.length === 0 && (
          <div
            data-testid="agent-ready-prompt"
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "10px",
              padding: "1rem",
              borderRadius: "var(--radius-md)",
              border: "1px solid rgba(73, 103, 255, 0.3)",
              background: "rgba(73, 103, 255, 0.05)",
            }}
          >
            <div
              className="font-mono"
              style={{
                fontSize: "10.5px",
                fontWeight: 800,
                color: "var(--ohmni-lab-brand)",
                letterSpacing: "0.06em",
              }}
            >
              READY FOR YOUR AGENT
            </div>
            <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--ohmni-lab-muted)" }}>
              SUGGESTED PROMPT
            </div>
            <p
              data-testid="suggested-agent-prompt"
              style={{
                margin: 0,
                fontSize: "12.5px",
                lineHeight: 1.5,
                color: "var(--ohmni-lab-text)",
              }}
            >
              {suggestedPrompt}
            </p>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <button
                type="button"
                data-testid="copy-agent-prompt"
                className="btn-primary"
                onClick={() => {
                  void navigator.clipboard.writeText(suggestedPrompt);
                  setCopied(true);
                  window.setTimeout(() => setCopied(false), 2000);
                }}
                style={{ padding: "7px 12px", fontSize: "12px", fontWeight: 700 }}
              >
                {copied ? "Copied" : "Copy prompt"}
              </button>
              {onSwitchToDemo && (
                <button
                  type="button"
                  data-testid="try-built-in-demo"
                  className="btn-secondary"
                  onClick={onSwitchToDemo}
                  style={{ padding: "7px 12px", fontSize: "12px", fontWeight: 650 }}
                >
                  Try built-in demo
                </button>
              )}
            </div>
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
              data-testid="waiting-approval-notice"
              id="waiting-approval-notice"
              onClick={() => onSelectScene?.(null)}
              style={{
                background: "rgba(255, 181, 74, 0.08)",
                border: "1px solid rgba(255, 181, 74, 0.35)",
                borderRadius: "var(--radius-md)",
                padding: "1rem 1.15rem",
                display: "flex",
                flexDirection: "column",
                gap: "6px",
                cursor: "pointer",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "var(--ohmni-lab-action)", fontSize: "11px", fontWeight: 700 }}>
                <ShieldAlert size={14} />
                <span>AUTHORIZATION REQUIRED</span>
              </div>
              <div style={{ fontSize: "13.5px", fontWeight: 700, color: "var(--ohmni-lab-text)" }}>
                {getHumanToolName(approvalToolName ?? "run_relay_stress_test")}
              </div>
              <div className="font-mono" style={{ fontSize: "10.5px", color: "var(--ohmni-lab-muted)" }}>
                {approvalToolName ?? "run_relay_stress_test"}
              </div>
              <pre style={{ margin: 0, fontSize: "10px", whiteSpace: "pre-wrap", color: "var(--ohmni-lab-muted)" }}>
                {JSON.stringify(approvalInput, null, 2)}
              </pre>
              <p style={{ margin: "4px 0 0", fontSize: "12px", color: "var(--ohmni-lab-muted)", lineHeight: 1.4 }}>
                Review safety envelope and authorize test in the main canvas.
              </p>
            </div>
          </div>
        ) : active && activeToolName && isExecutingTool ? (
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
                {getHumanToolName(activeToolName)}
              </div>
              <div className="font-mono" style={{ fontSize: "10.5px", color: "var(--ohmni-lab-muted)" }}>
                {activeToolName}
              </div>
              <pre style={{ margin: 0, fontSize: "10px", whiteSpace: "pre-wrap", color: "var(--ohmni-lab-muted)" }}>
                {JSON.stringify(activeToolInput, null, 2)}
              </pre>
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
            <span>INVESTIGATION RECORD</span>
            {completedEvents.length > 0 && <span>({completedEvents.length})</span>}
          </div>

          {completedEvents.length === 0 && !active && (
            <div style={{ fontSize: "12px", color: "var(--ohmni-lab-muted)", fontStyle: "italic", padding: "4px 0" }}>
              Start the investigation to record instrument calls and evidence.
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
                onClick={() => {
                  if (evt.tool.includes("reset") || evt.tool.includes("history")) {
                    onSelectScene?.("observing");
                  } else if (evt.tool.includes("relay") || evt.tool.includes("stress")) {
                    onSelectScene?.("running");
                  } else if (evt.tool.includes("hypothesis")) {
                    onSelectScene?.("hypothesis");
                  } else if (evt.tool.includes("evidence") || evt.tool.includes("measure")) {
                    onSelectScene?.("evidence");
                  }
                }}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "10px",
                  padding: "6px 0",
                  position: "relative",
                  cursor: onSelectScene ? "pointer" : "default",
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
                  {evt.status === "completed" ? (
                    <Check size={11} color="var(--ohmni-lab-verified)" strokeWidth={3} />
                  ) : (
                    <span
                      style={{
                        width: "7px",
                        height: "7px",
                        borderRadius: "50%",
                        background: "var(--ohmni-lab-fault)",
                      }}
                    />
                  )}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "4px", minWidth: 0 }}>
                  <span style={{ fontSize: "12.5px", fontWeight: 600, color: "var(--ohmni-lab-text)" }}>
                    {evt.title}
                  </span>
                  <span className="font-mono" style={{ fontSize: "10px", color: "var(--ohmni-lab-muted)" }}>
                    {evt.tool}
                  </span>
                  <span
                    className="font-mono"
                    style={{
                      fontSize: "9.5px",
                      fontWeight: 700,
                      color:
                        evt.status === "completed"
                          ? "var(--ohmni-lab-verified)"
                          : "var(--ohmni-lab-fault)",
                    }}
                  >
                    {evt.origin.toUpperCase()} · {evt.status.toUpperCase()}
                    {evt.durationMs !== undefined ? ` · ${evt.durationMs} ms` : ""}
                  </span>
                  <pre style={{ margin: 0, fontSize: "9.5px", lineHeight: 1.35, whiteSpace: "pre-wrap", overflowWrap: "anywhere", color: "var(--ohmni-lab-muted)" }}>
                    {evt.receipt.argumentsText}
                  </pre>
                  {evt.receipt.stateChanges.map((change) => (
                    <span key={change} style={{ fontSize: "10px", color: "var(--ohmni-lab-text)" }}>{change}</span>
                  ))}
                  {evt.receipt.experimentId && (
                    <span className="font-mono" style={{ fontSize: "9.5px", color: "var(--ohmni-lab-brand)" }}>
                      Experiment: {evt.receipt.experimentId}
                    </span>
                  )}
                  {evt.receipt.evidenceIds.length > 0 && (
                    <span className="font-mono" style={{ fontSize: "9.5px", color: "var(--ohmni-lab-brand)" }}>
                      Evidence: {evt.receipt.evidenceIds.join(", ")}
                    </span>
                  )}
                  {evt.receipt.resultText && (
                    <span
                      data-testid="tool-result-summary"
                      style={{
                        fontSize: "10px",
                        lineHeight: 1.35,
                        color: "var(--ohmni-lab-text)",
                        overflowWrap: "anywhere",
                      }}
                    >
                      {evt.receipt.resultText.length > 160
                        ? `${evt.receipt.resultText.slice(0, 157)}…`
                        : evt.receipt.resultText}
                    </span>
                  )}
                  {evt.receipt.resultText && (
                    <details>
                      <summary style={{ fontSize: "9.5px", cursor: "pointer", color: "var(--ohmni-lab-muted)" }}>Raw factual result</summary>
                      <pre style={{ margin: "4px 0 0", maxHeight: "8rem", overflow: "auto", whiteSpace: "pre-wrap", overflowWrap: "anywhere", fontSize: "9px", color: "var(--ohmni-lab-muted)" }}>
                        {evt.receipt.resultText}
                      </pre>
                    </details>
                  )}
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
                    {approvalToolName ?? "run_relay_stress_test"}
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
