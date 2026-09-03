import { describe, expect, it } from "bun:test";
import { VirtualDeviceAdapter } from "@/domain/device/virtual-adapter";
import { InMemoryExperimentStore } from "@/domain/experiment/store";
import { InMemoryEvidenceStore } from "@/domain/evidence/store";
import { InMemoryHypothesisStore } from "@/domain/hypothesis/store";
import { TelemetryRingBuffer } from "@/domain/telemetry/ring-buffer";
import { createScenarioSession } from "@/domain/scenario";
import { resetInvestigationSession } from "@/domain/investigation/session-reset";
import { DeterministicBenchAgentProvider } from "@/infrastructure/bench-agent/deterministic-provider";

describe("Phase 9 — Session Isolation (20 Sequential Investigations)", () => {
  it("guarantees absolute state isolation across 20 consecutive mystery investigations", async () => {
    const virtualAdapter = new VirtualDeviceAdapter();
    await virtualAdapter.connect();

    const experimentStore = new InMemoryExperimentStore();
    const evidenceStore = new InMemoryEvidenceStore();
    const hypothesisStore = new InMemoryHypothesisStore(evidenceStore);
    const ringBuffer = new TelemetryRingBuffer(1000);
    const agentProvider = new DeterministicBenchAgentProvider();

    for (let run = 1; run <= 20; run++) {
      // 1. Initialize new mystery challenge
      const scenarioSession = createScenarioSession({ scenarioId: "brownout" });

      // Apply initial device config from scenario
      const initConfig = scenarioSession.getInitialDeviceConfig();
      virtualAdapter.reset(initConfig);

      // Verify clean initial state at start of run
      expect(experimentStore.getExperiments().length).toBe(0);
      expect(evidenceStore.getAll().length).toBe(0);
      expect(hypothesisStore.getAll().length).toBe(0);
      expect(virtualAdapter.getInterventionPoint("relay_power_jumper")).toBe("3v3");

      const baselineResets = await virtualAdapter.executeCapability<{ count: number; resets: unknown[] }>("read_reset_history");
      expect(baselineResets.data.count).toBe(4); // 1 POWER_ON + 3 BROWNOUT

      // 2. Simulate complete investigation mutating all stores and hardware
      // Add fake experiment
      experimentStore.save({
        metadata: {
          id: `exp_run_${run}`,
          capability: "run_relay_stress_test",
          startedAt: Date.now(),
          status: "completed",
          parameters: { cycles: 3 },
        },
        events: [],
        traces: {},
        summary: {
          experiment_id: `exp_run_${run}`,
          status: "completed",
          test: "run_relay_stress_test",
          unexpected_resets: 0,
        },
      });

      // Add fake evidence
      evidenceStore.addHumanObservation({
        summary: `Human observation run ${run}`,
        interventionPointId: "relay_power_jumper",
        data: { position: "5v" },
      });

      // Add fake hypothesis
      hypothesisStore.create({
        title: `Hypothesis for run ${run}`,
        description: "Shared rail brownout",
        confidence: "MEDIUM",
        createdBy: "agent",
      });

      // Mutate hardware jumper to 5V
      virtualAdapter.setInterventionPoint("relay_power_jumper", "5v");
      expect(virtualAdapter.getInterventionPoint("relay_power_jumper")).toBe("5v");

      // Populate telemetry
      ringBuffer.push({
        tMs: Date.now(),
        value: 3.18,
      });
      expect(ringBuffer.size).toBeGreaterThan(0);

      // 3. Perform clean resetInvestigationSession
      resetInvestigationSession({
        scenarioSession,
        virtualAdapter,
        experimentStore,
        evidenceStore,
        hypothesisStore,
        ringBuffer,
        benchAgentReset: () => agentProvider.reset(),
      });

      // 4. Assert absolute isolation — no contamination for the next run
      expect(experimentStore.getExperiments().length).toBe(0);
      expect(evidenceStore.getAll().length).toBe(0);
      expect(hypothesisStore.getAll().length).toBe(0);
      expect(ringBuffer.size).toBe(0);
      expect(virtualAdapter.getInterventionPoint("relay_power_jumper")).toBe("3v3");

      const postResetResets = await virtualAdapter.executeCapability<{ count: number }>("read_reset_history");
      expect(postResetResets.data.count).toBe(4);
    }
  });
});
