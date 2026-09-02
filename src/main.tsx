/**
 * Ohmni Hardware Diagnostic Workbench entry point.
 * Initializes the WebMCP context, domain adapters, telemetry pipeline,
 * and mounts the React Workbench presentation layer.
 */

import React from "react";
import { createRoot } from "react-dom/client";
import type { ModelContext } from "@/infrastructure/webmcp/types";
import { VirtualDeviceAdapter } from "@/domain/device/virtual-adapter";
import { InMemoryModelContext } from "@/infrastructure/webmcp/in-memory-model-context";
import { DeviceToolRegistrar } from "@/infrastructure/webmcp/device-tool-registrar";
import { CapabilityRegistry } from "@/infrastructure/webmcp/capability-registry";
import { TelemetryEventBus } from "@/domain/telemetry/bus";
import { InMemoryExperimentStore } from "@/domain/experiment/store";
import { ExperimentRunner } from "@/domain/experiment/runner";
import type { EvidenceStore } from "@/domain/evidence/store";
import { registerEvidenceTools } from "@/infrastructure/webmcp/evidence-tools";
import { InMemoryHypothesisStore, type HypothesisStore } from "@/domain/hypothesis/store";
import { registerHypothesisTools } from "@/infrastructure/webmcp/hypothesis-tools";
import { App } from "@/presentation/App";
declare global {
  interface Window {
    __virtualDevice?: VirtualDeviceAdapter;
    __toolRegistrar?: DeviceToolRegistrar;
    __telemetryBus?: TelemetryEventBus;
    __experimentStore?: InMemoryExperimentStore;
    __evidenceStore?: EvidenceStore;
    __hypothesisStore?: HypothesisStore;
    __experimentRunner?: ExperimentRunner;
    __modelContext?: InMemoryModelContext;
    __scopeFrameCount?: number;
    __webmcpMode?: "native" | "compatibility";
    __buildInfo?: {
      commitSha: string;
      builtAt?: string;
    };
    __OHMNI_BUILD_SHA__?: string;
  }
}

console.info("[Ohmni] Hardware Diagnostic Workbench initialized.");

// 1. Detect native WebMCP capability before fallback
const isNativeWebMCP =
  typeof document !== "undefined" &&
  Boolean((document as unknown as { modelContext?: unknown }).modelContext);

const modelContext = isNativeWebMCP
  ? (document as unknown as { modelContext: ModelContext }).modelContext
  : new InMemoryModelContext();

if (typeof document !== "undefined" && !isNativeWebMCP) {
  Object.defineProperty(document, "modelContext", {
    value: modelContext,
    writable: false,
    configurable: true,
  });
}

if (typeof window !== "undefined") {
  window.__webmcpMode = isNativeWebMCP ? "native" : "compatibility";
  const sha = (import.meta.env.VITE_BUILD_SHA as string) || "development";
  window.__OHMNI_BUILD_SHA__ = sha;
  window.__buildInfo = {
    commitSha: sha,
  };
}
// 2. Initialize Telemetry & Experiment Pipeline
const telemetryBus = new TelemetryEventBus();
const experimentStore = new InMemoryExperimentStore();
const experimentRunner = new ExperimentRunner({
  eventBus: telemetryBus,
  store: experimentStore,
});
const evidenceStore = experimentRunner.getEvidenceStore();
const hypothesisStore = new InMemoryHypothesisStore(evidenceStore);

// Register investigation tools (evidence & hypothesis synthesis)
registerEvidenceTools(modelContext, evidenceStore).catch((err) => {
  console.error("[Ohmni] Failed to register WebMCP evidence tools:", err);
});
registerHypothesisTools(modelContext, hypothesisStore).catch((err) => {
  console.error("[Ohmni] Failed to register WebMCP hypothesis tools:", err);
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
  window.__evidenceStore = evidenceStore;
  window.__hypothesisStore = hypothesisStore;
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
          evidenceStore={evidenceStore}
          hypothesisStore={hypothesisStore}
        />
      </React.StrictMode>
    );
  }
}
