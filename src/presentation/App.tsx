/**
 * Root Application Component for OHMNI Hardware Diagnostic Workbench.
 * Connects domain adapters and telemetry pipelines to the React presentation layer.
 * Implements Mode 1 (Intro / Ready) and Mode 2 (Investigation Workbench).
 */

import React, { useMemo, useState } from "react";
import type { DeviceAdapter } from "@/domain/device/adapter";
import type { DeviceToolRegistrar } from "@/infrastructure/webmcp/device-tool-registrar";
import type { ITelemetryEventBus } from "@/domain/telemetry/bus";
import type { ExperimentRunner } from "@/domain/experiment/runner";
import type { EvidenceStore } from "@/domain/evidence/store";
import type { HypothesisStore } from "@/domain/hypothesis/store";

import { WorkbenchLayout } from "./components/layout/WorkbenchLayout";
import { TopBar } from "./components/layout/TopBar";
import { DevicePanel } from "./components/device/DevicePanel";
import { Oscilloscope } from "./components/instruments/Oscilloscope";
import { MetricStrip } from "./components/instruments/MetricStrip";
import { ExperimentStatusCard } from "./components/instruments/ExperimentStatusCard";
import { EventTimeline } from "./components/timeline/EventTimeline";
import { InvestigationPanel } from "./components/investigation/InvestigationPanel";
import { VirtualBenchControls } from "./components/controls/VirtualBenchControls";
import { BenchAgentPanel } from "./components/agent/BenchAgentPanel";
import { useDeviceState } from "./hooks/useDeviceState";
import { useExperimentTimeline } from "./hooks/useExperimentTimeline";
import { useOscilloscopeBuffer } from "./hooks/useOscilloscopeBuffer";
import { Zap, Sparkles, ArrowRight, Sliders, Cpu, Activity, Bot } from "lucide-react";

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

  const [selectedEvidenceId, setSelectedEvidenceId] = useState<string | null>(null);
  const [selectedHypothesisId, setSelectedHypothesisId] = useState<string | null>(null);
  const [highlightedExperimentId, setHighlightedExperimentId] = useState<string | null>(null);

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
    recordWebMCPStart,
    recordWebMCPComplete,
  } = useExperimentTimeline(resolvedBus);

  const { ringBufferRef, markersRef, clear: clearScope } = useOscilloscopeBuffer(resolvedBus);

  const handleStartVirtualDiagnosis = async () => {
    try {
      await connect();
      if (resolvedAdapter && resolvedRegistrar) {
        await resolvedRegistrar.registerDevice(resolvedAdapter);
      }
      // Populate standard scenario goal in the goal input textarea if present
      const goalInput = document.querySelector<HTMLTextAreaElement>("[data-testid='bench-agent-goal-input']");
      if (goalInput) {
        const proto = Object.getPrototypeOf(goalInput);
        const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
        setter?.call(goalInput, "The controller unexpectedly restarts when the fan turns on. Investigate the cause using the available instruments.");
        goalInput.dispatchEvent(new Event("input", { bubbles: true }));
        goalInput.dispatchEvent(new Event("change", { bubbles: true }));
      }
    } catch (err) {
      console.error("Failed to start virtual diagnosis:", err);
    }
  };

  const handleToggleConnection = async () => {
    if (isConnected) {
      if (resolvedAdapter && resolvedRegistrar) {
        resolvedRegistrar.unregisterDevice(resolvedAdapter);
      }
      await disconnect();
    } else {
      await connect();
      if (resolvedAdapter && resolvedRegistrar) {
        await resolvedRegistrar.registerDevice(resolvedAdapter);
      }
    }
  };

  return (
    <WorkbenchLayout
      topBar={
        <TopBar
          isConnected={isConnected}
          descriptor={descriptor}
          statusVisual={statusVisual}
          onToggleConnect={handleToggleConnection}
        />
      }
      leftPanel={
        <DevicePanel
          isConnected={isConnected}
          descriptor={descriptor}
          relayState={relayState}
          resetCount={resetCount}
          railVoltage={railVoltage}
          statusVisual={statusVisual}
          isRelayTargeted={experimentStatus === "running" || relayState === "closed"}
        />
      }
      centerPanel={
        <>
          {/* Mode 1 Intro Hero Banner (when disconnected or for quick onboarding) */}
          {!isConnected && (
            <div
              style={{
                background: "linear-gradient(135deg, rgba(79, 107, 255, 0.12) 0%, rgba(53, 198, 244, 0.08) 50%, var(--ohmni-surface-raised) 100%)",
                border: "1px solid rgba(79, 107, 255, 0.25)",
                borderRadius: "var(--radius-lg)",
                padding: "1rem 1.25rem",
                display: "flex",
                flexDirection: "column",
                gap: "10px",
                boxShadow: "0 8px 24px rgba(0, 0, 0, 0.3)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "2px 8px",
                    borderRadius: "var(--radius-full)",
                    background: "rgba(53, 198, 244, 0.1)",
                    border: "1px solid rgba(53, 198, 244, 0.25)",
                    fontSize: "11px",
                    fontWeight: 600,
                    color: "var(--ohmni-signal)",
                  }}
                >
                  <Sparkles size={11} />
                  READY FOR DIAGNOSIS
                </div>

                <span className="metadata-text font-mono">13 Agent Instruments Ready</span>
              </div>

              <div>
                <h2 style={{ fontSize: "16px", fontWeight: 700, color: "var(--ohmni-text-primary)", margin: "0 0 4px" }}>
                  Hardware debugging that measures before it guesses.
                </h2>
                <p className="body-text" style={{ fontSize: "12px", margin: 0, color: "var(--ohmni-text-secondary)" }}>
                  Give your AI agent safe diagnostic instruments to reproduce supply brownouts, inspect reset history, and verify physical root cause.
                </p>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "2px" }}>
                <button
                  onClick={handleStartVirtualDiagnosis}
                  className="btn-primary"
                  style={{
                    padding: "8px 16px",
                    fontSize: "13px",
                    fontWeight: 600,
                  }}
                >
                  <Zap size={14} fill="currentColor" />
                  Start Virtual Diagnosis
                  <ArrowRight size={14} />
                </button>

                <button
                  onClick={handleToggleConnection}
                  className="btn-secondary"
                  style={{
                    padding: "8px 14px",
                    fontSize: "12px",
                  }}
                >
                  <Sliders size={13} />
                  Connect Hardware
                </button>
              </div>
            </div>
          )}

          {/* Virtual Bench Developer Controls */}
          <VirtualBenchControls
            adapter={resolvedAdapter}
            registrar={resolvedRegistrar}
            isConnected={isConnected}
            onConnect={connect}
            onDisconnect={disconnect}
            onExperimentStart={recordWebMCPStart}
            onExperimentComplete={recordWebMCPComplete}
            onClearScope={clearScope}
          />

          {/* Hero Instrument: Real-time 60fps Oscilloscope */}
          <div style={{ flex: 1, minHeight: "240px", display: "flex", flexDirection: "column" }}>
            <Oscilloscope
              ringBufferRef={ringBufferRef}
              markersRef={markersRef}
              isRunning={experimentStatus === "running"}
              nominalVoltage={3.31}
              safeThresholdVoltage={2.80}
            />
          </div>

          {/* Real-Time Telemetry Metric Strip */}
          <MetricStrip
            baselineVoltage={3.31}
            voltageSummary={voltageSummary}
            isRunning={experimentStatus === "running"}
            resetReason={resetReason}
            liveVoltage={railVoltage}
          />

          {/* Factual Experiment State & Cycle Accounting */}
          <ExperimentStatusCard
            status={experimentStatus}
            requestedCycles={requestedCycles}
            completedCycles={completedCycles}
            faultReproduced={faultReproduced}
            resetOccurred={resetOccurred}
            resetReason={resetReason}
            activeExperimentId={activeExperimentId}
          />
        </>
      }
      rightPanel={
        <div
          style={{
            height: "100%",
            minHeight: 0,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          {/* Agent Supervisor Panel */}
          <div
            style={{
              flex: "0 1 45%",
              minHeight: "260px",
              maxHeight: "380px",
              overflow: "hidden",
            }}
          >
            <BenchAgentPanel isConnected={isConnected} />
          </div>

          {/* Grounded Evidence & Hypothesis Investigation Panel */}
          <div style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
            <InvestigationPanel
              evidenceStore={resolvedEvidenceStore}
              hypothesisStore={resolvedHypothesisStore}
              selectedEvidenceId={selectedEvidenceId}
              onSelectEvidence={(record) => {
                setSelectedEvidenceId(record ? record.id : null);
                if (record?.experimentId) {
                  setHighlightedExperimentId(record.experimentId);
                }
              }}
              selectedHypothesisId={selectedHypothesisId}
              onSelectHypothesis={(h) => {
                setSelectedHypothesisId(h ? h.id : null);
              }}
              highlightedExperimentId={highlightedExperimentId}
              onHighlightExperiment={setHighlightedExperimentId}
            />
          </div>
        </div>
      }
      bottomTimeline={
        <EventTimeline
          events={events}
          lastCallInfo={lastCallInfo}
          highlightedExperimentId={highlightedExperimentId}
          isRunning={experimentStatus === "running"}
        />
      }
    />
  );
};
