/**
 * Root Application Component for OHMNI Hardware Diagnostic Workbench.
 * Master Milestone 8 — Blind Hardware Investigation + Product Hardening + Judge-Ready Release.
 *
 * Implements the Core Product Workflow:
 * 1. World 1: Welcome View (Editorial Narrative + 3D Brand Anchor)
 * 2. Mystery Intro: Sealed Ground Truth (Hidden from Agent Context) + Public Symptom
 * 3. World 2: Investigation Lab Mode (70% Live Scene + 30% Chronological Narrative)
 * 4. Human Intervention & Repair: First-Class Physical Manipulation + Continuation
 * 5. Ground Truth Reveal: Final Payoff comparing unsealed ground truth with agent diagnosis.
 * 6. Developer Inspector: Protocol compliance & modelContext proof [Cmd+Shift+D].
 */

import React, { useMemo, useState, useCallback, useEffect, useRef } from "react";
import type { DeviceAdapter } from "@/domain/device/adapter";
import type { DeviceToolRegistrar } from "@/infrastructure/webmcp/device-tool-registrar";
import type { ITelemetryEventBus } from "@/domain/telemetry/bus";
import type { ExperimentRunner } from "@/domain/experiment/runner";
import type { EvidenceStore } from "@/domain/evidence/store";
import type { HypothesisStore } from "@/domain/hypothesis/store";
import type { ScenarioSession, ScenarioGroundTruth, ScenarioId } from "@/domain/scenario/types";
import type { AgentMode } from "@/infrastructure/bench-agent/types";
import { resetInvestigationSession } from "@/domain/investigation/session-reset";

import { WelcomeView } from "./components/welcome/WelcomeView";
import { InvestigationStoryView } from "./components/investigation-story/InvestigationStoryView";
import { RepairVerificationScene } from "./components/repair/RepairVerificationScene";
import { MysteryIntroModal } from "./components/mystery/MysteryIntroModal";
import { GroundTruthRevealScene } from "./components/mystery/GroundTruthRevealScene";
import { DeveloperInspector } from "./components/inspector/DeveloperInspector";

import { useDeviceState } from "./hooks/useDeviceState";
import { useExperimentTimeline } from "./hooks/useExperimentTimeline";
import { useOscilloscopeBuffer } from "./hooks/useOscilloscopeBuffer";
import { useBenchAgent } from "./hooks/useBenchAgent";
import { useEvidenceStore } from "./hooks/useEvidenceStore";
import { useHypothesisStore } from "./hooks/useHypothesisStore";
import { useLandingToLabTransition } from "./hooks/useLandingToLabTransition";
import { useWebMCPTools } from "./hooks/useWebMCPTools";

import { createScenarioSession, startMysteryScenario, matchDiagnosis, type DiagnosisMatchResult } from "@/domain/scenario";

import "./theme/tokens.css";

export interface AppProps {
  readonly deviceAdapter?: DeviceAdapter;
  readonly toolRegistrar?: DeviceToolRegistrar;
  readonly telemetryBus?: ITelemetryEventBus;
  readonly experimentRunner?: ExperimentRunner;
  readonly evidenceStore?: EvidenceStore;
  readonly hypothesisStore?: HypothesisStore;
}

