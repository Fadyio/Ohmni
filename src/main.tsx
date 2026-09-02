/**
 * Ohmni Hardware Diagnostic Workbench entry point.
 * Initializes the WebMCP context, domain adapters, telemetry pipeline,
 * and mounts the React Workbench presentation layer.
 */

import React from "react";
import { createRoot } from "react-dom/client";
import { VirtualDeviceAdapter } from "@/domain/device/virtual-adapter";
import { InMemoryModelContext } from "@/infrastructure/webmcp/in-memory-model-context";
import { DeviceToolRegistrar } from "@/infrastructure/webmcp/device-tool-registrar";
import { CapabilityRegistry } from "@/infrastructure/webmcp/capability-registry";
import { TelemetryEventBus } from "@/domain/telemetry/bus";
import { InMemoryExperimentStore } from "@/domain/experiment/store";
import { ExperimentRunner } from "@/domain/experiment/runner";
import { App } from "@/presentation/App";

declare global {
  interface Window {
    __virtualDevice?: VirtualDeviceAdapter;
    __toolRegistrar?: DeviceToolRegistrar;
    __telemetryBus?: TelemetryEventBus;
    __experimentStore?: InMemoryExperimentStore;
    __experimentRunner?: ExperimentRunner;
    __modelContext?: InMemoryModelContext;
  }
}

console.info("[Ohmni] Hardware Diagnostic Workbench initialized.");

// 1. Initialize or polyfill document.modelContext if not natively present
const modelContext =
  typeof document !== "undefined" && document.modelContext
    ? document.modelContext
    : new InMemoryModelContext();

if (typeof document !== "undefined" && !document.modelContext) {
  Object.defineProperty(document, "modelContext", {
    value: modelContext,
    writable: false,
    configurable: true,
  });
}

// 2. Initialize Telemetry & Experiment Pipeline
const telemetryBus = new TelemetryEventBus();
const experimentStore = new InMemoryExperimentStore();
const experimentRunner = new ExperimentRunner({
  eventBus: telemetryBus,
  store: experimentStore,
});

// 3. Initialize Virtual Device & Tool Registrar
const virtualDevice = new VirtualDeviceAdapter();
const capabilityRegistry = new CapabilityRegistry(experimentRunner);
const toolRegistrar = new DeviceToolRegistrar(modelContext, capabilityRegistry);

if (typeof window !== "undefined") {
  window.__virtualDevice = virtualDevice;
  window.__toolRegistrar = toolRegistrar;
  window.__telemetryBus = telemetryBus;
  window.__experimentStore = experimentStore;
  window.__experimentRunner = experimentRunner;
  if (modelContext instanceof InMemoryModelContext) {
    window.__modelContext = modelContext;
  }
}

// 4. Mount React Workbench Presentation Layer
if (typeof document !== "undefined") {
  const container = document.getElementById("app");
  if (container) {
    const root = createRoot(container);
    root.render(
      <React.StrictMode>
        <App
          deviceAdapter={virtualDevice}
          toolRegistrar={toolRegistrar}
          telemetryBus={telemetryBus}
          experimentRunner={experimentRunner}
        />
      </React.StrictMode>
    );
  }
}
