/**
 * Investigation Session Reset Controller.
 * Phase 9 — Clean-slate state isolation across sequential mystery investigations.
 *
 * Requirements:
 * Ensures absolute isolation between consecutive mystery challenges:
 * - Active scenario session
 * - VirtualDeviceAdapter scenario state, relay, reset history, and sensors
 * - Experiment store
 * - Evidence store
 * - Hypothesis store
 * - Telemetry ring buffer
 * - Agent status, activity, and interaction IDs
 * - Pending approvals & abort controllers
 */

import type { VirtualDeviceAdapter } from "@/domain/device/virtual-adapter";
import type { ExperimentStore } from "@/domain/experiment/store";
import type { EvidenceStore } from "@/domain/evidence/store";
import type { HypothesisStore } from "@/domain/hypothesis/store";
import type { TelemetryRingBuffer } from "@/domain/telemetry/ring-buffer";
import type { ScenarioSession } from "@/domain/scenario/types";
import type { DeviceToolRegistrar } from "@/infrastructure/webmcp/device-tool-registrar";

export interface ResetInvestigationSessionOptions {
  scenarioSession?: ScenarioSession | null;
  virtualAdapter?: VirtualDeviceAdapter | null;
  experimentStore?: ExperimentStore | null;
  evidenceStore?: EvidenceStore | null;
  hypothesisStore?: HypothesisStore | null;
  ringBuffer?: TelemetryRingBuffer | null;
  benchAgentReset?: (() => void) | null;
  toolRegistrar?: DeviceToolRegistrar | null;
}

export function resetInvestigationSession(options: ResetInvestigationSessionOptions = {}): void {
  const {
    scenarioSession,
    virtualAdapter,
    experimentStore,
    evidenceStore,
    hypothesisStore,
    ringBuffer,
    benchAgentReset,
    toolRegistrar,
  } = options;

  // 1. Reset virtual device adapter state and reset history to scenario baseline
  if (virtualAdapter) {
    const initConfig = scenarioSession?.getInitialDeviceConfig();
    virtualAdapter.reset(initConfig);
  }

  // 2. Clear experiment records from store
  if (experimentStore && typeof experimentStore.clear === "function") {
    experimentStore.clear();
  }

  // 3. Clear evidence records from store
  if (evidenceStore && typeof evidenceStore.clear === "function") {
    evidenceStore.clear();
  }

  // 4. Clear hypotheses from store
  if (hypothesisStore && typeof hypothesisStore.clear === "function") {
    hypothesisStore.clear();
  }

  // 5. Clear telemetry ring buffer
  if (ringBuffer && typeof ringBuffer.clear === "function") {
    ringBuffer.clear();
  }

  // 6. Reset bench agent internal state, previousInteractionId, and abort controllers
  if (typeof benchAgentReset === "function") {
    benchAgentReset();
  }

  // 7. Refresh or re-register device tools if toolRegistrar and virtualAdapter are active
  if (toolRegistrar && virtualAdapter && virtualAdapter.isConnected()) {
    toolRegistrar.unregisterDevice(virtualAdapter);
    void toolRegistrar.registerDevice(virtualAdapter);
  }
}
