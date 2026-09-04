/**
 * Core Agent-Ready Workbench Layout.
 * Provides a 70% live instrument surface and 30% external agent activity rail.
 */

import React, { useState } from "react";
import { motion } from "motion/react";
import { AppHeader } from "../layout/AppHeader";
import { DynamicInvestigationScene } from "./DynamicInvestigationScene";
import { InvestigationNarrativeRail } from "./InvestigationNarrativeRail";
import type { TelemetryRingBuffer } from "@/domain/telemetry/ring-buffer";
import type { ScopeEventMarker } from "../../hooks/useOscilloscopeBuffer";
import type { EvidenceRecord } from "@/domain/evidence/types";
import type { Hypothesis } from "@/domain/hypothesis/types";
import type { DeviceDescriptor } from "@/domain/device/descriptor";
import type { BenchAgentState } from "../../hooks/useBenchAgent";
import type { AgentMode } from "@/infrastructure/bench-agent/types";
import type { ScenarioSession } from "@/domain/scenario/types";
import type { InvestigationPhase } from "@/domain/investigation/lifecycle";
import { deriveInvestigationPhase } from "@/domain/investigation/lifecycle";
import { classifyTool } from "@/domain/safety/tool-safety-policy";
import { getAgentIdentity } from "@/presentation/types/agent-identity";
import { useWebMCPTools } from "@/presentation/hooks/useWebMCPTools";
import type { ToolLedgerEntry } from "@/domain/investigation/tool-ledger";
import type { ToolApprovalRequest } from "@/domain/safety/approval-gate";
import type { DeviceAdapter } from "@/domain/device/adapter";
import type { ExperimentStore } from "@/domain/experiment/store";
import type { EvidenceStore } from "@/domain/evidence/store";
import type { HypothesisStore } from "@/domain/hypothesis/store";
import type { ScenarioGroundTruth } from "@/domain/scenario/types";
import type { DiagnosisMatchResult } from "@/domain/scenario/engine";

export interface InvestigationStoryViewProps {
  readonly isConnected: boolean;
  readonly descriptor: DeviceDescriptor | null;
  readonly relayState: "open" | "closed";
  readonly resetCount: number;
  readonly railVoltage: number;
  readonly experimentStatus: "idle" | "running" | "completed" | "failed" | "aborted" | string;
  readonly ringBufferRef: React.RefObject<TelemetryRingBuffer>;
  readonly markersRef: React.RefObject<ScopeEventMarker[]>;
  readonly evidenceRecords: readonly EvidenceRecord[];
  readonly hypothesis: Hypothesis | null;
  readonly agentState: BenchAgentState;
  readonly agentMode?: AgentMode;
  readonly activeScenario?: ScenarioSession | null;
  readonly ledgerEntries?: readonly ToolLedgerEntry[];
  readonly pendingApproval?: ToolApprovalRequest | null;
  readonly registeredToolCount?: number;
  readonly onSetGoal: (goal: string) => void;
  readonly onStartAgent: () => void;
  readonly onStopAgent: () => void;
  readonly onApproveTest: () => void;
  readonly onDenyTest: () => void;
  readonly onToggleConnect: () => void;
  readonly onProceedToRepair?: () => void;
  readonly onOpenDevInspector?: () => void;
  readonly onSwitchToDemo?: () => void;
  readonly onRetryAgent?: () => void;
  readonly labChromeRef?: React.RefObject<HTMLElement | null>;
  readonly labMainSceneRef?: React.RefObject<HTMLElement | null>;
  readonly agentRailRef?: React.RefObject<HTMLElement | null>;
  readonly viewMode?: "welcome" | "investigation" | "repair" | "reveal";
  readonly deviceAdapter?: DeviceAdapter;
  readonly experimentStore?: ExperimentStore;
  readonly evidenceStore?: EvidenceStore;
  readonly hypothesisStore?: HypothesisStore;
  readonly revealedGroundTruth?: ScenarioGroundTruth | null;
  readonly matchResult?: DiagnosisMatchResult | null;
  readonly onSendObservation?: (observation: string) => void;
  readonly onRunAnotherMystery?: () => void;
  readonly onReturnToWorkbench?: () => void;
}