export const App: React.FC<AppProps> = ({
  deviceAdapter,
  toolRegistrar,
  telemetryBus,
  experimentRunner,
  evidenceStore,
  hypothesisStore,
}) => {
  const resolvedAdapter = useMemo(() => {
    return deviceAdapter ?? (typeof window !== "undefined" ? window.__virtualDevice : undefined);
  }, [deviceAdapter]);

  const resolvedRegistrar = useMemo(() => {
    return toolRegistrar ?? (typeof window !== "undefined" ? window.__toolRegistrar : undefined);
  }, [toolRegistrar]);

  const resolvedBus = useMemo(() => {
    return telemetryBus ?? (typeof window !== "undefined" ? window.__telemetryBus : undefined);
  }, [telemetryBus]);

  const resolvedEvidenceStore = useMemo(() => {
    if (evidenceStore) return evidenceStore;
    if (typeof window !== "undefined" && window.__evidenceStore) return window.__evidenceStore;
    if (experimentRunner) return experimentRunner.getEvidenceStore();
    return undefined;
  }, [evidenceStore, experimentRunner]);

  const resolvedHypothesisStore = useMemo(() => {
    if (hypothesisStore) return hypothesisStore;
    if (typeof window !== "undefined" && window.__hypothesisStore) return window.__hypothesisStore;
    return undefined;
  }, [hypothesisStore]);

  // View mode: "welcome" | "investigation" | "repair" | "reveal"
  const [viewMode, setViewMode] = useState<"welcome" | "investigation" | "repair" | "reveal">("welcome");

  // Mystery Scenario State
  const [activeScenario, setActiveScenario] = useState<ScenarioSession | null>(null);
  const [showMysteryIntro, setShowMysteryIntro] = useState<boolean>(false);
  const [revealedGroundTruth, setRevealedGroundTruth] = useState<ScenarioGroundTruth | null>(null);
  const [matchResult, setMatchResult] = useState<DiagnosisMatchResult | null>(null);

  // Developer Inspector Drawer State
  const [devInspectorOpen, setDevInspectorOpen] = useState<boolean>(false);

  // GSAP Transition Refs
  const rootContainerRef = useRef<HTMLDivElement | null>(null);
  const wordmarkRef = useRef<HTMLDivElement | null>(null);
  const heroTextRef = useRef<HTMLDivElement | null>(null);
  const hardwareVisualRef = useRef<HTMLDivElement | null>(null);
  const ctaButtonRef = useRef<HTMLButtonElement | null>(null);
  const labChromeRef = useRef<HTMLElement | null>(null);
  const labMainSceneRef = useRef<HTMLElement | null>(null);
  const agentRailRef = useRef<HTMLElement | null>(null);
  const { playTransition } = useLandingToLabTransition();

  // Hook subscriptions
  const {
    isConnected,
    descriptor,
    relayState,
    resetCount,
    railVoltage,
    connect,
    disconnect,
  } = useDeviceState(resolvedAdapter);

  const {
    activeExperimentId,
    experimentStatus,
  } = useExperimentTimeline(resolvedBus);

  const { ringBufferRef, markersRef } = useOscilloscopeBuffer(resolvedBus);
  const queryAgentMode = useMemo<AgentMode | undefined>(() => {
    if (typeof window === "undefined") return undefined;
    const params = new URLSearchParams(window.location.search);
    const mode = params.get("agent");
    if (mode === "demo" || mode === "gemini") {
      return mode;
    }
    return undefined;
  }, []);

  const {
    state: agentState,
    agentMode,
    setAgentMode,
    setGoal,
    start: startAgent,
    sendObservation: sendAgentObservation,
    stop: stopAgent,
    approve: approveAgent,
    deny: denyAgent,
    retryAvailability,
    reset: resetAgent,
  } = useBenchAgent(isConnected, queryAgentMode);

  const { records: evidenceRecords } = useEvidenceStore(resolvedEvidenceStore);
  const { hypotheses } = useHypothesisStore(resolvedHypothesisStore);
  const { tools: registeredTools, isNative: isNativeWebMCP } = useWebMCPTools();

  const activeHypothesis = hypotheses.length > 0 ? hypotheses[0] : null;

  // Keyboard shortcut listener for Developer Inspector [Cmd+Shift+D or Ctrl+Shift+D]
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === "D" || e.key === "d")) {
        e.preventDefault();
        setDevInspectorOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Detect explicit URL query param ?scenario=... for developer testing
  const queryScenarioId = useMemo<ScenarioId | undefined>(() => {
    if (typeof window === "undefined") return undefined;
    const params = new URLSearchParams(window.location.search);
    const scen = params.get("scenario");
    if (scen === "brownout" || scen === "i2c_address" || scen === "sda_fault") {
      return scen;
    }
    return undefined;
  }, []);

  // Setup initial scenario if requested via URL
  useEffect(() => {
    if (queryScenarioId && !activeScenario) {
      const session = createScenarioSession({ scenarioId: queryScenarioId });
      setActiveScenario(session);
    }
  }, [queryScenarioId, activeScenario]);

  // Action: Start Mystery Diagnosis
  const handleStartMystery = useCallback(() => {
    const session = createScenarioSession({ scenarioId: queryScenarioId });
    setActiveScenario(session);

    // Apply scenario initial configuration to virtual device
    const initConfig = session.getInitialDeviceConfig();
    if (resolvedAdapter && typeof (resolvedAdapter as any).reset === "function") {
      (resolvedAdapter as any).reset(initConfig);
    } else if (resolvedAdapter && typeof resolvedAdapter.setInterventionPoint === "function") {
      if (initConfig.initialRelayPower) {
        resolvedAdapter.setInterventionPoint("relay_power_jumper", initConfig.initialRelayPower);
      }
      if (initConfig.initialSensorAddress) {
        resolvedAdapter.setInterventionPoint("sensor_address_selector", initConfig.initialSensorAddress);
      }
      if (initConfig.initialSdaConnected !== undefined) {
        resolvedAdapter.setInterventionPoint("sda_connection", initConfig.initialSdaConnected ? "connected" : "unseated");
      }
    }
    setShowMysteryIntro(true);
  }, [queryScenarioId, resolvedAdapter]);

  // Action: Begin Investigation from Mystery Intro Modal
  const handleBeginInvestigation = useCallback(async () => {
    setShowMysteryIntro(false);

    if (!activeScenario) return;

    const goal = `${activeScenario.publicSymptom} Investigate the root cause using the available WebMCP diagnostic instruments, request physical help when needed, and experimentally verify the repair.`;
    setGoal(goal);

    // Initiate hardware connection
    const connectPromise = (async () => {
      await connect();
      if (resolvedAdapter && resolvedRegistrar) {
        await resolvedRegistrar.registerDevice(resolvedAdapter);
      }
    })();

    setViewMode("investigation");

    void connectPromise
      .then(() => {
        startAgent();
      })
      .catch((err) => {
        console.error("Failed to connect hardware during transition:", err);
      });

    // Execute GSAP transition in parallel
    playTransition(
      {
        rootContainerRef,
        wordmarkRef,
        heroTextRef,
        hardwareVisualRef,
        ctaButtonRef,
        labChromeRef,
        labMainSceneRef,
        agentRailRef,
      },
      () => undefined
    );
  }, [activeScenario, setGoal, connect, resolvedAdapter, resolvedRegistrar, playTransition, startAgent]);

  // Action: Deterministic Brownout Demo (Secondary CTA)
  const handleStartDemo = useCallback(() => {
    setAgentMode("demo");
    const session = createScenarioSession({ scenarioId: "brownout" });
    setActiveScenario(session);

    const goal = "The controller unexpectedly restarts when the fan turns on. Investigate the cause using the available instruments.";
    setGoal(goal);
    const connectPromise = (async () => {
      await connect();
      if (resolvedAdapter && resolvedRegistrar) {
        await resolvedRegistrar.registerDevice(resolvedAdapter);
      }
    })();

    playTransition(
      {
        rootContainerRef,
        wordmarkRef,
        heroTextRef,
        hardwareVisualRef,
        ctaButtonRef,
        labChromeRef,
        labMainSceneRef,
        agentRailRef,
      },
      async () => {
        try {
          await connectPromise;
        } catch (err) {
          console.error("Failed to connect hardware during transition:", err);
        }
        setViewMode("investigation");
      }
    );
  }, [connect, resolvedAdapter, resolvedRegistrar, setGoal, playTransition]);

  const handleConnectHardware = useCallback(async () => {
    try {
      await connect();
      if (resolvedAdapter && resolvedRegistrar) {
        await resolvedRegistrar.registerDevice(resolvedAdapter);
      }
      setViewMode("investigation");
    } catch (err) {
      console.error("Failed to connect hardware:", err);
    }
  }, [connect, resolvedAdapter, resolvedRegistrar]);

  const handleToggleConnect = useCallback(async () => {
    if (isConnected) {
      if (resolvedAdapter && resolvedRegistrar) {
        resolvedRegistrar.unregisterDevice(resolvedAdapter);
      }
      await disconnect();
      setViewMode("welcome");
    } else {
      await handleConnectHardware();
    }
  }, [isConnected, resolvedAdapter, resolvedRegistrar, disconnect, handleConnectHardware]);

  // Check for verified hypothesis and trigger Ground Truth Reveal payoff
  useEffect(() => {
    if (activeHypothesis?.verificationStatus === "VERIFIED" && activeScenario && viewMode !== "reveal") {
      activeScenario.markVerified();
      try {
        const gt = activeScenario.revealGroundTruth();
        setRevealedGroundTruth(gt);

        const rootCause =
          activeHypothesis && "rootCauseCategory" in activeHypothesis && typeof activeHypothesis.rootCauseCategory === "string"
            ? activeHypothesis.rootCauseCategory
            : undefined;
        const match = matchDiagnosis(gt, activeHypothesis.title, activeHypothesis.description, rootCause);
        setMatchResult(match);
        setViewMode("reveal");
      } catch (err) {
        console.error("Error revealing ground truth:", err);
      }
    }
  }, [activeHypothesis, activeScenario, viewMode]);

  // Action: Manual Ground Truth Reveal (Condition B: Forfeit/End investigation)
  const handleManualReveal = useCallback(() => {
    if (activeScenario && viewMode !== "reveal") {
      try {
        const gt = activeScenario.revealGroundTruth({ allowIncomplete: true });
        setRevealedGroundTruth(gt);
        const rootCause =
          activeHypothesis && "rootCauseCategory" in activeHypothesis && typeof activeHypothesis.rootCauseCategory === "string"
            ? activeHypothesis.rootCauseCategory
            : undefined;
        const match = activeHypothesis
          ? matchDiagnosis(gt, activeHypothesis.title, activeHypothesis.description, rootCause)
          : { isMatch: false, score: 0, reason: "Agent diagnosis incomplete / unmatched.", matchedTags: [] };
        setMatchResult(match);
        setViewMode("reveal");
      } catch (err) {
        console.error("Error manually revealing ground truth:", err);
      }
    }
  }, [activeScenario, viewMode, activeHypothesis]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      (window as unknown as { __revealGroundTruth?: () => void }).__revealGroundTruth = handleManualReveal;
    }
  }, [handleManualReveal]);

  // Action: Run another mystery
  const handleRunAnotherMystery = useCallback(() => {
    setViewMode("welcome");
    setRevealedGroundTruth(null);
    setMatchResult(null);

    resetInvestigationSession({
      scenarioSession: activeScenario,
      virtualAdapter: resolvedAdapter as any,
      experimentStore: experimentRunner?.getStore() ?? (typeof window !== "undefined" ? window.__experimentStore : undefined),
      evidenceStore: resolvedEvidenceStore,
      hypothesisStore: resolvedHypothesisStore,
      benchAgentReset: resetAgent,
      toolRegistrar: resolvedRegistrar,
    });

    handleStartMystery();
  }, [
    handleStartMystery,
    activeScenario,
    resolvedAdapter,
    experimentRunner,
    resolvedEvidenceStore,
    resolvedHypothesisStore,
    resetAgent,
    resolvedRegistrar,
  ]);

  return (
    <div
      ref={rootContainerRef}
      id="ohmni-app-root"
      style={{
        position: "relative",
        width: "100%",
        maxWidth: "100%",
        height: "100vh",
        overflow: "hidden",
        backgroundColor: viewMode === "welcome" ? "var(--ohmni-intro-bg, #F5F6F8)" : "var(--ohmni-lab-canvas, #F4F5F7)",
        boxSizing: "border-box",
      }}
    >
      {/* State 1: World 1 — Landing Welcome View */}
      {viewMode === "welcome" && (
        <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", zIndex: 40, boxSizing: "border-box" }}>
          <WelcomeView
            onStartMystery={handleStartMystery}
            onStartDemo={handleStartDemo}
            onConnectHardware={handleConnectHardware}
            wordmarkRef={wordmarkRef}
            heroTextRef={heroTextRef}
            hardwareVisualRef={hardwareVisualRef}
            ctaButtonRef={ctaButtonRef}
          />
        </div>
      )}

      {/* Mystery Introduction Modal */}
      {showMysteryIntro && activeScenario && (
        <MysteryIntroModal
          session={activeScenario}
          isDevMode={Boolean(queryScenarioId)}
          onBegin={handleBeginInvestigation}
          onCancel={() => setShowMysteryIntro(false)}
        />
      )}

      {/* State 2: World 2 — Lab Mode Workbench */}
      <div
        style={{
          width: "100%",
          height: "100%",
          display: viewMode === "repair" || viewMode === "reveal" ? "none" : "flex",
          flexDirection: "column",
          boxSizing: "border-box",
        }}
      >
        <InvestigationStoryView
          isConnected={isConnected}
          descriptor={descriptor}
          relayState={relayState}
          resetCount={resetCount}
          railVoltage={railVoltage}
          experimentStatus={experimentStatus}
          ringBufferRef={ringBufferRef}
          markersRef={markersRef}
          evidenceRecords={evidenceRecords}
          hypothesis={activeHypothesis}
          agentState={agentState}
          activeScenario={activeScenario}
          onSetGoal={setGoal}
          onStartAgent={startAgent}
          onStopAgent={stopAgent}
          onApproveTest={approveAgent}
          onDenyTest={denyAgent}
          onToggleConnect={handleToggleConnect}
          onProceedToRepair={() => setViewMode("repair")}
          onOpenDevInspector={() => setDevInspectorOpen(true)}
          agentMode={agentMode}
          onSwitchToDemo={() => setAgentMode("demo")}
          onRetryGemini={retryAvailability}
          labChromeRef={labChromeRef}
          labMainSceneRef={labMainSceneRef}
          agentRailRef={agentRailRef}
        />
      </div>

      {/* State 3: Human Intervention & Repair Verification */}
      {viewMode === "repair" && (
        <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", zIndex: 50, boxSizing: "border-box" }}>
          <RepairVerificationScene
            deviceAdapter={resolvedAdapter}
            experimentStore={experimentRunner?.getStore() ?? (typeof window !== "undefined" ? window.__experimentStore : undefined)}
            evidenceStore={resolvedEvidenceStore}
            hypothesisStore={resolvedHypothesisStore}
            hypothesis={activeHypothesis}
            agentState={agentState}
            onSendObservation={sendAgentObservation}
            onApproveTest={approveAgent}
            onDenyTest={denyAgent}
            onReturnToInvestigation={() => setViewMode("investigation")}
          />
        </div>
      )}

      {/* State 4: Dedicated Ground Truth Reveal Payoff Scene */}
      {viewMode === "reveal" && revealedGroundTruth && matchResult && (
        <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", zIndex: 60, overflowY: "auto", background: "var(--ohmni-lab-canvas, #F4F5F7)", boxSizing: "border-box" }}>
          <GroundTruthRevealScene
            groundTruth={revealedGroundTruth}
            hypothesis={activeHypothesis}
            matchResult={matchResult}
            evidenceRecords={evidenceRecords}
            toolsUsedCount={agentState.activity.filter((a) => a.status === "completed").length}
            experimentsCount={evidenceRecords.filter((e) => e.type === "test_result").length}
            humanInterventionsCount={evidenceRecords.filter((e) => e.source === "human").length}
            isVerified={activeScenario?.isVerified ?? false}
            onRunAnotherMystery={handleRunAnotherMystery}
            onReturnToWorkbench={() => setViewMode("investigation")}
          />
        </div>
      )}

      {/* Developer Inspector Drawer */}
      <DeveloperInspector
        isOpen={devInspectorOpen}
        onClose={() => setDevInspectorOpen(false)}
        isNativeWebMCP={isNativeWebMCP}
        registeredTools={registeredTools}
        activeScenario={activeScenario}
        evidenceRecords={evidenceRecords}
        hypotheses={hypotheses}
        latestToolResult={
          agentState.activity.length > 0
            ? {
                toolName: agentState.activity[agentState.activity.length - 1].call.name,
                result: agentState.activity[agentState.activity.length - 1].result ?? "",
                timestamp: Date.now(),
              }
            : null
        }
        activeExperimentId={activeExperimentId ?? undefined}
      />
    </div>
  );
};
