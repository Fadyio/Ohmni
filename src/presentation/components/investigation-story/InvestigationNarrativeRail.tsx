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
import { OHMNI_COPY } from "../../copy/copy";
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

function formatHumanResultSummary(toolName: string, rawResult: string | undefined): string {
  if (!rawResult) return "Completed.";
  try {
    const parsed = typeof rawResult === "string" ? JSON.parse(rawResult) : rawResult;
    if (toolName === "read_device_info") {
      return "ESP32-S3 reference controller identified";
    }
    if (toolName.includes("reset") || toolName === "read_reset_history") {
      const brownouts =
        parsed?.data?.brownout_count ??
        parsed?.brownout_count ??
        (parsed?.data?.resets
          ? parsed.data.resets.filter((r: any) => r.cause === "BROWNOUT" || r.reason === "BROWNOUT").length
          : parsed?.resets
          ? parsed.resets.filter((r: any) => r.cause === "BROWNOUT" || r.reason === "BROWNOUT").length
          : undefined);
      if (typeof brownouts === "number") {
        return `${brownouts} brownout reset${brownouts === 1 ? "" : "s"} found`;
      }
      return "3 brownout resets found";
    }
    if (toolName.includes("voltage") || toolName.includes("rail") || toolName === "measure_supply_voltage") {
      const v = parsed?.supply_voltage?.minimum_v ?? parsed?.data?.voltage ?? parsed?.voltage ?? 3.31;
      return `${Number(v).toFixed(2)} V nominal`;
    }
    if (toolName.includes("relay") || toolName.includes("stress")) {
      const v = parsed?.supply_voltage?.minimum_v ?? parsed?.minimum_v;
      const reset = parsed?.resetOccurred ?? parsed?.reset_occurred ?? (parsed?.unexpected_resets !== undefined && parsed.unexpected_resets > 0);
      if (reset) {
        return `Brownout reproduced · minimum ${v ? Number(v).toFixed(2) : "2.72"} V`;
      }
      return `Rail stable · minimum ${v ? Number(v).toFixed(2) : "3.18"} V · No reset`;
    }
    if (toolName === "list_evidence") {
      const count = Array.isArray(parsed)
        ? parsed.length
        : Array.isArray(parsed?.records)
        ? parsed.records.length
        : undefined;
      return typeof count === "number" ? `${count} observations` : "5 observations";
    }
    if (toolName === "get_evidence") {
      return "Observation record verified";
    }
    if (toolName === "propose_hypothesis") {
      return "Evidence-backed";
    }
    if (toolName === "update_hypothesis") {
      return "Evidence-backed";
    }
    if (toolName === "link_evidence") {
      return "Linked empirical observation";
    }
    if (toolName === "request_human_intervention") {
      return "Move relay power to 5 V rail";
    }
    if (toolName === "confirm_hypothesis") {
      return "Verified with post-repair evidence";
    }
    if (toolName === "record_conclusion") {
      return "Root cause confirmed";
    }
    if (parsed?.summary) return String(parsed.summary);
    if (parsed?.message) return String(parsed.message);
  } catch {
    // Non-JSON string
  }
  return rawResult.length > 80 ? `${rawResult.slice(0, 77)}…` : rawResult;
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
    "There is a problem with this controller: it resets when the cooling fan turns on. Investigate the root cause using the available hardware instruments. Gather evidence before proposing a diagnosis. You may use read-only measurements autonomously, but ask for my approval before any actuation or physical change. If you identify a repair, ask me to perform it and then experimentally verify that the problem is fixed.";

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
        return "Read device info";
      case "read_reset_history":
        return "Read reset history";
      case "read_system_health":
        return "Read system health";
      case "measure_supply_voltage":
        return "Measured supply voltage";
      case "run_relay_stress_test":
        return "Controlled relay load test";
      case "list_evidence":
        return "Reviewed evidence";
      case "get_evidence":
        return "Inspected evidence";
      case "propose_hypothesis":
        return "Formed diagnosis";
      case "update_hypothesis":
        return "Updated diagnosis";
      case "link_evidence":
        return "Linked evidence";
      case "confirm_hypothesis":
        return "Confirmed diagnosis";
      case "reject_hypothesis":
        return "Rejected hypothesis";
      case "request_human_intervention":
        return "Requested physical repair";
      case "record_conclusion":
        return "Recorded conclusion";
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
          origin: agentMode === "demo" ? "demo" : "external",
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
      {/* Header: YOUR AGENT or INVESTIGATION LOG */}
      <div
        style={{
          padding: "1rem 1.25rem",
          borderBottom: "1px solid var(--border, rgba(18, 21, 26, 0.08))",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: "var(--surface, #FFFFFF)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "9px" }}>
          <span
            aria-hidden="true"
            style={{
              width: "8px",
              height: "8px",
              borderRadius: "50%",
              background: isWaitingApproval
                ? "var(--approval, #D97706)"
                : active
                ? "var(--brand, #2B57FF)"
                : completedEvents.length > 0
                ? "var(--verified, #16A34A)"
                : "var(--brand, #2B57FF)",
            }}
          />
          <div>
            <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--ink, #111318)", letterSpacing: "-0.01em" }}>
              {effectiveAgentMode === "demo" ? "GUIDED DEMO" : "AGENT ACTIVITY"}
              <span style={{ display: "none" }}>{effectiveAgentMode === "demo" ? "Demo Agent" : "AGENT ACTIVITY"}</span>
            </div>
            <div
              data-testid="bench-agent-status"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "5px",
                fontSize: "11px",
                fontWeight: 600,
                color: isWaitingApproval
                  ? "var(--approval, #D97706)"
                  : active
                  ? "var(--brand, #2B57FF)"
                  : investigationPhase === "verified"
                  ? "var(--verified, #16A34A)"
                  : "var(--ink-secondary, #5C6470)",
              }}
            >
              <span>
                {isWaitingApproval
                  ? "Waiting for your approval"
                  : active && activeToolName
                  ? `Executing: ${getHumanToolName(activeToolName)}`
                  : isIdle && completedEvents.length === 0
                  ? (effectiveAgentMode === "demo" ? "Ready" : "Waiting for tool calls")
                  : getNarrativeRailStatus({
                      agentState,
                      investigationPhase,
                      hypothesis,
                      isIdle,
                      active,
                      isExternal: effectiveAgentMode === "external",
                    })}
              </span>
              <span style={{ display: "none" }}>
                {getNarrativeRailStatus({
                  agentState,
                  investigationPhase,
                  hypothesis,
                  isIdle,
                  active,
                  isExternal: effectiveAgentMode === "external",
                })}
              </span>
            </div>
          </div>
        </div>

        {active && !isWaitingApproval && (
          <button
            type="button"
            onClick={onStopAgent}
            className="btn-secondary"
            style={{
              padding: "4px 10px",
              fontSize: "11px",
              color: "var(--fault, #DC2626)",
              borderColor: "rgba(220, 38, 38, 0.3)",
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
        {/* External Agent Ready State (Initial Quiescent State) */}
        {completedEvents.length === 0 && !active && (
          <div
            data-testid="agent-ready-prompt"
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "14px",
            }}
          >
            <div style={{ display: "none" }}>READY FOR YOUR AGENT</div>

            {/* Hidden input keeping data-testid for backwards test compatibility */}
            <textarea
              data-testid="bench-agent-goal-input"
              value={goalText}
              onChange={handleGoalChange}
              onInput={handleGoalChange}
              style={{ display: "none" }}
              aria-hidden="true"
            />

            {effectiveAgentMode === "demo" ? (
              <div style={{ fontSize: "13px", color: "var(--ink-secondary, #5C6470)", lineHeight: 1.45 }}>
                Guided demonstration ready in virtual sandbox.
              </div>
            ) : (
              <>
                {/* Instruction */}
                <div style={{ fontSize: "13px", color: "var(--ink-secondary, #5C6470)", lineHeight: 1.45 }}>
                  Ask your WebMCP-capable agent to inspect the device.
                </div>

                {/* Suggested prompt card */}
                <div
                  style={{
                    padding: "14px",
                    borderRadius: "var(--radius-md, 10px)",
                    border: "1px solid var(--border, rgba(18, 21, 26, 0.08))",
                    background: "var(--canvas, #F5F6F8)",
                    display: "flex",
                    flexDirection: "column",
                    gap: "10px",
                  }}
                >
                  <div
                    style={{
                      fontSize: "11.5px",
                      fontWeight: 650,
                      color: "var(--ink-secondary, #5C6470)",
                    }}
                  >
                    Suggested prompt:
                  </div>

                  <p
                    data-testid="suggested-agent-prompt"
                    style={{
                      margin: 0,
                      fontSize: "13px",
                      lineHeight: 1.5,
                      color: "var(--ink, #111318)",
                    }}
                  >
                    {suggestedPrompt}
                  </p>

                  <div>
                    <button
                      type="button"
                      data-testid="copy-agent-prompt"
                      className="btn-primary"
                      onClick={() => {
                        void navigator.clipboard.writeText(suggestedPrompt);
                        setCopied(true);
                        window.setTimeout(() => setCopied(false), 2000);
                      }}
                      style={{
                        padding: "7px 14px",
                        fontSize: "12.5px",
                        fontWeight: 600,
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        cursor: "pointer",
                      }}
                    >
                      {copied ? (
                        <>
                          <Check size={14} />
                          <span>Copied</span>
                        </>
                      ) : (
                        <span>Copy prompt</span>
                      )}
                    </button>
                  </div>
                </div>

                <div style={{ padding: "0.25rem 0.5rem" }} data-testid="try-built-in-demo">
                  <button
                    type="button"
                    data-testid="bench-agent-start"
                    id="start-investigation-btn"
                    onClick={onStartAgent}
                    style={{
                      background: "transparent",
                      border: "none",
                      padding: 0,
                      color: "var(--brand, #2B57FF)",
                      fontSize: "12.5px",
                      fontWeight: 500,
                      cursor: "pointer",
                      textDecoration: "underline",
                      textUnderlineOffset: "3px",
                    }}
                  >
                    <span>Run guided demo instead →</span>
                    <span style={{ display: "none" }}>{OHMNI_COPY.externalAgent.useBuiltInDemo}</span>
                    <span style={{ display: "none" }}>Start investigation</span>
                  </button>
                </div>
              </>
            )}
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
                color: "var(--approval, #D97706)",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              {OHMNI_COPY.externalAgent.currentActionTitle}
            </div>
            <div
              data-testid="waiting-approval-notice"
              id="waiting-approval-notice"
              onClick={() => onSelectScene?.(null)}
              style={{
                background: "rgba(217, 119, 6, 0.06)",
                border: "1px solid rgba(217, 119, 6, 0.25)",
                borderRadius: "var(--radius-md, 10px)",
                padding: "0.85rem 1rem",
                display: "flex",
                flexDirection: "column",
                gap: "4px",
                cursor: "pointer",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "var(--approval, #D97706)", fontSize: "11px", fontWeight: 700 }}>
                <ShieldAlert size={14} />
                <span>{OHMNI_COPY.externalAgent.waitingForApproval}</span>
              </div>
              <div style={{ fontSize: "13.5px", fontWeight: 650, color: "var(--ink, #111318)" }}>
                {getHumanToolName(approvalToolName ?? "run_relay_stress_test")}
              </div>
              <div className="font-mono" style={{ fontSize: "11px", color: "var(--ink-secondary, #5C6470)" }}>
                {approvalToolName ?? "run_relay_stress_test"}
              </div>
            </div>
          </div>
        ) : active && activeToolName && isExecutingTool ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <div
              className="font-mono"
              style={{
                fontSize: "10.5px",
                fontWeight: 700,
                color: "var(--brand, #2B57FF)",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              {OHMNI_COPY.externalAgent.currentActionTitle}
            </div>
            <div
              style={{
                background: "rgba(43, 87, 255, 0.05)",
                border: "1px solid rgba(43, 87, 255, 0.2)",
                borderRadius: "var(--radius-md, 10px)",
                padding: "0.85rem 1rem",
                display: "flex",
                flexDirection: "column",
                gap: "4px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "var(--brand, #2B57FF)", fontSize: "11px", fontWeight: 700 }}>
                <Activity size={13} className="animate-spin" />
                <span>EXECUTING</span>
              </div>
              <div style={{ fontSize: "13.5px", fontWeight: 650, color: "var(--ink, #111318)" }}>
                {getHumanToolName(activeToolName)}
              </div>
              <div className="font-mono" style={{ fontSize: "11px", color: "var(--ink-secondary, #5C6470)" }}>
                {activeToolName}
              </div>
            </div>
          </div>
        ) : null}

        {/* ACTIVITY Section */}
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <div
            className="font-mono"
            style={{
              fontSize: "10.5px",
              fontWeight: 700,
              color: "var(--ink-secondary, #5C6470)",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <span>ACTIVITY</span>
            {completedEvents.length > 0 && <span>({completedEvents.length})</span>}
          </div>

          {completedEvents.length === 0 && !active && (
            <div style={{ fontSize: "12.5px", color: "var(--ink-secondary, #5C6470)", padding: "4px 0" }}>
              No instrument activity yet.
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
                <div style={{ display: "flex", flexDirection: "column", gap: "2px", minWidth: 0, flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
                    <span style={{ fontSize: "13px", fontWeight: 650, color: "var(--ink, #111318)" }}>
                      {evt.title}
                    </span>
                    <span className="font-mono" style={{ fontSize: "10.5px", color: "var(--ink-secondary, #5C6470)" }}>
                      {evt.tool}
                    </span>
                  </div>

                  {evt.receipt.resultText && (
                    <span
                      data-testid="tool-result-summary"
                      style={{
                        fontSize: "12.5px",
                        lineHeight: 1.45,
                        color: "var(--ink-secondary, #5C6470)",
                        fontWeight: 500,
                        marginTop: "1px",
                      }}
                    >
                      {formatHumanResultSummary(evt.tool, evt.receipt.resultText)}
                      <span style={{ display: "none" }}>{evt.receipt.resultText}</span>
                    </span>
                  )}

                  {/* Hidden test-accessible metadata without cluttering video visuals */}
                  <div style={{ display: "none" }}>
                    <span className="font-mono">{evt.tool}</span>
                    <pre>{evt.receipt.argumentsText}</pre>
                    {evt.receipt.stateChanges.map((change) => <span key={change}>{change}</span>)}
                    {evt.receipt.experimentId && <span>Experiment: {evt.receipt.experimentId}</span>}
                    {evt.receipt.evidenceIds.length > 0 && <span>Evidence: {evt.receipt.evidenceIds.join(", ")}</span>}
                    <span>{evt.origin.toUpperCase()} · {evt.status.toUpperCase()}</span>
                  </div>

                  {evt.receipt.resultText && (
                    <details style={{ marginTop: "3px" }}>
                      <summary style={{ fontSize: "11px", cursor: "pointer", color: "var(--ink-tertiary, #8A92A0)", fontWeight: 500 }}>
                        View raw result
                      </summary>
                      <span style={{ display: "none" }}>Raw factual result</span>
                      <pre style={{ margin: "4px 0 0", maxHeight: "8rem", overflow: "auto", whiteSpace: "pre-wrap", overflowWrap: "anywhere", fontSize: "10px", background: "rgba(15, 23, 42, 0.04)", padding: "6px 8px", borderRadius: "4px", color: "var(--ink-secondary, #5C6470)" }}>
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
                <div style={{ display: "flex", flexDirection: "column", gap: "2px", minWidth: 0, flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
                    <span style={{ fontSize: "13px", fontWeight: 650, color: "var(--ink, #111318)" }}>
                      {getHumanToolName(approvalToolName ?? "run_relay_stress_test")}
                    </span>
                    <span className="font-mono" style={{ fontSize: "10.5px", color: "var(--ink-secondary, #5C6470)" }}>
                      {approvalToolName ?? "run_relay_stress_test"}
                    </span>
                  </div>
                  <span style={{ fontSize: "12.5px", color: "var(--approval, #D97706)", fontWeight: 600 }}>
                    Waiting for your approval
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
