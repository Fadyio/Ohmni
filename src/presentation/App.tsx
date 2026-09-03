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
import type { RegisteredTool } from "@/infrastructure/webmcp/types";
import type { WebMCPExecutionCoordinator } from "@/infrastructure/webmcp/execution-coordinator";
import type { ITelemetryEventBus } from "@/domain/telemetry/bus";
import type { ExperimentRunner } from "@/domain/experiment/runner";
import type { EvidenceStore } from "@/domain/evidence/store";
import type { HypothesisStore } from "@/domain/hypothesis/store";
import type { ScenarioSession, ScenarioGroundTruth, ScenarioId } from "@/domain/scenario/types";
import type { AgentMode } from "@/infrastructure/bench-agent/types";
import type { ToolLedgerEntry } from "@/domain/investigation/tool-ledger";
import type { ToolApprovalRequest } from "@/domain/safety/approval-gate";
import { resetInvestigationSession } from "@/domain/investigation/session-reset";
import { ConnectHardwareModal } from "./components/welcome/ConnectHardwareModal";
import { WebSerialTransport } from "@/infrastructure/serial/web-serial-transport";
import { LoopbackSerialTransport } from "@/infrastructure/serial/loopback-serial-transport";
import { ReferenceSerialDeviceSimulator } from "@/infrastructure/serial/reference-simulator";
import { SerialDeviceAdapter } from "@/infrastructure/serial/serial-device-adapter";
import { VirtualDeviceAdapter } from "@/domain/device/virtual-adapter";

import { WelcomeView } from "./components/welcome/WelcomeView";
import { InvestigationStoryView } from "./components/investigation-story/InvestigationStoryView";
import { RepairVerificationScene } from "./components/repair/RepairVerificationScene";
import { MysteryIntroModal } from "./components/mystery/MysteryIntroModal";
import { GroundTruthRevealScene } from "./components/mystery/GroundTruthRevealScene";
import { DeveloperInspector } from "./components/inspector/DeveloperInspector";
import { useDeviceState } from "./hooks/useDeviceState";
import { useExperimentTimeline } from "./hooks/useExperimentTimeline";
import { useOscilloscopeBuffer } from "./hooks/useOscilloscopeBuffer";
import {
  useBenchAgent,
  type BenchAgentActivity,
  type BenchAgentState,
} from "./hooks/useBenchAgent";
import { useEvidenceStore } from "./hooks/useEvidenceStore";
import { useHypothesisStore } from "./hooks/useHypothesisStore";
import { useLandingToLabTransition } from "./hooks/useLandingToLabTransition";
import { useWebMCPTools } from "./hooks/useWebMCPTools";

import { createScenarioSession, startMysteryScenario, matchDiagnosis, type DiagnosisMatchResult } from "@/domain/scenario";

import "./theme/tokens.css";
function serializeToolResult(result: unknown): string | undefined {
  if (result === undefined) return undefined;
  if (typeof result === "string") return result;
  try {
    return JSON.stringify(result);
  } catch {
    return String(result);
  }
}

function activityFromLedger(
  entries: readonly ToolLedgerEntry[]
): readonly BenchAgentActivity[] {
  return entries.map((entry) => ({
    call: {
      id: entry.id,
      name: entry.toolName,
      arguments: entry.input,
    },
    status: entry.status,
    result: serializeToolResult(entry.result),
    message: entry.error,
    durationMs: entry.durationMs,
  }));
}


export interface AppProps {
  readonly deviceAdapter?: DeviceAdapter;
  readonly toolRegistrar?: DeviceToolRegistrar;
  readonly telemetryBus?: ITelemetryEventBus;
  readonly experimentRunner?: ExperimentRunner;
  readonly evidenceStore?: EvidenceStore;
  readonly hypothesisStore?: HypothesisStore;
  readonly executionCoordinator?: WebMCPExecutionCoordinator;
}