export const InvestigationStoryView: React.FC<InvestigationStoryViewProps> = ({
  isConnected,
  descriptor,
  relayState,
  resetCount,
  railVoltage,
  experimentStatus,
  ringBufferRef,
  markersRef,
  evidenceRecords,
  hypothesis,
  agentState,
  agentMode = "external",
  activeScenario,
  ledgerEntries,
  pendingApproval,
  registeredToolCount,
  onSetGoal,
  onStartAgent,
  onStopAgent,
  onApproveTest,
  onDenyTest,
  onToggleConnect,
  onProceedToRepair,
  onOpenDevInspector,
  onSwitchToDemo,
  onRetryAgent,
  labChromeRef,
  labMainSceneRef,
  agentRailRef,
  viewMode,
  deviceAdapter,
  experimentStore,
  evidenceStore,
  hypothesisStore,
  revealedGroundTruth,
  matchResult,
  onSendObservation,
  onRunAnotherMystery,
  onReturnToWorkbench,
}) => {
  const [activeSceneOverride, setActiveSceneOverride] = useState<"ready" | "observing" | "test-request" | "running" | "evidence" | "hypothesis" | "completed" | null>(null);
  const agentIdentity = getAgentIdentity(agentMode, agentState.liveProvider, agentState.liveModel);

  const activeLedgerEntry = ledgerEntries?.findLast(
    (entry) =>
      entry.status === "requested" ||
      entry.status === "waiting-approval" ||
      entry.status === "running"
  );
  const activeToolName =
    pendingApproval?.toolName ??
    activeLedgerEntry?.toolName ??
    (agentState.activity.length > 0
      ? agentState.activity[agentState.activity.length - 1].call.name
      : undefined);
  const isAwaitingApproval =
    pendingApproval !== null && pendingApproval !== undefined
      ? true
      : activeLedgerEntry?.status === "waiting-approval" ||
        agentState.status === "approval";
  const isToolRunning =
    activeLedgerEntry?.status === "requested" ||
    activeLedgerEntry?.status === "running" ||
    agentState.status === "investigating";

  const isHumanInterventionCompleted = Boolean(
    evidenceRecords.some((e) => e.source === "human") ||
    activeScenario?.isVerified === true
  );

  const investigationPhase: InvestigationPhase = deriveInvestigationPhase({
    isConnected,
    isAgentRunning: isToolRunning,
    agentStatus:
      isAwaitingApproval
        ? "waiting_approval"
        : isToolRunning
        ? "running"
        : agentState.status === "failed"
        ? "failed"
        : agentState.status === "stopped"
        ? "stopped"
        : agentState.status === "completed"
        ? "completed"
        : "idle",
    activeToolClass:
      activeToolName ? classifyTool(activeToolName) : undefined,
    isAwaitingApproval,
    isExperimentActive:
      experimentStatus === "running" &&
      !(hypothesis !== null && !isHumanInterventionCompleted),
    isVerificationExperiment: isHumanInterventionCompleted,
    hasRecentEvidence: evidenceRecords.length > 0,
    hasHypothesis: hypothesis !== null,
    isWaitingForHuman: hypothesis !== null && !isHumanInterventionCompleted,
    isHumanInterventionCompleted,
    isVerified: hypothesis?.verificationStatus === "VERIFIED" || activeScenario?.isVerified === true,
    isChallengeMode: agentMode !== "demo",
    hasStarted: true,
    failureMessage: agentState.status === "failed" ? agentState.message : undefined,
  });
  const { tools: webmcpTools, toolCount } = useWebMCPTools();
  const materializedToolCount = registeredToolCount ?? toolCount;

  const currentProgressStep: "OBSERVE" | "TEST" | "DIAGNOSE" | "REPAIR" | "VERIFY" = (() => {
    if (viewMode === "reveal") return "VERIFY";
    if (viewMode === "repair") return "REPAIR";
    switch (investigationPhase) {
      case "welcome":
      case "challenge_ready":
      case "connecting":
      case "ready":
      case "observing":
        return "OBSERVE";
      case "waiting_for_approval":
      case "experiment_running":
      case "evidence_review":
        return "TEST";
      case "reasoning":
      case "hypothesis":
        return "DIAGNOSE";
      case "waiting_for_human":
        return "REPAIR";
      case "verification_pending":
      case "verification_running":
      case "verified":
        return "VERIFY";
      default:
        return "OBSERVE";
    }
  })();
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      style={{
        width: "100%",
        maxWidth: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: "var(--ohmni-lab-canvas, #F4F5F7)",
        color: "var(--ohmni-lab-text, #12151A)",
        overflow: "hidden",
        boxSizing: "border-box",
        position: "relative",
      }}
    >
      <AppHeader
        headerRef={labChromeRef}
        isConnected={isConnected}
        descriptor={descriptor}
        currentStage={currentProgressStep}
        statusVisual={isConnected ? "nominal" : "disconnected"}
        activeScenario={activeScenario}
        registeredToolCount={materializedToolCount}
        agentMode={agentMode}
        agentState={agentState}
        onOpenDevInspector={onOpenDevInspector}
        onToggleConnect={onToggleConnect}
      />
      {/* Main 70% / 30% Workbench Layout */}
      <div
        className="workbench-main-grid"
        style={{
          flex: 1,
          minHeight: 0,
          overflow: "hidden",
        }}
      >
        {/* Left 70%: Current Scene Canvas (Hardware, Scope, Evidence) */}
        <main
          ref={labMainSceneRef}
          id="lab-main-scene"
          style={{
            height: "100%",
            overflowY: "auto",
            padding: "1.35rem 1.6rem",
            background: "var(--ohmni-lab-canvas, #F4F5F7)",
          }}
        >
          <DynamicInvestigationScene
            descriptor={descriptor}
            agentState={agentState}
            ledgerEntries={ledgerEntries}
            pendingApproval={pendingApproval}
            experimentStatus={experimentStatus}
            relayState={relayState}
            resetCount={resetCount}
            railVoltage={railVoltage}
            ringBufferRef={ringBufferRef}
            markersRef={markersRef}
            evidenceRecords={evidenceRecords}
            hypothesis={hypothesis}
            onApproveTest={onApproveTest}
            onDenyTest={onDenyTest}
            onProceedToRepair={onProceedToRepair}
            onStartAgent={onStartAgent}
            agentMode={agentMode}
            onSwitchToDemo={onSwitchToDemo}
            onRetryAgent={onRetryAgent}
            onOpenDevInspector={onOpenDevInspector}
            activeSceneOverride={activeSceneOverride}
            viewMode={viewMode}
            deviceAdapter={deviceAdapter}
            experimentStore={experimentStore}
            evidenceStore={evidenceStore}
            hypothesisStore={hypothesisStore}
            revealedGroundTruth={revealedGroundTruth}
            matchResult={matchResult}
            onSendObservation={onSendObservation}
            onRunAnotherMystery={onRunAnotherMystery}
            onReturnToWorkbench={onReturnToWorkbench}
          />
        </main>

        {/* Right 30%: Chronological Agent Narrative Rail */}
        <aside
          ref={agentRailRef}
          id="lab-agent-rail"
          style={{
            height: "100%",
            overflow: "hidden",
            background: "var(--ohmni-lab-raised, #FFFFFF)",
          }}
        >
          <InvestigationNarrativeRail
            agentState={agentState}
            investigationPhase={investigationPhase}
            hypothesis={hypothesis}
            ledgerEntries={ledgerEntries}
            pendingApproval={pendingApproval}
            agentMode={agentMode}
            onSwitchToDemo={onSwitchToDemo}
            onSetGoal={onSetGoal}
            onStartAgent={onStartAgent}
            onStopAgent={onStopAgent}
            onApprove={onApproveTest}
            onDeny={onDenyTest}
            onSelectScene={(scene) => setActiveSceneOverride(scene)}
          />
        </aside>
      </div>
    </motion.div>
  );
};
