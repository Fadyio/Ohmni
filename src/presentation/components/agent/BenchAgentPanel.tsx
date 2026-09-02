import React from "react";
import { Check, Play, ShieldAlert, Square, X } from "lucide-react";
import type {
  BenchAgentActivity,
  BenchAgentActivityStatus,
  BenchAgentState,
} from "@/presentation/hooks/useBenchAgent";
import { useBenchAgent } from "@/presentation/hooks/useBenchAgent";

export interface BenchAgentPanelProps {
  readonly isConnected: boolean;
}

const statusLabels: Record<BenchAgentState["status"], string> = {
  idle: "IDLE",
  investigating: "INVESTIGATING",
  approval: "WAITING FOR HUMAN",
  completed: "COMPLETED",
  stopped: "STOPPED",
  unavailable: "BENCH AGENT UNAVAILABLE",
  failed: "FAILED",
  "step-limit": "STEP LIMIT",
};

const activityLabels: Record<BenchAgentActivityStatus, string> = {
  requested: "REQUESTED",
  "waiting-approval": "AWAITING APPROVAL",
  completed: "COMPLETED",
  unavailable: "UNAVAILABLE",
  denied: "DENIED",
  failed: "FAILED",
};

const activityColors: Record<BenchAgentActivityStatus, string> = {
  requested: "var(--ohmni-accent)",
  "waiting-approval": "var(--ohmni-warning)",
  completed: "var(--ohmni-success)",
  unavailable: "var(--ohmni-text-muted)",
  denied: "var(--ohmni-warning)",
  failed: "var(--ohmni-fault)",
};

function formatArguments(value: Record<string, unknown>): string {
  return JSON.stringify(value, null, 2) ?? "{}";
}

function ActivityRow({ activity }: { readonly activity: BenchAgentActivity }) {
  const detail = activity.result ?? activity.message;
  return (
    <li
      data-testid="bench-agent-activity-row"
      style={{
        display: "grid",
        gridTemplateColumns: "14px minmax(0, 1fr)",
        gap: "0.5rem",
        padding: "0.5rem 0",
        borderBottom: "1px solid var(--ohmni-border-subtle)",
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: "7px",
          height: "7px",
          marginTop: "5px",
          borderRadius: "var(--radius-full)",
          background: activityColors[activity.status],
          boxShadow: `0 0 7px ${activityColors[activity.status]}`,
        }}
      />
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            gap: "0.5rem",
          }}
        >
          <strong
            className="font-mono"
            style={{
              minWidth: 0,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              color: "var(--ohmni-text-primary)",
              fontSize: "0.6875rem",
            }}
            title={activity.call.name}
          >
            {activity.call.name}
          </strong>
          <span
            className="font-mono"
            style={{
              flex: "none",
              color: activityColors[activity.status],
              fontSize: "0.53125rem",
              fontWeight: 700,
              letterSpacing: "0.04em",
            }}
          >
            {activity.durationMs === undefined
              ? activityLabels[activity.status]
              : `${activityLabels[activity.status]} · ${activity.durationMs}ms`}
          </span>
        </div>
        <pre
          style={{
            marginTop: "0.25rem",
            color: "var(--ohmni-text-muted)",
            fontFamily: "var(--font-mono)",
            fontSize: "0.59375rem",
            lineHeight: 1.35,
            whiteSpace: "pre-wrap",
            overflowWrap: "anywhere",
          }}
        >
          {formatArguments(activity.call.arguments)}
        </pre>
        {detail && (
          <div
            className="font-mono"
            style={{
              marginTop: "0.25rem",
              paddingLeft: "0.5rem",
              borderLeft: `2px solid ${activityColors[activity.status]}`,
              color:
                activity.status === "failed"
                  ? "var(--ohmni-fault)"
                  : "var(--ohmni-text-secondary)",
              fontSize: "0.59375rem",
              lineHeight: 1.35,
              whiteSpace: "pre-wrap",
              overflowWrap: "anywhere",
            }}
          >
            {detail}
          </div>
        )}
      </div>
    </li>
  );
}

