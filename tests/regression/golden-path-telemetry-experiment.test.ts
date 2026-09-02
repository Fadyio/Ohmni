/**
 * PERMANENT REGRESSION TEST SUITE — MILESTONE 3
 * WebMCP Experiment Runner & Real-Time Telemetry Pipeline.
 *
 * Requirements:
 * 1. Golden path: WebMCP relay experiment streams live telemetry while returning a concise correlated summary.
 * 2. Abort regression: aborting WebMCP experiment preserves partial trace and leaves device safe.
 * 3. Multiple experiment test: sequential experiments have distinct IDs and zero cross-contamination.
 * 4. Performance test: high-frequency sample load (10,000 samples) maintains bounded memory and deterministic ordering.
 */

import { describe, it, expect, beforeEach } from "bun:test";
import { VirtualDeviceAdapter } from "@/domain/device/virtual-adapter";
import { InMemoryModelContext } from "@/infrastructure/webmcp/in-memory-model-context";
import { CapabilityRegistry } from "@/infrastructure/webmcp/capability-registry";
import { DeviceToolRegistrar } from "@/infrastructure/webmcp/device-tool-registrar";
import { TelemetryEventBus } from "@/domain/telemetry/bus";
import { TelemetryRingBuffer } from "@/domain/telemetry/ring-buffer";
import { InMemoryExperimentStore } from "@/domain/experiment/store";
import { ExperimentRunner } from "@/domain/experiment/runner";
import type { RegisteredTool } from "@/infrastructure/webmcp/types";
import type { DeviceEvent, VoltageSampleEvent, ResetEvent, RelayStateEvent } from "@/domain/device/events";
import type { ExperimentSummary } from "@/domain/experiment/types";

