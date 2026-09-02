/**
 * Root Application Component for OHMNI Hardware Diagnostic Workbench.
 *
 * Implements the 3 Core Experience States:
 * 1. World 1: Welcome View (Editorial Narrative + Floating Hardware Composition)
 * 2. World 2: Investigation Lab Mode (75% Live Scene + 25% Chronological Narrative)
 * 3. State 3: Repair Verification Scene (Physical Jumper Interaction + Split-Scope Comparison)
 *
 * Choreographed with GSAP landing-to-lab timeline transitions.
 */

import React, { useMemo, useState, useCallback, useEffect, useRef } from "react";
import type { DeviceAdapter } from "@/domain/device/adapter";
import type { DeviceToolRegistrar } from "@/infrastructure/webmcp/device-tool-registrar";
import type { ITelemetryEventBus } from "@/domain/telemetry/bus";
import type { ExperimentRunner } from "@/domain/experiment/runner";
import type { EvidenceStore } from "@/domain/evidence/store";
import type { HypothesisStore } from "@/domain/hypothesis/store";

import { WelcomeView } from "./components/welcome/WelcomeView";
import { InvestigationStoryView } from "./components/investigation-story/InvestigationStoryView";
import { RepairVerificationScene } from "./components/repair/RepairVerificationScene";
import { useDeviceState } from "./hooks/useDeviceState";
import { useExperimentTimeline } from "./hooks/useExperimentTimeline";
import { useOscilloscopeBuffer } from "./hooks/useOscilloscopeBuffer";
import { useBenchAgent } from "./hooks/useBenchAgent";
import { useEvidenceStore } from "./hooks/useEvidenceStore";
import { useHypothesisStore } from "./hooks/useHypothesisStore";
import { useLandingToLabTransition } from "./hooks/useLandingToLabTransition";

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

  // View state: "welcome" | "investigation" | "repair"
  const [viewMode, setViewMode] = useState<"welcome" | "investigation" | "repair">("welcome");

  // GSAP Transition Refs
  const rootContainerRef = useRef<HTMLDivElement | null>(null);
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
    statusVisual,
    railVoltage,
    connect,
    disconnect,
  } = useDeviceState(resolvedAdapter);

  const {
    activeExperimentId,
    experimentStatus,
    events,
    lastCallInfo,
    voltageSummary,
    requestedCycles,
    completedCycles,
    faultReproduced,
    resetOccurred,
    resetReason,
  } = useExperimentTimeline(resolvedBus);

  const { ringBufferRef, markersRef } = useOscilloscopeBuffer(resolvedBus);
  const { state: agentState, setGoal, start: startAgent, stop: stopAgent, approve: approveAgent, deny: denyAgent } = useBenchAgent(isConnected);
  const { records: evidenceRecords } = useEvidenceStore(resolvedEvidenceStore);
  const { hypotheses } = useHypothesisStore(resolvedHypothesisStore);

  const activeHypothesis = hypotheses.length > 0 ? hypotheses[0] : null;

  // Actions
  const handleStartDemo = useCallback(async () => {
    try {
      await connect();
      if (resolvedAdapter && resolvedRegistrar) {
        await resolvedRegistrar.registerDevice(resolvedAdapter);
      }
      setGoal("The controller unexpectedly restarts when the fan turns on. Investigate the cause using the available instruments.");

      // Execute GSAP Welcome -> Lab choreographic timeline
      playTransition(
        {
          rootContainerRef,
          heroTextRef,
          hardwareVisualRef,
          ctaButtonRef,
          labChromeRef,
          labMainSceneRef,
          agentRailRef,
        },
        () => {
          setViewMode("investigation");
        }
      );
    } catch (err) {
      console.error("Failed to start virtual diagnosis:", err);
      setViewMode("investigation");
    }
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
        backgroundColor: viewMode === "welcome" ? "var(--ohmni-intro-bg)" : "var(--ohmni-lab-canvas)",
        boxSizing: "border-box",
      }}
    >
      {viewMode === "welcome" && (
        <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", zIndex: 40, boxSizing: "border-box" }}>
          <WelcomeView
            onStartDemo={handleStartDemo}
            onConnectHardware={handleConnectHardware}
            heroTextRef={heroTextRef}
            hardwareVisualRef={hardwareVisualRef}
            ctaButtonRef={ctaButtonRef}
          />
        </div>
      )}

      {/* State 2: World 2 — Lab Mode Workbench */}
      <div style={{ width: "100%", height: "100%", display: viewMode === "repair" ? "none" : "flex", flexDirection: "column", boxSizing: "border-box" }}>
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
          onSetGoal={setGoal}
          onStartAgent={startAgent}
          onStopAgent={stopAgent}
          onApproveTest={approveAgent}
          onDenyTest={denyAgent}
          onToggleConnect={handleToggleConnect}
          onProceedToRepair={() => setViewMode("repair")}
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
            onReturnToInvestigation={() => setViewMode("investigation")}
          />
        </div>
      )}
    </div>
  );
};