export const BenchAgentPanel: React.FC<BenchAgentPanelProps> = ({ isConnected }) => {
  const { state, setGoal, start, stop, approve, deny } = useBenchAgent(isConnected);
  const active = state.status === "investigating" || state.status === "approval";
  const canStart =
    state.providerAvailable &&
    state.goal.trim().length > 0 &&
    !active;
  const statusColor =
    state.status === "approval"
      ? "var(--ohmni-warning)"
      : state.status === "failed"
        ? "var(--ohmni-fault)"
        : state.status === "completed"
          ? "var(--ohmni-success)"
          : state.status === "investigating"
            ? "var(--ohmni-accent)"
            : "var(--ohmni-text-muted)";

  return (
    <section
      data-testid="bench-agent-panel"
      aria-labelledby="bench-agent-title"
      style={{
        height: "100%",
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
        background: "var(--ohmni-surface)",
        borderLeft: "1px solid var(--ohmni-border)",
        borderBottom: "1px solid var(--ohmni-border)",
        overflow: "hidden",
      }}
    >
      <header
        style={{
          flex: "none",
          padding: "0.625rem 0.75rem",
          background: "var(--ohmni-surface-raised)",
          borderBottom: "1px solid var(--ohmni-border)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.75rem" }}>
          <div>
            <div className="label-technical" style={{ color: "var(--ohmni-accent)", fontSize: "0.5625rem" }}>
              OPERATE
            </div>
            <h2
              id="bench-agent-title"
              style={{
                margin: 0,
                color: "var(--ohmni-text-primary)",
                fontSize: "0.8125rem",
                lineHeight: 1.2,
                letterSpacing: "0.03em",
              }}
            >
              BENCH AGENT
            </h2>
          </div>
          <div
            data-testid="bench-agent-status"
            role="status"
            aria-live="polite"
            className="font-mono"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.375rem",
              color: statusColor,
              fontSize: "0.5625rem",
              fontWeight: 700,
              letterSpacing: "0.05em",
              textAlign: "right",
            }}
          >
            <span
              aria-hidden="true"
              style={{
                width: "6px",
                height: "6px",
                borderRadius: "var(--radius-full)",
                background: statusColor,
              }}
            />
            {statusLabels[state.status]}
          </div>
        </div>
      </header>

      <div
        style={{
          minHeight: 0,
          flex: 1,
          display: "flex",
          flexDirection: "column",
          gap: "0.625rem",
          padding: "0.625rem 0.75rem 0.75rem",
          overflowY: "auto",
        }}
      >
        <div style={{ flex: "none" }}>
          <label
            htmlFor="bench-agent-goal"
            className="label-technical"
            style={{ display: "block", marginBottom: "0.25rem", fontSize: "0.5625rem" }}
          >
            GOAL
          </label>
          <textarea
            id="bench-agent-goal"
            data-testid="bench-agent-goal-input"
            value={state.goal}
            onChange={(event) => setGoal(event.target.value)}
            onKeyDown={(event) => {
              if ((event.metaKey || event.ctrlKey) && event.key === "Enter" && canStart) {
                event.preventDefault();
                start();
              }
            }}
            disabled={active || state.status === "unavailable"}
            rows={2}
            placeholder="Describe the diagnostic objective…"
            style={{
              width: "100%",
              resize: "none",
              border: "1px solid var(--ohmni-border)",
              borderRadius: "var(--radius-sm)",
              background: "var(--ohmni-bg)",
              color: "var(--ohmni-text-primary)",
              padding: "0.4375rem 0.5rem",
              fontFamily: "var(--font-sans)",
              fontSize: "0.6875rem",
              lineHeight: 1.35,
            }}
          />
          <div style={{ display: "flex", gap: "0.375rem", marginTop: "0.375rem" }}>
            {!active ? (
              <button
                type="button"
                data-testid="bench-agent-start"
                onClick={start}
                disabled={!canStart}
                style={{
                  flex: 1,
                  minHeight: "28px",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "0.375rem",
                  border: "1px solid var(--ohmni-accent-dim)",
                  borderRadius: "var(--radius-sm)",
                  background: canStart ? "var(--ohmni-accent-glow)" : "transparent",
                  color: canStart ? "var(--ohmni-accent)" : "var(--ohmni-text-disabled)",
                  fontFamily: "var(--font-mono)",
                  fontSize: "0.59375rem",
                  fontWeight: 700,
                  letterSpacing: "0.04em",
                  cursor: canStart ? "pointer" : "not-allowed",
                }}
              >
                <Play size={11} aria-hidden="true" />
                START AGENT
              </button>
            ) : (
              <button
                type="button"
                data-testid="bench-agent-stop"
                onClick={stop}
                style={{
                  flex: 1,
                  minHeight: "28px",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "0.375rem",
                  border: "1px solid var(--ohmni-fault-dim)",
                  borderRadius: "var(--radius-sm)",
                  background: "var(--ohmni-fault-glow)",
                  color: "var(--ohmni-fault)",
                  fontFamily: "var(--font-mono)",
                  fontSize: "0.59375rem",
                  fontWeight: 700,
                  letterSpacing: "0.04em",
                  cursor: "pointer",
                }}
              >
                <Square size={10} aria-hidden="true" />
                STOP AGENT
              </button>
            )}
          </div>
        </div>

        {state.status === "unavailable" && (
          <div
            role="alert"
            style={{
              padding: "0.625rem",
              border: "1px solid var(--ohmni-warning-dim)",
              borderRadius: "var(--radius-md)",
              background: "var(--ohmni-warning-glow)",
            }}
          >
            <div
              className="font-mono"
              style={{ color: "var(--ohmni-warning)", fontSize: "0.625rem", fontWeight: 700 }}
            >
              BENCH AGENT UNAVAILABLE
            </div>
            <p style={{ marginTop: "0.25rem", color: "var(--ohmni-text-secondary)", fontSize: "0.65625rem" }}>
              Gemini API key is not configured.
            </p>
          </div>
        )}

        {state.status === "failed" && (
          <div
            role="alert"
            style={{
              padding: "0.5rem 0.625rem",
              borderLeft: "2px solid var(--ohmni-fault)",
              background: "var(--ohmni-fault-glow)",
              color: "var(--ohmni-fault)",
              fontSize: "0.65625rem",
            }}
          >
            {state.message}
          </div>
        )}

        {state.status === "approval" && (
          <div
            data-testid="bench-agent-approval"
            role="alert"
            style={{
              flex: "none",
              padding: "0.625rem",
              border: "1px solid var(--ohmni-warning)",
              borderRadius: "var(--radius-md)",
              background: "var(--ohmni-warning-glow)",
              boxShadow: "0 0 14px var(--ohmni-warning-glow)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.375rem", color: "var(--ohmni-warning)" }}>
              <ShieldAlert size={14} aria-hidden="true" />
              <strong className="font-mono" style={{ fontSize: "0.625rem", letterSpacing: "0.04em" }}>
                WAITING FOR HUMAN
              </strong>
            </div>
            <div className="label-technical" style={{ marginTop: "0.5rem", fontSize: "0.53125rem" }}>
              TOOL
            </div>
            <div className="font-mono" style={{ color: "var(--ohmni-text-primary)", fontSize: "0.6875rem", fontWeight: 700 }}>
              {state.approval.tool.name}
            </div>
            <div className="label-technical" style={{ marginTop: "0.375rem", fontSize: "0.53125rem" }}>
              ARGUMENTS
            </div>
            <pre
              style={{
                maxHeight: "92px",
                overflow: "auto",
                marginTop: "0.1875rem",
                padding: "0.375rem",
                borderRadius: "var(--radius-sm)",
                background: "var(--ohmni-bg)",
                color: "var(--ohmni-text-secondary)",
                fontFamily: "var(--font-mono)",
                fontSize: "0.59375rem",
                lineHeight: 1.35,
                whiteSpace: "pre-wrap",
                overflowWrap: "anywhere",
              }}
            >
              {formatArguments(state.approval.call.arguments)}
            </pre>
            <div style={{ display: "grid", gridTemplateColumns: "0.72fr 1.28fr", gap: "0.375rem", marginTop: "0.5rem" }}>
              <button
                type="button"
                data-testid="bench-agent-deny"
                onClick={deny}
                style={{
                  minHeight: "30px",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "0.25rem",
                  border: "1px solid var(--ohmni-border)",
                  borderRadius: "var(--radius-sm)",
                  background: "var(--ohmni-surface-raised)",
                  color: "var(--ohmni-text-secondary)",
                  fontFamily: "var(--font-mono)",
                  fontSize: "0.5625rem",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                <X size={11} aria-hidden="true" />
                DENY
              </button>
              <button
                type="button"
                data-testid="bench-agent-approve"
                onClick={approve}
                style={{
                  minHeight: "30px",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "0.25rem",
                  border: "1px solid var(--ohmni-warning)",
                  borderRadius: "var(--radius-sm)",
                  background: "var(--ohmni-warning-glow)",
                  color: "var(--ohmni-warning)",
                  fontFamily: "var(--font-mono)",
                  fontSize: "0.5625rem",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                <Check size={11} aria-hidden="true" />
                APPROVE VIRTUAL TEST
              </button>
            </div>
          </div>
        )}

        {state.activity.length > 0 && (
          <div style={{ flex: "none" }}>
            <div className="label-technical" style={{ fontSize: "0.5625rem" }}>
              ACTUAL TOOL CALLS · {state.activity.length}
            </div>
            <ol
              aria-label="Chronological agent tool activity"
              style={{ listStyle: "none", margin: "0.125rem 0 0", padding: 0 }}
            >
              {state.activity.map((activity, index) => (
                <ActivityRow key={`${activity.call.id}-${index}`} activity={activity} />
              ))}
            </ol>
          </div>
        )}

        {state.status === "completed" && (
          <div
            data-testid="bench-agent-assessment"
            style={{
              flex: "none",
              padding: "0.625rem",
              border: "1px solid var(--ohmni-border)",
              borderRadius: "var(--radius-md)",
              background: "var(--ohmni-surface-raised)",
            }}
          >
            <div className="label-technical" style={{ color: "var(--ohmni-success)", fontSize: "0.5625rem" }}>
              CURRENT ASSESSMENT
            </div>
            <p
              style={{
                marginTop: "0.375rem",
                color: "var(--ohmni-text-primary)",
                fontSize: "0.6875rem",
                lineHeight: 1.45,
                whiteSpace: "pre-wrap",
                overflowWrap: "anywhere",
              }}
            >
              {state.assessment}
            </p>
          </div>
        )}

        {state.status === "step-limit" && (
          <div
            role="status"
            className="font-mono"
            style={{ color: "var(--ohmni-warning)", fontSize: "0.625rem" }}
          >
            Agent stopped at the {state.steps}-step safety limit.
          </div>
        )}

        {state.status === "stopped" && (
          <div role="status" className="font-mono" style={{ color: "var(--ohmni-text-muted)", fontSize: "0.625rem" }}>
            Agent stopped. Investigation records were preserved.
          </div>
        )}
      </div>
    </section>
  );
};
