/**
 * Dynamic Investigation Scene Controller (Left 70%).
 * Milestone 7.13 — Visual Rescue: 3D OHMNI Identity + Cohesive Product UI
 *
 * Answers "WHAT IS HAPPENING RIGHT NOW?" based on real domain state:
 * - Ready: Large hardware device, initial lab entry state
 * - Observing: Reset History & Initial Observations (when read_reset_history executed)
 * - Test Request / Approval: Controlled Physical Test Approval Gate
 * - Running: 60fps Oscilloscope Hero Viewport & Hardware Actuation
 * - Evidence: Captured Empirical Facts & animated measurement tokens
 * - Hypothesis: Grounded Root Cause Diagnosis
 */

import React from "react";
import { AnimatePresence, motion } from "motion/react";
import { AlertTriangle, RotateCcw, Bot } from "lucide-react";
import type { AgentMode } from "@/infrastructure/bench-agent/types";
import { ReadyScene } from "./scenes/ReadyScene";
import { ObservingScene } from "./scenes/ObservingScene";
import { TestRequestScene } from "./scenes/TestRequestScene";
import { RunningExperimentScene } from "./scenes/RunningExperimentScene";
import { EvidenceScene } from "./scenes/EvidenceScene";
import { HypothesisScene } from "./scenes/HypothesisScene";
import { AssessmentScene } from "./scenes/AssessmentScene";
import { classifyTool } from "@/domain/safety/tool-safety-policy";
import type { TelemetryRingBuffer } from "@/domain/telemetry/ring-buffer";
import type { ScopeEventMarker } from "../../hooks/useOscilloscopeBuffer";
import type { EvidenceRecord } from "@/domain/evidence/types";
import type { Hypothesis } from "@/domain/hypothesis/types";
import type { BenchAgentState } from "../../hooks/useBenchAgent";
import { getAgentIdentity } from "@/presentation/types/agent-identity";
export interface DynamicInvestigationSceneProps {
  readonly agentState: BenchAgentState;
  readonly experimentStatus: "idle" | "running" | "completed" | "failed" | "aborted" | string;
  readonly relayState: "open" | "closed";
  readonly resetCount: number;
  readonly railVoltage: number;
  readonly ringBufferRef: React.RefObject<TelemetryRingBuffer>;
  readonly markersRef: React.RefObject<ScopeEventMarker[]>;
  readonly evidenceRecords: readonly EvidenceRecord[];
  readonly hypothesis: Hypothesis | null;
  readonly onApproveTest: () => void;
  readonly onDenyTest: () => void;
  readonly onProceedToRepair?: () => void;
  readonly onStartAgent?: () => void;
  readonly agentMode?: AgentMode;
  readonly onSwitchToDemo?: () => void;
  readonly onRetryAgent?: () => void;
  readonly activeSceneOverride?: "ready" | "observing" | "test-request" | "running" | "evidence" | "hypothesis" | "completed" | null;
}

