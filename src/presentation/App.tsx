/**
 * Root Application Component for OHMNI Hardware Diagnostic Workbench.
 * Connects domain adapters and telemetry pipelines to the React presentation layer.
 */

import React, { useMemo } from "react";
import type { DeviceAdapter } from "@/domain/device/adapter";
import type { DeviceToolRegistrar } from "@/infrastructure/webmcp/device-tool-registrar";
import type { ITelemetryEventBus } from "@/domain/telemetry/bus";
import type { ExperimentRunner } from "@/domain/experiment/runner";

import { WorkbenchLayout } from "./components/layout/WorkbenchLayout";
import { TopBar } from "./components/layout/TopBar";
import { DevicePanel } from "./components/device/DevicePanel";
import { Oscilloscope } from "./components/instruments/Oscilloscope";
import { MetricStrip } from "./components/instruments/MetricStrip";
import { ExperimentStatusCard } from "./components/instruments/ExperimentStatusCard";
import { EventTimeline } from "./components/timeline/EventTimeline";
import { InvestigationPlaceholder } from "./components/investigation/InvestigationPlaceholder";
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
}

export const App: React.FC<AppProps> = ({
  deviceAdapter,
  toolRegistrar,
  telemetryBus,
}) => {
  // Resolve instances from props or window globals
  const resolvedAdapter = useMemo(() => {
    return deviceAdapter ?? (typeof window !== "undefined" ? window.__virtualDevice : undefined);
  }, [deviceAdapter]);

  const resolvedRegistrar = useMemo(() => {
    return toolRegistrar ?? (typeof window !== "undefined" ? window.__toolRegistrar : undefined);
  }, [toolRegistrar]);

  const resolvedBus = useMemo(() => {
    return telemetryBus ?? (typeof window !== "undefined" ? window.__telemetryBus : undefined);
  }, [telemetryBus]);

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
      rightPanel={<InvestigationPlaceholder />}
      bottomTimeline={
        <EventTimeline
          events={events}
          lastCallInfo={lastCallInfo}
        />
      }
    />
  );
};