describe("Milestone 3 Permanent Regression — Experiment Runner & Telemetry Pipeline", () => {
  let modelContext: InMemoryModelContext;
  let eventBus: TelemetryEventBus;
  let store: InMemoryExperimentStore;
  let runner: ExperimentRunner;
  let registry: CapabilityRegistry;
  let registrar: DeviceToolRegistrar;
  let adapter: VirtualDeviceAdapter;

  beforeEach(() => {
    modelContext = new InMemoryModelContext();
    eventBus = new TelemetryEventBus();
    store = new InMemoryExperimentStore();
    runner = new ExperimentRunner({ eventBus, store });
    registry = new CapabilityRegistry(runner);
    registrar = new DeviceToolRegistrar(modelContext, registry);
    adapter = new VirtualDeviceAdapter();
  });

  it("golden path: WebMCP relay experiment streams live telemetry while returning a concise correlated summary", async () => {
    // 1. Connect VirtualDeviceAdapter & register WebMCP tools
    await adapter.connect();
    await registrar.registerDevice(adapter);

    // 2. Subscribe to TelemetryEventBus to capture live telemetry
    const liveTelemetry: Array<{ event: DeviceEvent; expId?: string }> = [];
    const unsubscribeBus = eventBus.subscribe((event, expId) => {
      liveTelemetry.push({ event, expId });
    });

    // 3. Find run_relay_stress_test tool
    const tools = await modelContext.getTools();
    const relayTool = tools.find((t) => t.name === "run_relay_stress_test");
    expect(relayTool).toBeDefined();

    // 4. Execute via ModelContext.executeTool()
    const rawResult = await modelContext.executeTool(
      relayTool as RegisteredTool,
      JSON.stringify({ cycles: 3, duration_ms: 20 })
    );

    unsubscribeBus();

    const summary: ExperimentSummary = JSON.parse(rawResult);

    // 5. Verify summary properties
    expect(summary.experiment_id).toBeDefined();
    expect(summary.experiment_id.startsWith("exp_")).toBe(true);
    expect(summary.status).toBe("completed");
    expect(summary.test).toBe("run_relay_stress_test");
    expect(summary.repetitions).toBe(3);
    expect(summary.failures).toBeGreaterThan(0);
    expect(summary.unexpected_resets).toBeGreaterThan(0);
    expect(summary.reset_reasons?.BROWNOUT).toBeGreaterThanOrEqual(1);

    // Voltage metrics
    expect(summary.supply_voltage).toBeDefined();
    expect(summary.supply_voltage?.baseline_v).toBeCloseTo(3.31, 2);
    expect(summary.supply_voltage?.minimum_v).toBeLessThan(2.80);
    expect(summary.supply_voltage?.drop_v).toBeGreaterThan(0.50);

    // Backward-compatibility properties
    expect(summary.faultReproduced).toBe(true);
    expect(summary.resetOccurred).toBe(true);
    expect(summary.resetReason).toBe("BROWNOUT");

    // 6. Invariant: Full raw sample array is NOT returned in normal WebMCP result
    expect((summary as any).traces).toBeUndefined();
    expect((summary as any).events).toBeUndefined();

    // 7. Verify live telemetry events captured by event bus
    expect(liveTelemetry.length).toBeGreaterThan(0);
    // Every live event correlated to the exact same experiment_id
    for (const item of liveTelemetry) {
      expect(item.expId).toBe(summary.experiment_id);
    }

    const voltageEvents = liveTelemetry.filter(
      (item): item is { event: VoltageSampleEvent; expId: string } =>
        item.event.type === "voltage_sample"
    );
    const resetEvents = liveTelemetry.filter(
      (item): item is { event: ResetEvent; expId: string } =>
        item.event.type === "reset"
    );
    const relayEvents = liveTelemetry.filter(
      (item): item is { event: RelayStateEvent; expId: string } =>
        item.event.type === "relay_state"
    );

    expect(voltageEvents.length).toBeGreaterThan(0);
    expect(resetEvents.some((r) => r.event.reason === "BROWNOUT")).toBe(true);
    expect(relayEvents.length).toBeGreaterThan(0);

    // 8. Invariant: ExperimentRecord exists in local ExperimentStore
    const record = store.getExperiment(summary.experiment_id);
    expect(record).toBeDefined();
    expect(record?.metadata.id).toBe(summary.experiment_id);
    expect(record?.metadata.status).toBe("completed");

    // 9. Invariant: Record traces contain more detail than WebMCP summary
    expect(record?.traces.supply_voltage).toBeDefined();
    expect(record?.traces.supply_voltage.samples.length).toBeGreaterThan(0);
    expect(record?.events.length).toBeGreaterThan(0);

    // 10. Disconnect and verify zero listener leaks
    await adapter.disconnect();
    registrar.unregisterDevice(adapter);

    const remainingTools = await modelContext.getTools();
    expect(remainingTools.length).toBe(0);
  });

  it("abort regression: aborting WebMCP experiment preserves partial trace and leaves device safe", async () => {
    adapter.setInterventionPoint("relay_power_jumper", "5v"); // 5V rail prevents instant reset, allowing multi-cycle timing
    await adapter.connect();
    await registrar.registerDevice(adapter);

    const tools = await modelContext.getTools();
    const relayTool = tools.find((t) => t.name === "run_relay_stress_test");
    expect(relayTool).toBeDefined();

    const executionController = new AbortController();

    const liveTelemetry: DeviceEvent[] = [];
    eventBus.subscribe((e) => liveTelemetry.push(e));

    const promise = modelContext.executeTool(
      relayTool as RegisteredTool,
      JSON.stringify({ cycles: 10, duration_ms: 100 }),
      { signal: executionController.signal }
    );

    // Trigger abort mid-flight
    setTimeout(() => executionController.abort(), 30);

    await expect(promise).rejects.toThrow(/aborted/i);

    // Invariant 1: Status = 'aborted'
    const latestRecord = store.latest();
    expect(latestRecord).toBeDefined();
    expect(latestRecord?.metadata.status).toBe("aborted");
    expect(latestRecord?.summary?.status).toBe("aborted");

    // Invariant 2: Partial ExperimentRecord is retained with collected traces
    expect(latestRecord?.traces.supply_voltage).toBeDefined();

    // Invariant 3: Hardware left in safe/open state
    expect(adapter.getRelayState()).toBe("open");

    // Invariant 4: No continued telemetry dispatched after abort
    const countAfterAbort = liveTelemetry.length;
    await new Promise((r) => setTimeout(r, 50));
    expect(liveTelemetry.length).toBe(countAfterAbort);

    // Invariant 5: Subscriptions cleanly removed; adapter can run subsequent experiment
    const secondResult = await modelContext.executeTool(
      relayTool as RegisteredTool,
      JSON.stringify({ cycles: 1, duration_ms: 10 })
    );
    const secondSummary: ExperimentSummary = JSON.parse(secondResult);
    expect(secondSummary.status).toBe("completed");
  });

  it("multiple experiment test: sequential experiments have distinct IDs and zero cross-contamination", async () => {
    await adapter.connect();
    await registrar.registerDevice(adapter);

    const tools = await modelContext.getTools();
    const relayTool = tools.find((t) => t.name === "run_relay_stress_test")!;

    // Run Experiment A (3.3V fault)
    adapter.setInterventionPoint("relay_power_jumper", "3v3");
    const rawA = await modelContext.executeTool(
      relayTool,
      JSON.stringify({ cycles: 1, duration_ms: 10 })
    );
    const summaryA: ExperimentSummary = JSON.parse(rawA);

    // Run Experiment B (5V repaired)
    adapter.setInterventionPoint("relay_power_jumper", "5v");
    const rawB = await modelContext.executeTool(
      relayTool,
      JSON.stringify({ cycles: 1, duration_ms: 10 })
    );
    const summaryB: ExperimentSummary = JSON.parse(rawB);

    // Assertions:
    expect(summaryA.experiment_id).not.toBe(summaryB.experiment_id);
    expect(summaryA.faultReproduced).toBe(true);
    expect(summaryB.faultReproduced).toBe(false);

    expect(store.count()).toBe(2);
    const recA = store.getExperiment(summaryA.experiment_id);
    const recB = store.getExperiment(summaryB.experiment_id);

    expect(recA?.metadata.id).toBe(summaryA.experiment_id);
    expect(recB?.metadata.id).toBe(summaryB.experiment_id);

    // Zero cross contamination of events
    expect(recA?.events.every((e) => e.experimentId === summaryA.experiment_id)).toBe(true);
    expect(recB?.events.every((e) => e.experimentId === summaryB.experiment_id)).toBe(true);
  });

  it("performance test: ring buffer remains bounded and ordered under 10,000 samples", () => {
    const ringBuffer = new TelemetryRingBuffer({
      capacity: 500,
      channel: "supply_voltage",
      unit: "V",
    });

    const unsubscribe = eventBus.subscribe((event) => {
      if (event.type === "voltage_sample") {
        ringBuffer.push(event.timestamp, event.voltage);
      }
    });

    // Publish 10,000 high-frequency samples
    const startMemory = process.memoryUsage ? process.memoryUsage().heapUsed : 0;
    for (let i = 0; i < 10000; i++) {
      eventBus.publish(
        {
          type: "voltage_sample",
          timestamp: i,
          voltage: 3.30 + Math.sin(i / 100) * 0.1,
          unit: "V",
        },
        "exp_stress_test"
      );
    }

    unsubscribe();

    // Capacity is strictly enforced at 500
    expect(ringBuffer.size).toBe(500);
    expect(ringBuffer.isFull()).toBe(true);

    const samples = ringBuffer.toArray();
    expect(samples.length).toBe(500);

    // Oldest sample in buffer is sample 9,500
    expect(samples[0].tMs).toBe(9500);
    // Newest sample in buffer is sample 9,999
    expect(samples[samples.length - 1].tMs).toBe(9999);
    expect(ringBuffer.getLatest()?.tMs).toBe(9999);

    // Deterministic chronological ordering verified
    for (let j = 1; j < samples.length; j++) {
      expect(samples[j].tMs).toBe(samples[j - 1].tMs + 1);
    }
  });
});
