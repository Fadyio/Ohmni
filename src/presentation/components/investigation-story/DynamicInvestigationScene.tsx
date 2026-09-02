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
import { AnimatePresence } from "motion/react";
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
