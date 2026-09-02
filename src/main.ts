/**
 * Ohmni Hardware Diagnostic Workbench entry point.
 */

import { VirtualDeviceAdapter } from "@/domain/device/virtual-adapter";
import { InMemoryModelContext } from "@/infrastructure/webmcp/in-memory-model-context";
import { DeviceToolRegistrar } from "@/infrastructure/webmcp/device-tool-registrar";
import { CapabilityRegistry } from "@/infrastructure/webmcp/capability-registry";

declare global {
  interface Window {
    __virtualDevice?: VirtualDeviceAdapter;
    __toolRegistrar?: DeviceToolRegistrar;
    __modelContext?: InMemoryModelContext;
  }
}

console.info("[Ohmni] Hardware Diagnostic Workbench initialized.");

// 1. Initialize or polyfill document.modelContext if not natively present
const modelContext = (typeof document !== "undefined" && document.modelContext)
  ? document.modelContext
  : new InMemoryModelContext();

if (typeof document !== "undefined" && !document.modelContext) {
  Object.defineProperty(document, "modelContext", {
    value: modelContext,
    writable: false,
    configurable: true,
  });
}

// 2. Initialize Virtual Device & Tool Registrar
const virtualDevice = new VirtualDeviceAdapter();
const capabilityRegistry = new CapabilityRegistry();
const toolRegistrar = new DeviceToolRegistrar(modelContext, capabilityRegistry);

if (typeof window !== "undefined") {
  window.__virtualDevice = virtualDevice;
  window.__toolRegistrar = toolRegistrar;
  if (modelContext instanceof InMemoryModelContext) {
    window.__modelContext = modelContext;
  }
}
