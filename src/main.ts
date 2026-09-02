/**
 * Ohmni Hardware Diagnostic Workbench entry point.
 */

import { VirtualDeviceAdapter } from "@/domain/device/virtual-adapter";
import { InMemoryModelContext } from "@/infrastructure/webmcp/in-memory-model-context";
import { DeviceToolRegistrar } from "@/infrastructure/webmcp/device-tool-registrar";
import { CapabilityRegistry } from "@/infrastructure/webmcp/capability-registry";
import { TelemetryEventBus } from "@/domain/telemetry/bus";
import { InMemoryExperimentStore } from "@/domain/experiment/store";
import { ExperimentRunner } from "@/domain/experiment/runner";

declare global {
  interface Window {
    __virtualDevice?: VirtualDeviceAdapter;
    __toolRegistrar?: DeviceToolRegistrar;
    __modelContext?: InMemoryModelContext;
    __telemetryBus?: TelemetryEventBus;
    __experimentStore?: InMemoryExperimentStore;
    __experimentRunner?: ExperimentRunner;
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

// 4. Render lightweight developer debug surface if DOM exists
if (typeof document !== "undefined") {
  const appElement = document.getElementById("app");
  if (appElement) {
    const debugContainer = document.createElement("div");
    debugContainer.id = "telemetry-debug-panel";
    debugContainer.style.cssText =
      "margin: 0 2rem; padding: 1rem; background: #13171f; border: 1px solid #1e293b; border-radius: 6px; font-size: 0.8125rem;";
    debugContainer.innerHTML = `
      <div style="color: #64748b; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.5rem;">
        Real-Time Telemetry & Experiment Pipeline
      </div>
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 0.75rem;">
        <div><span style="color: #94a3b8;">Active Experiment:</span> <span id="debug-exp-id" style="color: #38bdf8;">none</span></div>
        <div><span style="color: #94a3b8;">Status:</span> <span id="debug-exp-status" style="color: #a3e635;">idle</span></div>
        <div><span style="color: #94a3b8;">Latest Voltage:</span> <span id="debug-voltage" style="color: #facc15;">-- V</span></div>
        <div><span style="color: #94a3b8;">Sample Count:</span> <span id="debug-sample-count" style="color: #e2e8f0;">0</span></div>
        <div><span style="color: #94a3b8;">Last Event:</span> <span id="debug-last-event" style="color: #c084fc;">none</span></div>
      </div>
    `;
    appElement.appendChild(debugContainer);

    let sampleCount = 0;
    telemetryBus.subscribe((event, expId) => {
      const expIdEl = document.getElementById("debug-exp-id");
      const statusEl = document.getElementById("debug-exp-status");
      const voltageEl = document.getElementById("debug-voltage");
      const sampleCountEl = document.getElementById("debug-sample-count");
      const lastEventEl = document.getElementById("debug-last-event");

      if (expId && expIdEl) expIdEl.textContent = expId;
      if (statusEl) statusEl.textContent = "streaming";

      if (event.type === "voltage_sample") {
        sampleCount++;
        if (voltageEl) voltageEl.textContent = `${event.voltage.toFixed(2)} V`;
        if (sampleCountEl) sampleCountEl.textContent = String(sampleCount);
      }

      if (lastEventEl) {
        if (event.type === "reset") {
          lastEventEl.textContent = `RESET (${event.reason})`;
        } else if (event.type === "relay_state") {
          lastEventEl.textContent = `RELAY ${event.state.toUpperCase()}`;
        } else {
          lastEventEl.textContent = event.type;
        }
      }
    });
  }
}
