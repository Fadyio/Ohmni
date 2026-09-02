import React from "react";
import { Check, Play, ShieldAlert, Square, X, Bot, AlertTriangle, Activity, Sparkles, Terminal } from "lucide-react";
import type {
  BenchAgentActivity,
  BenchAgentActivityStatus,
  BenchAgentState,
} from "@/presentation/hooks/useBenchAgent";
import { useBenchAgent } from "@/presentation/hooks/useBenchAgent";

export interface BenchAgentPanelProps {
  readonly isConnected: boolean;
  readonly onTargetRelay?: (targeted: boolean) => void;
}

const statusLabels: Record<BenchAgentState["status"], string> = {
  idle: "IDLE",
  investigating: "INVESTIGATING",
  approval: "WAITING FOR HUMAN",
  completed: "COMPLETED",
  stopped: "STOPPED",
  unavailable: "PROVIDER UNAVAILABLE",
  failed: "FAILED",
  "step-limit": "STEP LIMIT",
};

const activityLabels: Record<BenchAgentActivityStatus, string> = {
  requested: "EXECUTING",
  "waiting-approval": "AWAITING APPROVAL",
  completed: "COMPLETED",
  unavailable: "UNAVAILABLE",
  denied: "DENIED",
  failed: "FAILED",
};

function getToolTaxonomy(name: string): { label: "OBSERVE" | "REASON" | "PHYSICAL TEST"; color: string; bg: string } {
  if (name === "run_relay_stress_test") {
    return { label: "PHYSICAL TEST", color: "var(--ohmni-warning)", bg: "rgba(244, 184, 96, 0.12)" };
  }
  if (name.includes("hypothesis") || name.includes("evidence")) {
    return { label: "REASON", color: "var(--ohmni-brand-hover)", bg: "rgba(79, 107, 255, 0.12)" };
  }
  return { label: "OBSERVE", color: "var(--ohmni-signal)", bg: "rgba(53, 198, 244, 0.12)" };
}

function formatArguments(value: Record<string, unknown>): string {
  return JSON.stringify(value, null, 2) ?? "{}";
}

