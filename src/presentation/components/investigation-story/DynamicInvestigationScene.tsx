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
import { AlertTriangle, RotateCcw } from "lucide-react";
import { ReadyScene } from "./scenes/ReadyScene";
import { ObservingScene } from "./scenes/ObservingScene";
import { TestRequestScene } from "./scenes/TestRequestScene";
import { RunningExperimentScene } from "./scenes/RunningExperimentScene";
import { EvidenceScene } from "./scenes/EvidenceScene";
import { HypothesisScene } from "./scenes/HypothesisScene";
import { classifyTool } from "@/domain/safety/tool-safety-policy";
import type { TelemetryRingBuffer } from "@/domain/telemetry/ring-buffer";
import type { ScopeEventMarker } from "../../hooks/useOscilloscopeBuffer";
import type { EvidenceRecord } from "@/domain/evidence/types";
import type { Hypothesis } from "@/domain/hypothesis/types";
import type { BenchAgentState } from "../../hooks/useBenchAgent";

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
  readonly activeSceneOverride?: "ready" | "observing" | "test-request" | "running" | "evidence" | "hypothesis" | null;
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
  activeSceneOverride,
}) => {
  // Reset history must only be considered inspected if successfully completed
  const resetActivity = agentState.activity.find(
    (a) => a.call.name.includes("reset") && a.status === "completed"
  );
  const hasInspectedResetHistory = resetCount > 0 || Boolean(resetActivity);

  let parsedBrownout: number | string | undefined = undefined;
  let parsedWatchdog: number | string | undefined = undefined;
  let parsedSoftware: number | string | undefined = undefined;

  if (hasInspectedResetHistory) {
    if (resetActivity?.result) {
      try {
        const parsed = JSON.parse(resetActivity.result);
        const resets = Array.isArray(parsed?.data?.resets)
          ? parsed.data.resets
          : Array.isArray(parsed?.resets)
          ? parsed.resets
          : [];
        parsedBrownout = resets.filter((r: { reason?: string }) => r.reason === "BROWNOUT").length;
        parsedWatchdog = resets.filter((r: { reason?: string }) => r.reason === "WATCHDOG").length;
        parsedSoftware = resets.filter((r: { reason?: string }) => r.reason === "SOFTWARE" || r.reason === "PANIC").length;
      } catch {
        parsedBrownout = resetCount;
        parsedWatchdog = 0;
        parsedSoftware = 0;
      }
    } else if (resetCount > 0) {
      parsedBrownout = resetCount;
      parsedWatchdog = 0;
      parsedSoftware = 0;
    }
  }

  // Determine active scene based on real domain state
  const computeActiveScene = (): "ready" | "observing" | "test-request" | "running" | "evidence" | "hypothesis" => {
    if (activeSceneOverride) return activeSceneOverride;
    if (
      experimentStatus === "running" ||
      relayState === "closed" ||
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
    if (hypothesis !== null || agentState.status === "completed") return "hypothesis";
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
      {agentState.status === "failed" && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            background: "rgba(220, 80, 80, 0.06)",
            border: "1px solid rgba(220, 80, 80, 0.28)",
            borderRadius: "var(--radius-lg)",
            padding: "1.5rem 1.75rem",
            marginBottom: "1.5rem",
            display: "flex",
            flexDirection: "column",
            gap: "10px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--ohmni-lab-fault)", fontSize: "13px", fontWeight: 700 }}>
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
      )}

      {/* Scene Render Container */}
      <AnimatePresence mode="wait">
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

        {currentScene === "hypothesis" && (
          <HypothesisScene
            key="hypothesis"
            hypothesis={hypothesis}
            onProceedToRepair={onProceedToRepair}
          />
        )}
      </AnimatePresence>
    </div>
  );
};
