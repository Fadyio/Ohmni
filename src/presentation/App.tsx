/**
 * Root Application Component for OHMNI Hardware Diagnostic Workbench.
 * Connects domain adapters and telemetry pipelines to the React presentation layer.
 */

import React, { useMemo } from "react";
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
import { useDeviceState } from "./hooks/useDeviceState";
import { useExperimentTimeline } from "./hooks/useExperimentTimeline";
import { useOscilloscopeBuffer } from "./hooks/useOscilloscopeBuffer";

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
    return (
      evidenceStore ??
      experimentRunner?.getEvidenceStore() ??
      (typeof window !== "undefined" ? (window as unknown as { __evidenceStore?: EvidenceStore }).__evidenceStore : undefined)
    );
  }, [evidenceStore, experimentRunner]);

  const resolvedHypothesisStore = useMemo(() => {
    return (
      hypothesisStore ??
      (typeof window !== "undefined"
        ? (window as unknown as { __hypothesisStore?: HypothesisStore }).__hypothesisStore
        : undefined)
    );
  }, [hypothesisStore]);

  const [selectedEvidenceId, setSelectedEvidenceId] = React.useState<string | null>(null);
  const [selectedHypothesisId, setSelectedHypothesisId] = React.useState<string | null>(null);
  const [highlightedExperimentId, setHighlightedExperimentId] = React.useState<string | null>(null);

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

  return (
    <WorkbenchLayout
      topBar={
        <TopBar
          isConnected={isConnected}
          descriptor={descriptor}
          statusVisual={statusVisual}
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
        />
      }
      centerPanel={
        <>
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

          {/* Hero Instrument: Real-time Oscilloscope */}
          <div style={{ flex: 1, minHeight: "280px", display: "flex", flexDirection: "column" }}>
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
      }
      bottomTimeline={
        <EventTimeline
          events={events}
          lastCallInfo={lastCallInfo}
          highlightedExperimentId={highlightedExperimentId}
        />
      }
    />
  );
};
