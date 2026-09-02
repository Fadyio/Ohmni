/**
 * Ohmni Hardware Diagnostic Workbench entry point.
 */

import { VirtualDeviceAdapter } from "@/domain/device/virtual-adapter";

declare global {
  interface Window {
    __virtualDevice?: VirtualDeviceAdapter;
  }
}

console.info("[Ohmni] Hardware Diagnostic Workbench initialized.");

const virtualDevice = new VirtualDeviceAdapter();
if (typeof window !== "undefined") {
  window.__virtualDevice = virtualDevice;
}
