/**
 * Dynamic Investigation Scene Controller (Left 68%).
 * Answers "WHAT IS HAPPENING RIGHT NOW?" based on real domain state:
 * - Observing: Reset History & Initial Observations
 * - Test Request: Controlled Physical Test Approval Gate
 * - Running: 60fps Oscilloscope & Hardware Actuation
 * - Evidence: 2.72 V Captured Minimum Supply Drop
 * - Hypothesis: H-001 Root Cause Diagnosis
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
  // Determine active scene based on real state
  const computeActiveScene = () => {
    if (activeSceneOverride) return activeSceneOverride;
    if (agentState.status === "approval") return "test-request";
    if (experimentStatus === "running" || relayState === "closed") return "running";
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
            minVoltage={2.72}
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
