/**
 * Slice 3D: ExperimentRunner Unit Tests.
 */

import { describe, it, expect, beforeEach } from "bun:test";
import { VirtualDeviceAdapter } from "@/domain/device/virtual-adapter";
import { ExperimentRunner } from "@/domain/experiment/runner";
import { InMemoryExperimentStore } from "@/domain/experiment/store";
import { TelemetryEventBus } from "@/domain/telemetry/bus";
import type { DeviceEvent, VoltageSampleEvent, ResetEvent } from "@/domain/device/events";

describe("Slice 3D: ExperimentRunner", () => {
  let adapter: VirtualDeviceAdapter;
  let eventBus: TelemetryEventBus;
  let store: InMemoryExperimentStore;
  let runner: ExperimentRunner;

  beforeEach(() => {
    adapter = new VirtualDeviceAdapter();
    eventBus = new TelemetryEventBus();
    store = new InMemoryExperimentStore();
    runner = new ExperimentRunner({ eventBus, store });
  });

  it("orchestrates experiment: assigns experiment_id, streams to bus, saves record, and returns concise summary", async () => {
    await adapter.connect();

    // Track live bus events
    const busEvents: Array<{ event: DeviceEvent; expId?: string }> = [];
    const unsubscribeBus = eventBus.subscribe((event, expId) => {
      busEvents.push({ event, expId });
    });

    const summary = await runner.runExperiment(adapter, "run_relay_stress_test", {
      cycles: 3,
      durationMs: 20,
    });

    unsubscribeBus();

    // 1. Returns concise semantic summary
    expect(summary.experiment_id.startsWith("exp_")).toBe(true);
    expect(summary.status).toBe("completed");
    expect(summary.test).toBe("run_relay_stress_test");
    expect(summary.repetitions).toBe(3);
    expect(summary.failures).toBeGreaterThan(0);
    expect(summary.unexpected_resets).toBeGreaterThan(0);
    expect(summary.reset_reasons).toEqual({ BROWNOUT: 1 });
    expect(summary.supply_voltage).toBeDefined();
    expect(summary.supply_voltage?.baseline_v).toBeCloseTo(3.31, 2);
    expect(summary.supply_voltage?.minimum_v).toBeCloseTo(2.72, 2);
    expect(summary.supply_voltage?.drop_v).toBeCloseTo(0.59, 2);

    // 2. Telemetry events on bus all correlate to this experiment_id
    expect(busEvents.length).toBeGreaterThan(0);
    for (const item of busEvents) {
      expect(item.expId).toBe(summary.experiment_id);
    }

    const voltageBusEvents = busEvents.filter(
      (b): b is { event: VoltageSampleEvent; expId: string } =>
        b.event.type === "voltage_sample"
    );
    expect(voltageBusEvents.length).toBeGreaterThan(0);

    // 3. ExperimentRecord is saved locally in ExperimentStore
    const record = store.getExperiment(summary.experiment_id);
    expect(record).toBeDefined();
    expect(record?.metadata.id).toBe(summary.experiment_id);
    expect(record?.metadata.status).toBe("completed");
    expect(record?.metadata.capability).toBe("run_relay_stress_test");
    expect(record?.metadata.completedAt).toBeDefined();

    // 4. Record contains high-density raw trace that is not in the summary
    expect(record?.traces.supply_voltage).toBeDefined();
    expect(record?.traces.supply_voltage.samples.length).toBeGreaterThan(0);
    expect(record?.events.length).toBeGreaterThan(0);

    // Summary itself does NOT contain the raw traces array
    expect((summary as any).traces).toBeUndefined();
    expect((summary as any).events).toBeUndefined();
  });

  it("produces passing summary after physical jumper repair to 5V", async () => {
    await adapter.connect();
    adapter.setInterventionPoint("relay_power_jumper", "5v");

    const summary = await runner.runExperiment(adapter, "run_relay_stress_test", {
      cycles: 3,
      durationMs: 10,
    });

    expect(summary.status).toBe("completed");
    expect(summary.success).toBe(true);
    expect(summary.faultReproduced).toBe(false);
    expect(summary.resetOccurred).toBe(false);
    expect(summary.failures).toBe(0);
    expect(summary.unexpected_resets).toBe(0);
    expect(summary.supply_voltage?.minimum_v).toBeGreaterThanOrEqual(3.10);
    expect(summary.supply_voltage?.drop_v).toBeLessThan(0.30);
  });

  it("handles mid-flight AbortSignal: marks status aborted, preserves partial record, and leaves relay open", async () => {
    await adapter.connect();
    adapter.setInterventionPoint("relay_power_jumper", "5v"); // allow longer run to abort

    const controller = new AbortController();
    setTimeout(() => controller.abort(), 25);

    const busEvents: DeviceEvent[] = [];
    eventBus.subscribe((e) => busEvents.push(e));

    const promise = runner.runExperiment(
      adapter,
      "run_relay_stress_test",
      { cycles: 10, durationMs: 100 },
      controller.signal
    );

    await expect(promise).rejects.toThrow(/aborted/i);

    // Relay is safe
    expect(adapter.getRelayState()).toBe("open");

    // Partial record is saved with status 'aborted'
    const latest = store.latest();
    expect(latest).toBeDefined();
    expect(latest?.metadata.status).toBe("aborted");
    expect(latest?.summary?.status).toBe("aborted");

    // No lingering subscriptions on adapter
    // Another experiment can run cleanly
    const nextSummary = await runner.runExperiment(adapter, "run_relay_stress_test", {
      cycles: 1,
      durationMs: 5,
    });
    expect(nextSummary.status).toBe("completed");
  });

  it("handles pre-aborted signal cleanly", async () => {
    await adapter.connect();

    const controller = new AbortController();
    controller.abort();

    const promise = runner.runExperiment(
      adapter,
      "run_relay_stress_test",
      { cycles: 3 },
      controller.signal
    );

    await expect(promise).rejects.toThrow(/aborted/i);
    expect(store.latest()?.metadata.status).toBe("aborted");
  });

  it("sequential experiments generate distinct IDs and zero cross-contamination", async () => {
    await adapter.connect();

    const exp1Events: string[] = [];
    const exp2Events: string[] = [];

    const unsubscribe = eventBus.subscribe((event, expId) => {
      if (expId?.includes("exp_")) {
        // Track
      }
    });

    const sum1 = await runner.runExperiment(adapter, "run_relay_stress_test", { cycles: 1, durationMs: 5 });
    const sum2 = await runner.runExperiment(adapter, "run_relay_stress_test", { cycles: 1, durationMs: 5 });

    unsubscribe();

    expect(sum1.experiment_id).not.toBe(sum2.experiment_id);
    expect(store.count()).toBe(2);

    const rec1 = store.getExperiment(sum1.experiment_id);
    const rec2 = store.getExperiment(sum2.experiment_id);

    expect(rec1?.metadata.id).toBe(sum1.experiment_id);
    expect(rec2?.metadata.id).toBe(sum2.experiment_id);
    expect(rec1?.events.every((e) => e.experimentId === sum1.experiment_id)).toBe(true);
    expect(rec2?.events.every((e) => e.experimentId === sum2.experiment_id)).toBe(true);
  });
});