export const App: React.FC<AppProps> = ({
  deviceAdapter,
  toolRegistrar,
  telemetryBus,
  experimentRunner,
  evidenceStore,
  hypothesisStore,
  executionCoordinator,
}) => {
  const defaultVirtualAdapter = useMemo(() => {
    return deviceAdapter ?? (typeof window !== "undefined" ? window.__virtualDevice : undefined) ?? new VirtualDeviceAdapter();
  }, [deviceAdapter]);

  const [activeAdapter, setActiveAdapter] = useState<DeviceAdapter>(defaultVirtualAdapter);
  const [deviceMode, setDeviceMode] = useState<"virtual" | "physical">("virtual");
  const [showConnectModal, setShowConnectModal] = useState<boolean>(false);

  const resolvedRegistrar = useMemo(() => {
    return toolRegistrar ?? (typeof window !== "undefined" ? window.__toolRegistrar : undefined);
  }, [toolRegistrar]);
  const resolvedBus = useMemo(() => {
    return telemetryBus ?? (typeof window !== "undefined" ? window.__telemetryBus : undefined);
  }, [telemetryBus]);
  const resolvedCoordinator = useMemo(() => {
    return executionCoordinator ??
      (typeof window !== "undefined" ? window.__executionCoordinator : undefined);
  }, [executionCoordinator]);

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
  const [ledgerEntries, setLedgerEntries] = useState<readonly ToolLedgerEntry[]>(
    () => resolvedCoordinator ? [...resolvedCoordinator.toolLedger.getEntries()] : []
  );
  const [pendingApproval, setPendingApproval] = useState<ToolApprovalRequest | null>(
    () => resolvedCoordinator?.approvalGate.getPendingApproval() ?? null
  );

  useEffect(() => {
    if (!resolvedCoordinator) {
      setLedgerEntries([]);
      setPendingApproval(null);
      return;
    }

    const syncLedger = () => {
      setLedgerEntries([...resolvedCoordinator.toolLedger.getEntries()]);
    };
    syncLedger();
    const unsubscribeLedger = resolvedCoordinator.toolLedger.subscribe(syncLedger);
    const unsubscribeApproval = resolvedCoordinator.approvalGate.subscribe(setPendingApproval);
    const unsubscribeIntervention = resolvedCoordinator.onHumanInterventionRequested(() => {
      setViewMode("repair");
    });

    return () => {
      unsubscribeLedger();
      unsubscribeApproval();
      unsubscribeIntervention();
    };
  }, [resolvedCoordinator]);

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
  } = useDeviceState(activeAdapter);

  const {
    activeExperimentId,
    experimentStatus,
  } = useExperimentTimeline(resolvedBus);

  const { ringBufferRef, markersRef } = useOscilloscopeBuffer(resolvedBus);
  const queryAgentMode = useMemo<AgentMode | undefined>(() => {
    if (typeof window === "undefined") return undefined;
    const params = new URLSearchParams(window.location.search);
    const mode = params.get("agent");
    if (mode === "demo" || mode === "groq") {
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
  } = useBenchAgent(
    isConnected,
    queryAgentMode,
    resolvedCoordinator !== undefined
  );

  const { records: evidenceRecords } = useEvidenceStore(resolvedEvidenceStore);
  const { hypotheses } = useHypothesisStore(resolvedHypothesisStore);
  const { tools: registeredTools, isNative: isNativeWebMCP } = useWebMCPTools();
  const presentedAgentState = useMemo<BenchAgentState>(() => {
    const ledgerActivity = activityFromLedger(ledgerEntries);
    if (pendingApproval) {
      const call = {
        id: pendingApproval.id,
        name: pendingApproval.toolName,
        arguments: pendingApproval.input,
      };
      const matchedTool = registeredTools.find(
        (registeredTool) => registeredTool.name === pendingApproval.toolName
      );
      const tool: RegisteredTool = {
        name: pendingApproval.toolName,
        title: pendingApproval.toolTitle ?? matchedTool?.title,
        description: matchedTool?.description || pendingApproval.why || pendingApproval.toolName,
      };
      const activity =
        ledgerActivity.length > 0 ? ledgerActivity : agentState.activity;
      return {
        status: "approval",
        agentMode,
        liveProvider: agentState.liveProvider,
        liveModel: agentState.liveModel,
        goal: agentState.goal,
        runGoal: agentState.runGoal,
        activity,
        providerAvailable: true,
        providerStatus: agentState.providerStatus,
        steps: activity.length,
        approval: { call, tool },
      };
    }

    if (agentMode !== "external") return agentState;

    const common = {
      agentMode: "external" as const,
      goal: agentState.goal,
      runGoal: agentState.runGoal,
      activity: ledgerActivity,
      providerAvailable: true,
      providerStatus: "external" as const,
    };
    const lastEntry = ledgerEntries.at(-1);
    if (lastEntry?.status === "running" || lastEntry?.status === "waiting-approval") {
      return {
        ...common,
        status: "investigating",
        steps: ledgerActivity.length,
      };
    }
    if (lastEntry?.status === "failed") {
      return {
        ...common,
        status: "failed",
        steps: ledgerActivity.length,
        message: lastEntry.error ?? `Tool '${lastEntry.toolName}' failed.`,
      };
    }
    return {
      ...common,
      status: "idle",
      checkingAvailability: false,
    };
  }, [agentMode, agentState, ledgerEntries, pendingApproval, registeredTools]);
  useEffect(() => {
    if (typeof window !== "undefined") {
      (window as Window & { __benchAgentState?: BenchAgentState }).__benchAgentState =
        presentedAgentState;
    }
  }, [presentedAgentState]);

  const approveTest = useCallback(() => {
    if (
      pendingApproval &&
      resolvedCoordinator?.approvalGate.approve(pendingApproval.id)
    ) {
      return;
    }
    approveAgent();
  }, [approveAgent, pendingApproval, resolvedCoordinator]);

  const denyTest = useCallback(() => {
    if (
      pendingApproval &&
      resolvedCoordinator?.approvalGate.deny(pendingApproval.id)
    ) {
      return;
    }
    denyAgent();
  }, [denyAgent, pendingApproval, resolvedCoordinator]);

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

  const playWorkbenchEntryTransition = useCallback(() => {
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
  }, [playTransition]);

  // Action: Start Mystery Diagnosis
  const handleStartMystery = useCallback(() => {
    const requestedMode = queryAgentMode ?? "external";
    setAgentMode(requestedMode);
    setDeviceMode("virtual");
    setActiveAdapter(defaultVirtualAdapter);
    const session = createScenarioSession({ scenarioId: queryScenarioId });
    setActiveScenario(session);
    setGoal("The controller unexpectedly restarts when the fan turns on. Investigate the cause using the available instruments.");

    const initConfig = session.getInitialDeviceConfig();
    if (typeof (defaultVirtualAdapter as VirtualDeviceAdapter).reset === "function") {
      (defaultVirtualAdapter as VirtualDeviceAdapter).reset(initConfig);
    } else if (typeof defaultVirtualAdapter.setInterventionPoint === "function") {
      if (initConfig.initialRelayPower) {
        defaultVirtualAdapter.setInterventionPoint("relay_power_jumper", initConfig.initialRelayPower);
      }
      if (initConfig.initialSensorAddress) {
        defaultVirtualAdapter.setInterventionPoint("sensor_address_selector", initConfig.initialSensorAddress);
      }
      if (initConfig.initialSdaConnected !== undefined) {
        defaultVirtualAdapter.setInterventionPoint(
          "sda_connection",
          initConfig.initialSdaConnected ? "connected" : "unseated"
        );
      }
    }

    if (requestedMode !== "external") {
      setShowMysteryIntro(true);
      return;
    }

    setShowMysteryIntro(false);
    setViewMode("investigation");
    const connectPromise = (async () => {
      if (activeAdapter !== defaultVirtualAdapter && activeAdapter.isConnected()) {
        resolvedRegistrar?.unregisterDevice(activeAdapter);
        await activeAdapter.disconnect();
      }
      if (!defaultVirtualAdapter.isConnected()) {
        await defaultVirtualAdapter.connect();
      }
      if (resolvedRegistrar) {
        await resolvedRegistrar.registerDevice(defaultVirtualAdapter);
      }
    })();
    void connectPromise.catch((err) => {
      console.error("Failed to open agent-ready virtual workbench:", err);
    });
    playWorkbenchEntryTransition();
  }, [
    activeAdapter,
    defaultVirtualAdapter,
    playWorkbenchEntryTransition,
    queryAgentMode,
    queryScenarioId,
    resolvedRegistrar,
    setAgentMode,
  ]);

  // Action: Begin Investigation from Mystery Intro Modal
  const handleBeginInvestigation = useCallback(async () => {
    setShowMysteryIntro(false);

    if (!activeScenario) return;

    const goal = `${activeScenario.publicSymptom} Investigate the root cause using the available WebMCP diagnostic instruments, request human help at the device boundary when needed, and experimentally verify the repair.`;
    setGoal(goal);
    // Initiate hardware connection
    const connectPromise = (async () => {
      await connect();
      if (activeAdapter && resolvedRegistrar) {
        await resolvedRegistrar.registerDevice(activeAdapter);
      }
    })();

    setViewMode("investigation");

    void connectPromise.catch((err) => {
      console.error("Failed to connect hardware during transition:", err);
    });
    playWorkbenchEntryTransition();
  }, [activeScenario, agentMode, setGoal, connect, activeAdapter, resolvedRegistrar, playWorkbenchEntryTransition]);

  // Action: Deterministic Brownout Demo (Secondary CTA)
  const handleStartDemo = useCallback(() => {
    setAgentMode("demo");
    setDeviceMode("virtual");
    setActiveAdapter(defaultVirtualAdapter);
    const session = createScenarioSession({ scenarioId: "brownout" });
    setActiveScenario(session);

    const initConfig = session.getInitialDeviceConfig();
    if (defaultVirtualAdapter && typeof (defaultVirtualAdapter as any).reset === "function") {
      (defaultVirtualAdapter as any).reset(initConfig);
    }

    setGoal("The controller unexpectedly restarts when the fan turns on. Investigate the cause using the available instruments.");
    setShowMysteryIntro(true);
  }, [setGoal, setAgentMode, defaultVirtualAdapter]);

  const handleRunBuiltInDemo = useCallback(() => {
    const session = createScenarioSession({ scenarioId: "brownout" });
    const initConfig = session.getInitialDeviceConfig();
    if (typeof (defaultVirtualAdapter as VirtualDeviceAdapter).reset === "function") {
      (defaultVirtualAdapter as VirtualDeviceAdapter).reset(initConfig);
    }

    const launch = async () => {
      if (activeAdapter !== defaultVirtualAdapter && activeAdapter.isConnected()) {
        resolvedRegistrar?.unregisterDevice(activeAdapter);
        await activeAdapter.disconnect();
      }
      if (!defaultVirtualAdapter.isConnected()) {
        await defaultVirtualAdapter.connect();
      }
      if (resolvedRegistrar) {
        await resolvedRegistrar.registerDevice(defaultVirtualAdapter);
      }

      setActiveAdapter(defaultVirtualAdapter);
      setDeviceMode("virtual");
      setActiveScenario(session);
      setShowMysteryIntro(false);
      setAgentMode("demo");
      setGoal(
        "The controller unexpectedly restarts when the fan turns on. Investigate the cause using the available instruments."
      );
      startAgent();
    };

    void launch().catch((err) => {
      console.error("Failed to start built-in demo:", err);
    });
  }, [
    activeAdapter,
    defaultVirtualAdapter,
    resolvedRegistrar,
    setAgentMode,
    setGoal,
    startAgent,
  ]);


  const handleConnectPhysical = useCallback(async () => {
    const transport = new WebSerialTransport({ baudRate: 115200 });
    const serialAdapter = new SerialDeviceAdapter(transport);

    if (activeAdapter.isConnected()) {
      if (resolvedRegistrar) resolvedRegistrar.unregisterDevice(activeAdapter);
      await activeAdapter.disconnect();
    }

    await serialAdapter.connect();
    if (resolvedRegistrar) {
      await resolvedRegistrar.registerDevice(serialAdapter);
    }

    setActiveAdapter(serialAdapter);
    setDeviceMode("physical");
    setActiveScenario(null);

    if (typeof window !== "undefined") {
      (window as unknown as { __serialDeviceAdapter?: unknown }).__serialDeviceAdapter = serialAdapter;
    }

    setViewMode("investigation");
  }, [activeAdapter, resolvedRegistrar]);

  const handleConnectSimulatedSerial = useCallback(async () => {
    const [hostTransport, peerTransport] = LoopbackSerialTransport.createPair();
    const sim = new ReferenceSerialDeviceSimulator(peerTransport);
    const serialAdapter = new SerialDeviceAdapter(hostTransport);

    if (activeAdapter.isConnected()) {
      if (resolvedRegistrar) resolvedRegistrar.unregisterDevice(activeAdapter);
      await activeAdapter.disconnect();
    }

    await serialAdapter.connect();
    if (resolvedRegistrar) {
      await resolvedRegistrar.registerDevice(serialAdapter);
    }

    setActiveAdapter(serialAdapter);
    setDeviceMode("physical");
    setActiveScenario(null);

    if (typeof window !== "undefined") {
      (window as unknown as { __serialDeviceAdapter?: unknown; __serialSim?: unknown }).__serialDeviceAdapter = serialAdapter;
      (window as unknown as { __serialDeviceAdapter?: unknown; __serialSim?: unknown }).__serialSim = sim;
    }

    setViewMode("investigation");
  }, [activeAdapter, resolvedRegistrar]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      (window as unknown as { __connectSimulatedSerial?: () => Promise<void> }).__connectSimulatedSerial = handleConnectSimulatedSerial;
    }
  }, [handleConnectSimulatedSerial]);

  const handleToggleConnect = useCallback(async () => {
    if (isConnected) {
      if (activeAdapter && resolvedRegistrar) {
        resolvedRegistrar.unregisterDevice(activeAdapter);
      }
      await disconnect();
      setViewMode("welcome");
    } else {
      if (deviceMode === "physical") {
        setShowConnectModal(true);
      } else {
        await connect();
        if (activeAdapter && resolvedRegistrar) {
          await resolvedRegistrar.registerDevice(activeAdapter);
        }
      }
    }
  }, [isConnected, activeAdapter, resolvedRegistrar, disconnect, connect, deviceMode]);
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
      virtualAdapter: activeAdapter as any,
      experimentStore: experimentRunner?.getStore() ?? (typeof window !== "undefined" ? window.__experimentStore : undefined),
      evidenceStore: resolvedEvidenceStore,
      hypothesisStore: resolvedHypothesisStore,
      benchAgentReset: resetAgent,
      toolRegistrar: resolvedRegistrar,
    });
    resolvedCoordinator?.approvalGate.reset();
    resolvedCoordinator?.toolLedger.reset();

    handleStartMystery();
  }, [
    handleStartMystery,
    activeScenario,
    activeAdapter,
    experimentRunner,
    resolvedEvidenceStore,
    resolvedHypothesisStore,
    resetAgent,
    resolvedRegistrar,
    resolvedCoordinator,
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
            onConnectHardware={() => setShowConnectModal(true)}
            wordmarkRef={wordmarkRef}
            heroTextRef={heroTextRef}
            hardwareVisualRef={hardwareVisualRef}
            ctaButtonRef={ctaButtonRef}
          />
        </div>
      )}

      {/* Physical Hardware Connection Modal */}
      <ConnectHardwareModal
        isOpen={showConnectModal}
        onClose={() => setShowConnectModal(false)}
        onConnectPhysical={handleConnectPhysical}
        onConnectSimulatedSerial={handleConnectSimulatedSerial}
      />
      {showMysteryIntro && activeScenario && (
        <MysteryIntroModal
          session={activeScenario}
          isDevMode={Boolean(queryScenarioId)}
          agentMode={agentMode}
          liveProvider={agentState.liveProvider}
          liveModel={agentState.liveModel}
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
          agentState={presentedAgentState}
          ledgerEntries={ledgerEntries}
          pendingApproval={pendingApproval}
          registeredToolCount={registeredTools.length}
          activeScenario={activeScenario}
          onSetGoal={setGoal}
          onStartAgent={startAgent}
          onStopAgent={stopAgent}
          onApproveTest={approveTest}
          onDenyTest={denyTest}
          onToggleConnect={handleToggleConnect}
          onProceedToRepair={() => setViewMode("repair")}
          onOpenDevInspector={() => setDevInspectorOpen(true)}
          agentMode={agentMode}
          onSwitchToDemo={() => setAgentMode("demo")}
          onRetryAgent={retryAvailability}
          labChromeRef={labChromeRef}
          labMainSceneRef={labMainSceneRef}
          agentRailRef={agentRailRef}
        />
      </div>

      {/* State 3: Human Intervention & Repair Verification */}
      {viewMode === "repair" && (
        <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", zIndex: 50, boxSizing: "border-box" }}>
          <RepairVerificationScene
            deviceAdapter={activeAdapter}
            evidenceStore={resolvedEvidenceStore}
            hypothesisStore={resolvedHypothesisStore}
            hypothesis={activeHypothesis}
            agentState={presentedAgentState}
            onSendObservation={sendAgentObservation}
            onApproveTest={approveTest}
            onDenyTest={denyTest}
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
            toolsUsedCount={
              ledgerEntries.length > 0
                ? ledgerEntries.filter((entry) => entry.status === "completed").length
                : presentedAgentState.activity.filter((activity) => activity.status === "completed").length
            }
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
          presentedAgentState.activity.length > 0
            ? {
                toolName: presentedAgentState.activity[presentedAgentState.activity.length - 1].call.name,
                result: presentedAgentState.activity[presentedAgentState.activity.length - 1].result ?? "",
                timestamp: Date.now(),
              }
            : null
        }
        activeExperimentId={activeExperimentId ?? undefined}
        providerName={
          agentMode === "demo"
            ? "Deterministic Demo Provider"
            : agentMode === "external"
            ? "External WebMCP Agent"
            : `${(agentState.liveProvider ?? "Groq").toUpperCase()} ${agentState.liveModel ?? "openai/gpt-oss-120b"} (Vercel Serverless)`
        }
      />
    </div>
  );
};
