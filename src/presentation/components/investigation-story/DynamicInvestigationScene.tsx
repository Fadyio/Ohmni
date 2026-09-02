/**
 * Dynamic Investigation Scene Controller (Left 75%).
 * Answers "WHAT IS HAPPENING RIGHT NOW?" based on real domain state:
 * - Observing: Reset History & Initial Observations
 * - Test Request: Controlled Physical Test Approval Gate
 * - Running: 60fps Oscilloscope & Hardware Actuation
 * - Evidence: Captured Empirical Facts from Store
 * - Hypothesis: Grounded Root Cause Diagnosis
 */

import React from "react";
import { AnimatePresence, motion } from "motion/react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { ObservingScene } from "./scenes/ObservingScene";
import { TestRequestScene } from "./scenes/TestRequestScene";
import { RunningExperimentScene } from "./scenes/RunningExperimentScene";
import { EvidenceScene } from "./scenes/EvidenceScene";
import { HypothesisScene } from "./scenes/HypothesisScene";
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
  readonly activeSceneOverride?: "observing" | "test-request" | "running" | "evidence" | "hypothesis" | null;
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
  const computeActiveScene = () => {
    if (activeSceneOverride) return activeSceneOverride;
    if (experimentStatus === "running" || relayState === "closed") return "running";
    if (agentState.status === "approval") return "test-request";
    if (hypothesis !== null || agentState.status === "completed") return "hypothesis";
    if (evidenceRecords.length > 0) return "evidence";
    return "observing";
  };
  const currentScene = computeActiveScene();

  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        overflowY: "auto",
        padding: "0.5rem",
      }}
    >
      {agentState.status === "failed" && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            background: "rgba(220, 38, 38, 0.05)",
            border: "1px solid rgba(220, 38, 38, 0.25)",
            borderRadius: "var(--radius-lg)",
            padding: "1.75rem 2rem",
            marginBottom: "1.5rem",
            display: "flex",
            flexDirection: "column",
            gap: "10px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--ohmni-lab-fault)", fontSize: "13px", fontWeight: 700 }}>
            <AlertTriangle size={18} />
            <span>AGENT CONNECTION ERROR</span>
          </div>
          <h3 style={{ fontSize: "20px", fontWeight: 700, margin: 0, color: "var(--ohmni-lab-text)" }}>
            Could not start Gemini investigation.
          </h3>
          <p style={{ margin: 0, fontSize: "14px", color: "var(--ohmni-lab-muted)", lineHeight: 1.5 }}>
            {agentState.message || "Gemini request failed."}
          </p>
          {agentState.requestId && (
            <div className="font-mono" style={{ fontSize: "11px", color: "var(--ohmni-lab-muted)" }}>
              Request ID: {agentState.requestId}
            </div>
          )}
          {onStartAgent && (
            <div style={{ display: "flex", gap: "10px", marginTop: "6px" }}>
              <button
                onClick={onStartAgent}
                className="btn-primary"
                style={{
                  padding: "8px 16px",
                  fontSize: "13px",
                  fontWeight: 700,
                  background: "var(--ohmni-lab-brand)",
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

      <AnimatePresence mode="wait">
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