function ActivityRow({ activity }: { readonly activity: BenchAgentActivity }) {
  const taxonomy = getToolTaxonomy(activity.call.name);
  const isComplete = activity.status === "completed";
  const isWaiting = activity.status === "waiting-approval";

  return (
    <li
      data-testid="bench-agent-activity-row"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "4px",
        padding: "8px 10px",
        background: isWaiting
          ? "rgba(244, 184, 96, 0.08)"
          : "var(--ohmni-surface-raised)",
        border: `1px solid ${
          isWaiting ? "rgba(244, 184, 96, 0.3)" : "var(--ohmni-border-subtle)"
        }`,
        borderRadius: "var(--radius-md)",
        marginBottom: "6px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span
            style={{
              fontSize: "9px",
              fontWeight: 700,
              padding: "1px 6px",
              borderRadius: "var(--radius-xs)",
              background: taxonomy.bg,
              color: taxonomy.color,
            }}
          >
            {taxonomy.label}
          </span>
          <span
            className="font-mono"
            style={{
              fontSize: "12px",
              fontWeight: 600,
              color: "var(--ohmni-text-primary)",
            }}
          >
            {activity.call.name}
          </span>
        </div>

        <span
          className="font-mono"
          style={{
            fontSize: "10px",
            fontWeight: 600,
            color: isComplete
              ? "var(--ohmni-success)"
              : isWaiting
              ? "var(--ohmni-warning)"
              : "var(--ohmni-text-muted)",
          }}
        >
          {activityLabels[activity.status]}
        </span>
      </div>

      {activity.result && (
        <div
          className="font-mono metadata-text"
          style={{
            color: "var(--ohmni-text-secondary)",
            fontSize: "11px",
            lineHeight: 1.3,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {typeof activity.result === "string"
            ? activity.result
            : JSON.stringify(activity.result)}
        </div>
      )}
    </li>
  );
}

export const BenchAgentPanel: React.FC<BenchAgentPanelProps> = ({ isConnected, onTargetRelay }) => {
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
      ? "var(--ohmni-brand-hover)"
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
        overflow: "hidden",
      }}
    >
      {/* Panel Header */}
      <header
        style={{
          flex: "none",
          padding: "10px 14px",
          background: "var(--ohmni-surface-raised)",
          borderBottom: "1px solid var(--ohmni-border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <div
            style={{
              width: "24px",
              height: "24px",
              borderRadius: "var(--radius-sm)",
              background: "rgba(168, 85, 247, 0.15)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#C084FC",
            }}
          >
            <Bot size={14} />
          </div>
          <h2
            id="bench-agent-title"
            style={{
              margin: 0,
              color: "var(--ohmni-text-primary)",
              fontSize: "13px",
              fontWeight: 600,
              letterSpacing: "0.04em",
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
            gap: "5px",
            color: statusColor,
            fontSize: "11px",
            fontWeight: 700,
            padding: "2px 8px",
            borderRadius: "var(--radius-full)",
            background: "var(--ohmni-surface)",
            border: "1px solid var(--ohmni-border-subtle)",
          }}
        >
          <span
            aria-hidden="true"
            style={{
              width: "6px",
              height: "6px",
              borderRadius: "50%",
              background: statusColor,
            }}
          />
          {statusLabels[state.status]}
        </div>
      </header>

      {/* Main Content Area */}
      <div
        style={{
          minHeight: 0,
          flex: 1,
          display: "flex",
          flexDirection: "column",
          gap: "10px",
          padding: "12px 14px",
          overflowY: "auto",
        }}
      >
        {/* Diagnostic Goal Input Card */}
        <div style={{ flex: "none" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
            <label
              htmlFor="bench-agent-goal"
              className="metadata-text"
              style={{ fontWeight: 600, color: "var(--ohmni-text-secondary)" }}
            >
              DIAGNOSTIC GOAL
            </label>
            <span className="metadata-text">Autonomous Investigation</span>
          </div>

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
            placeholder="Describe the hardware diagnostic objective…"
            style={{
              width: "100%",
              resize: "none",
              border: "1px solid var(--ohmni-border)",
              borderRadius: "var(--radius-md)",
              background: "var(--ohmni-bg)",
              color: "var(--ohmni-text-primary)",
              padding: "8px 10px",
              fontFamily: "var(--font-sans)",
              fontSize: "12px",
              lineHeight: 1.4,
            }}
          />

          <div style={{ display: "flex", gap: "8px", marginTop: "6px" }}>
            {!active ? (
              <button
                type="button"
                data-testid="bench-agent-start"
                onClick={start}
                disabled={!canStart}
                className="btn-primary"
                style={{
                  flex: 1,
                  padding: "8px 12px",
                  fontSize: "12px",
                }}
              >
                <Play size={13} fill="currentColor" />
                START AGENT
              </button>
            ) : (
              <button
                type="button"
                data-testid="bench-agent-stop"
                onClick={stop}
                className="btn-secondary"
                style={{
                  flex: 1,
                  padding: "8px 12px",
                  fontSize: "12px",
                  color: "var(--ohmni-fault)",
                  borderColor: "rgba(255, 93, 104, 0.4)",
                  background: "rgba(255, 93, 104, 0.1)",
                }}
              >
                <Square size={13} fill="currentColor" />
                STOP AGENT
              </button>
            )}
          </div>
        </div>

        {/* Status: Unavailable */}
        {state.status === "unavailable" && (
          <div
            role="alert"
            style={{
              padding: "10px",
              border: "1px solid var(--ohmni-warning)",
              borderRadius: "var(--radius-md)",
              background: "rgba(244, 184, 96, 0.1)",
            }}
          >
            <div className="font-mono" style={{ color: "var(--ohmni-warning)", fontSize: "11px", fontWeight: 700 }}>
              BENCH AGENT DEMO PROVIDER
            </div>
            <p style={{ marginTop: "4px", color: "var(--ohmni-text-secondary)", fontSize: "12px" }}>
              Live Gemini API key not configured. Using deterministic validation agent.
            </p>
          </div>
        )}

        {/* Status: Failed */}
        {state.status === "failed" && (
          <div
            role="alert"
            style={{
              padding: "10px 12px",
              border: "1px solid var(--ohmni-fault)",
              borderRadius: "var(--radius-md)",
              background: "var(--ohmni-fault-subtle)",
              color: "var(--ohmni-fault)",
              fontSize: "12px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <AlertTriangle size={14} style={{ flexShrink: 0 }} />
            <span>{state.message}</span>
          </div>
        )}

        {/* High-Context Human-in-the-Loop Approval Experience */}
        {state.status === "approval" && (
          <div
            data-testid="bench-agent-approval"
            role="alert"
            style={{
              flex: "none",
              padding: "14px",
              border: "1px solid var(--ohmni-warning)",
              borderRadius: "var(--radius-lg)",
              background: "rgba(244, 184, 96, 0.08)",
              boxShadow: "0 0 24px rgba(244, 184, 96, 0.15)",
              display: "flex",
              flexDirection: "column",
              gap: "8px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--ohmni-warning)" }}>
              <ShieldAlert size={16} />
              <strong style={{ fontSize: "13px", letterSpacing: "0.03em" }}>
                CONTROLLED TEST REQUEST
              </strong>
            </div>

            <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--ohmni-text-primary)" }}>
              Relay stress test
            </div>

            <div className="metadata-text" style={{ color: "var(--ohmni-text-secondary)", lineHeight: 1.4 }}>
              <strong>Why?</strong> The controller reports brownout resets. This experiment tests whether energizing the relay coil causes a measurable supply voltage collapse.
            </div>

            <div
              style={{
                background: "var(--ohmni-surface)",
                padding: "8px 10px",
                borderRadius: "var(--radius-sm)",
                border: "1px solid var(--ohmni-border-subtle)",
                fontSize: "11px",
                color: "var(--ohmni-text-secondary)",
              }}
            >
              <div style={{ fontWeight: 600, color: "var(--ohmni-text-primary)", marginBottom: "3px" }}>
                What will happen:
              </div>
              <div>• Relay coil energizes for 500 ms</div>
              <div>• Maximum 3 cycles requested</div>
              <div>• Supply rail telemetry acquired in real-time</div>
              <div>• Test halts immediately if reset occurs</div>
            </div>

            <div className="font-mono metadata-text" style={{ fontSize: "11px", color: "var(--ohmni-text-muted)" }}>
              Instrument: <strong style={{ color: "var(--ohmni-brand-hover)" }}>{state.approval.tool.name}</strong>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1.5fr", gap: "8px", marginTop: "4px" }}>
              <button
                type="button"
                data-testid="bench-agent-deny"
                onClick={deny}
                className="btn-secondary"
                style={{
                  padding: "8px",
                  fontSize: "12px",
                  fontWeight: 600,
                }}
              >
                <X size={14} />
                Deny
              </button>

              <button
                type="button"
                data-testid="bench-agent-approve"
                onClick={approve}
                className="btn-primary"
                style={{
                  padding: "8px",
                  fontSize: "12px",
                  fontWeight: 700,
                  background: "var(--ohmni-warning-dim)",
                  borderColor: "var(--ohmni-warning)",
                  color: "#FFFFFF",
                }}
              >
                <Check size={14} />
                Approve Test
              </button>
            </div>
          </div>
        )}

        {/* Activity Items List */}
        {state.activity.length > 0 && (
          <div style={{ flex: 1, minHeight: 0 }}>
            <div className="metadata-text" style={{ marginBottom: "6px", fontWeight: 600, letterSpacing: "0.04em" }}>
              INVESTIGATION ACTIVITY • {state.activity.length}
            </div>
            <ol
              aria-label="Chronological agent tool activity"
              style={{ listStyle: "none", margin: 0, padding: 0 }}
            >
              {state.activity.map((activity, index) => (
                <ActivityRow key={`${activity.call.id}-${index}`} activity={activity} />
              ))}
            </ol>
          </div>
        )}

        {/* Final Assessment Card */}
        {state.status === "completed" && (
          <div
            data-testid="bench-agent-assessment"
            style={{
              flex: "none",
              padding: "12px",
              border: "1px solid var(--ohmni-border)",
              borderRadius: "var(--radius-lg)",
              background: "var(--ohmni-surface-raised)",
            }}
          >
            <div className="metadata-text" style={{ color: "var(--ohmni-success)", fontWeight: 700, display: "flex", alignItems: "center", gap: "5px" }}>
              <Sparkles size={12} />
              DIAGNOSTIC ASSESSMENT
            </div>
            <p
              style={{
                marginTop: "6px",
                color: "var(--ohmni-text-primary)",
                fontSize: "13px",
                lineHeight: 1.5,
                whiteSpace: "pre-wrap",
              }}
            >
              {state.assessment}
            </p>
          </div>
        )}

        {state.status === "step-limit" && (
          <div
            role="status"
            className="font-mono metadata-text"
            style={{ color: "var(--ohmni-warning)" }}
          >
            Agent stopped at the {state.steps}-step safety limit.
          </div>
        )}

        {state.status === "stopped" && (
          <div role="status" className="font-mono metadata-text" style={{ color: "var(--ohmni-text-muted)" }}>
            Agent stopped. Investigation records preserved.
          </div>
        )}
      </div>
    </section>
  );
};