export const DynamicInvestigationScene: React.FC<DynamicInvestigationSceneProps> = ({
  agentState,
  experimentStatus,
  relayState,
  resetCount,
  railVoltage,
  ringBufferRef,
  markersRef,
  evidenceRecords,
  hypothesis,
  onApproveTest,
  onDenyTest,
  onProceedToRepair,
  onStartAgent,
  agentMode = "groq",
  onSwitchToDemo,
  onRetryAgent,
  activeSceneOverride,
}) => {
  const agentIdentity = getAgentIdentity(agentMode, agentState.liveProvider, agentState.liveModel);
  const resetActivity = agentState.activity.find(
    (a) =>
      (a.call.name === "read_reset_history" ||
        a.call.name.includes("read_reset_history") ||
        a.call.name.includes("reset")) &&
      a.status === "completed" &&
      a.result !== undefined
  );
  const hasInspectedResetHistory = Boolean(resetActivity);

  let parsedBrownout: number | string | undefined = undefined;
  let parsedWatchdog: number | string | undefined = undefined;
  let parsedSoftware: number | string | undefined = undefined;
  let isResetParseError = false;

  if (hasInspectedResetHistory && resetActivity?.result) {
    try {
      const parsed = JSON.parse(resetActivity.result);
      const resets = Array.isArray(parsed?.data?.resets)
        ? parsed.data.resets
        : Array.isArray(parsed?.resets)
        ? parsed.resets
        : null;

      if (!resets) {
        throw new Error("Invalid reset structure");
      }

      parsedBrownout = resets.filter((r: { reason?: string }) => r.reason === "BROWNOUT").length;
      parsedWatchdog = resets.filter((r: { reason?: string }) => r.reason === "WATCHDOG").length;
      parsedSoftware = resets.filter((r: { reason?: string }) => r.reason === "SOFTWARE" || r.reason === "PANIC").length;
    } catch {
      isResetParseError = true;
      parsedBrownout = undefined;
      parsedWatchdog = undefined;
      parsedSoftware = undefined;
    }
  }

  // Determine active scene based on real domain state
  const computeActiveScene = (): "ready" | "observing" | "test-request" | "running" | "evidence" | "hypothesis" | "completed" => {
    if (activeSceneOverride) return activeSceneOverride;
    if (agentState.status === "approval") {
      const toolName = agentState.approval.tool.name;
      if (classifyTool(toolName, agentState.approval.tool.annotations) === "physical") {
        return "test-request";
      }
    }
    if (
      relayState === "closed" ||
      (experimentStatus === "running" && hypothesis === null) ||
      (agentState.status === "investigating" &&
        agentState.activity.some((a) => (a.call.name.includes("relay") || a.call.name.includes("stress")) && a.status !== "completed"))
    ) {
      return "running";
    }
    if (agentState.status === "approval") {
      const toolName = agentState.approval.tool.name;
      if (classifyTool(toolName, agentState.approval.tool.annotations) === "physical") {
        return "test-request";
      }
    }
    if (hypothesis !== null) return "hypothesis";
    if (agentState.status === "completed") return "completed";
    if (evidenceRecords.length > 0) return "evidence";
    if (hasInspectedResetHistory) return "observing";
    return "ready";
  };
  const currentScene = computeActiveScene();

  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        overflowY: "auto",
        padding: "0.75rem",
      }}
    >
      {/* Agent Failure Diagnostic Banner */}
      {/* Agent Unavailable / Error Card */}
      {agentMode !== "demo" && (agentState.status === "failed" || agentState.status === "unavailable" || agentState.providerStatus === "error") ? (
        (() => {
          const stateMessage = "message" in agentState && typeof agentState.message === "string" ? agentState.message : undefined;
          const isRateLimited = Boolean(
            stateMessage &&
              (stateMessage.toLowerCase().includes("rate limit") ||
                stateMessage.toLowerCase().includes("rate_limited") ||
                stateMessage.includes("FREE AI RATE LIMIT REACHED"))
          );
          return (
            <motion.div
              id="agent-unavailable-card"
              data-testid="agent-unavailable-card"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              style={{
                background: "rgba(220, 80, 80, 0.06)",
                border: "1px solid rgba(220, 80, 80, 0.28)",
                borderRadius: "var(--radius-lg, 12px)",
                padding: "1.5rem 1.75rem",
                marginBottom: "1.5rem",
                display: "flex",
                flexDirection: "column",
                gap: "10px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--ohmni-lab-fault, #DC5050)", fontSize: "13px", fontWeight: 800 }}>
                <AlertTriangle size={18} />
                <span>{isRateLimited ? "FREE AI RATE LIMIT REACHED" : `${agentIdentity.displayName.toUpperCase()} UNAVAILABLE`}</span>
              </div>
              <p style={{ margin: 0, fontSize: "14px", color: "var(--ohmni-lab-muted, #64748B)", lineHeight: 1.5 }}>
                {isRateLimited
                  ? `The free ${agentIdentity.displayName} allocation is temporarily rate limited.`
                  : stateMessage || `${agentIdentity.displayName} API quota is currently unavailable.`}
              </p>
              <div style={{ display: "flex", gap: "10px", marginTop: "4px" }}>
                {onRetryAgent && (
                  <button
                    type="button"
                    data-testid="retry-agent-btn"
                    id="retry-agent-btn"
                    onClick={onRetryAgent}
                    className="btn-secondary"
                    style={{
                      padding: "8px 16px",
                      fontSize: "13px",
                      fontWeight: 700,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                  >
                    <RotateCcw size={14} />
                    <span>Retry</span>
                  </button>
                )}
                {onSwitchToDemo && (
                  <button
                    type="button"
                    data-testid="continue-demo-agent-btn"
                    onClick={onSwitchToDemo}
                    className="btn-primary"
                    style={{
                      padding: "8px 16px",
                      fontSize: "13px",
                      fontWeight: 700,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                  >
                    <Bot size={14} />
                    <span>Continue with Demo Agent</span>
                  </button>
                )}
              </div>
            </motion.div>
          );
        })()
      ) : agentState.status === "failed" ? (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            background: "rgba(220, 80, 80, 0.06)",
            border: "1px solid rgba(220, 80, 80, 0.28)",
            borderRadius: "var(--radius-lg, 12px)",
            padding: "1.5rem 1.75rem",
            marginBottom: "1.5rem",
            display: "flex",
            flexDirection: "column",
            gap: "10px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--ohmni-lab-fault, #DC5050)", fontSize: "13px", fontWeight: 700 }}>
            <AlertTriangle size={18} />
            <span>AGENT INVESTIGATION INTERRUPTED</span>
          </div>
          <h3 style={{ fontSize: "18px", fontWeight: 700, margin: 0, color: "var(--ohmni-lab-text)" }}>
            Diagnostic process encountered an issue.
          </h3>
          <p style={{ margin: 0, fontSize: "14px", color: "var(--ohmni-lab-muted)", lineHeight: 1.5 }}>
            {agentState.message || "Agent request failed."}
          </p>
          {agentState.requestId && (
            <div className="font-mono" style={{ fontSize: "11px", color: "var(--ohmni-lab-muted)" }}>
              Request ID: {agentState.requestId}
            </div>
          )}
          {onStartAgent && (
            <div style={{ display: "flex", gap: "10px", marginTop: "4px" }}>
              <button
                onClick={onStartAgent}
                className="btn-primary"
                style={{
                  padding: "8px 16px",
                  fontSize: "13px",
                  fontWeight: 700,
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  width: "fit-content",
                }}
              >
                <RotateCcw size={14} />
                <span>Retry</span>
              </button>
            </div>
          )}
        </motion.div>
      ) : null}

      {/* Scene Render Container — Zero white wash / zero blank frame transitions */}
      <AnimatePresence>
        {currentScene === "ready" && (
          <ReadyScene
            key="ready"
            isConnected={true}
            relayState={relayState}
            railVoltage={railVoltage}
            onStartInvestigation={onStartAgent}
          />
        )}

        {currentScene === "observing" && (
          <ObservingScene
            key="observing"
            resetCount={resetCount}
            railVoltage={railVoltage}
            hasInspectedResetHistory={hasInspectedResetHistory}
            isParseError={isResetParseError}
            brownoutCount={parsedBrownout}
            watchdogCount={parsedWatchdog}
            softwarePanicCount={parsedSoftware}
          />
        )}
        {currentScene === "test-request" && (
          <TestRequestScene
            key="test-request"
            onApprove={onApproveTest}
            onDeny={onDenyTest}
            toolName={agentState.status === "approval" ? agentState.approval.tool.name : undefined}
            agentDisplayName={agentIdentity.displayName}
          />
        )}

        {currentScene === "running" && (
          <RunningExperimentScene
            key="running"
            ringBufferRef={ringBufferRef}
            markersRef={markersRef}
            isRunning={experimentStatus === "running"}
            relayState={relayState}
            railVoltage={railVoltage}
          />
        )}

        {currentScene === "evidence" && (
          <EvidenceScene
            key="evidence"
            evidenceRecords={evidenceRecords}
          />
        )}

        {currentScene === "hypothesis" && hypothesis !== null && (
          <HypothesisScene
            key="hypothesis"
            hypothesis={hypothesis}
            onProceedToRepair={onProceedToRepair}
          />
        )}

        {currentScene === "completed" && (
          <AssessmentScene
            key="completed"
            assessment={agentState.status === "completed" ? agentState.assessment : ""}
            steps={agentState.status === "completed" ? agentState.steps : 0}
            onRestart={onStartAgent}
          />
        )}
      </AnimatePresence>
    </div>
  );
};
