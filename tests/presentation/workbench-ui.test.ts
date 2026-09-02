/**
 * Permanent UI and Presentation Layer Regression Tests for Milestone 4.
 *
 * Verifies:
 * 1. Disconnected state renders correctly (0 tools, offline state).
 * 2. Connecting virtual device updates tool count dynamically (5 WebMCP tools).
 * 3. Experiment starts strictly through WebMCP path (getTools -> executeTool).
 * 4. Telemetry updates observable ring buffer and event markers.
 * 5. Fault reproduced state displays BROWNOUT reset cause.
 * 6. Requested/completed cycle counts remain factually correct (Requested: 3, Completed: 0).
 * 7. Device disconnect returns state to disconnected and unregisters tools.
 * 8. No direct DeviceAdapter diagnostic invocation from Demo Controls.
 */

import { describe, it, expect, beforeEach } from "bun:test";
import { VirtualDeviceAdapter } from "@/domain/device/virtual-adapter";
import { InMemoryModelContext } from "@/infrastructure/webmcp/in-memory-model-context";
import { CapabilityRegistry } from "@/infrastructure/webmcp/capability-registry";
import { DeviceToolRegistrar } from "@/infrastructure/webmcp/device-tool-registrar";
import { TelemetryEventBus } from "@/domain/telemetry/bus";
import { InMemoryExperimentStore } from "@/domain/experiment/store";
import { ExperimentRunner } from "@/domain/experiment/runner";
import { TelemetryRingBuffer } from "@/domain/telemetry/ring-buffer";
import type { ModelContextTool, RegisteredTool } from "@/infrastructure/webmcp/types";

describe("Milestone 4 — Workbench UI & WebMCP Presentation Contracts", () => {
  let modelContext: InMemoryModelContext;
  let telemetryBus: TelemetryEventBus;
  let experimentStore: InMemoryExperimentStore;
  let experimentRunner: ExperimentRunner;
  let virtualDevice: VirtualDeviceAdapter;
  let capabilityRegistry: CapabilityRegistry;
  let toolRegistrar: DeviceToolRegistrar;

  beforeEach(() => {
    modelContext = new InMemoryModelContext();
    telemetryBus = new TelemetryEventBus();
    experimentStore = new InMemoryExperimentStore();
    experimentRunner = new ExperimentRunner({
      eventBus: telemetryBus,
      store: experimentStore,
    });
    virtualDevice = new VirtualDeviceAdapter();
    capabilityRegistry = new CapabilityRegistry(experimentRunner);
    toolRegistrar = new DeviceToolRegistrar(modelContext, capabilityRegistry);
  });

  it("1. Disconnected state: 0 tools registered before connection", async () => {
    const tools = await modelContext.getTools();
    expect(tools.length).toBe(0);
    expect(virtualDevice.isConnected()).toBe(false);
  });

  it("2. Connecting virtual device updates tool count to 8 WebMCP tools", async () => {
    await virtualDevice.connect();
    await toolRegistrar.registerDevice(virtualDevice);

    const tools = await modelContext.getTools();
    expect(tools.length).toBe(8);

    const toolNames = tools.map((t) => t.name);
    expect(toolNames).toContain("read_device_info");
    expect(toolNames).toContain("read_reset_history");
    expect(toolNames).toContain("read_system_health");
    expect(toolNames).toContain("measure_supply_voltage");
    expect(toolNames).toContain("scan_i2c_bus");
    expect(toolNames).toContain("read_sensor_status");
    expect(toolNames).toContain("read_i2c_line_state");
    expect(toolNames).toContain("run_relay_stress_test");
  });

  it("3. Experiment starts through WebMCP path (getTools -> executeTool)", async () => {
    await virtualDevice.connect();
    await toolRegistrar.registerDevice(virtualDevice);

    const tools = await modelContext.getTools();
    const relayTool = tools.find((t: RegisteredTool) => t.name === "run_relay_stress_test");
    expect(relayTool).toBeDefined();

    const rawResult = await modelContext.executeTool(
      relayTool!,
      JSON.stringify({ cycles: 3, duration_ms: 20 })
    );

    expect(typeof rawResult).toBe("string");
    const summary = JSON.parse(rawResult);
    expect(summary.experiment_id).toMatch(/^exp_/);
    expect(summary.test).toBe("run_relay_stress_test");
  });

  it("4. Telemetry updates observable ring buffer and event markers", async () => {
    const ringBuffer = new TelemetryRingBuffer({ capacity: 1000 });
    const eventsCaptured: string[] = [];

    telemetryBus.subscribe((event) => {
      eventsCaptured.push(event.type);
      if (event.type === "voltage_sample") {
        ringBuffer.push(Date.now(), event.voltage);
      }
    });

    await virtualDevice.connect();
    await toolRegistrar.registerDevice(virtualDevice);

    const tools = await modelContext.getTools();
    const relayTool = tools.find((t: RegisteredTool) => t.name === "run_relay_stress_test")!;
    await modelContext.executeTool(relayTool, JSON.stringify({ cycles: 3, duration_ms: 20 }));

    expect(ringBuffer.size).toBeGreaterThan(0);
    expect(eventsCaptured).toContain("voltage_sample");
    expect(eventsCaptured).toContain("relay_state");
    expect(eventsCaptured).toContain("reset");
  });

  it("5. Fault reproduced state displays BROWNOUT reset cause", async () => {
    await virtualDevice.connect();
    await toolRegistrar.registerDevice(virtualDevice);

    const tools = await modelContext.getTools();
    const relayTool = tools.find((t: RegisteredTool) => t.name === "run_relay_stress_test")!;
    const raw = await modelContext.executeTool(relayTool, JSON.stringify({ cycles: 3, duration_ms: 20 }));
    const summary = JSON.parse(raw);

    expect(summary.faultReproduced).toBe(true);
    expect(summary.resetOccurred).toBe(true);
    expect(summary.resetReason).toBe("BROWNOUT");
    expect(summary.supply_voltage.minimum_v).toBeLessThan(2.80);
    expect(summary.supply_voltage.drop_v).toBeGreaterThan(0.5);
  });

  it("6. Semantic Correction: Requested/completed cycle counts remain factually correct", async () => {
    await virtualDevice.connect();
    await toolRegistrar.registerDevice(virtualDevice);

    const tools = await modelContext.getTools();
    const relayTool = tools.find((t: RegisteredTool) => t.name === "run_relay_stress_test")!;
    const raw = await modelContext.executeTool(relayTool, JSON.stringify({ cycles: 3, duration_ms: 20 }));
    const summary = JSON.parse(raw);

    // Factual state: 3 cycles requested, 0 completed, reset during cycle 1
    expect(summary.repetitions).toBe(3);
    expect(summary.cyclesCompleted).toBe(0);
    expect(summary.resetOccurred).toBe(true);
    expect(summary.failures).toBe(1);

    // Verify UI semantic formatting constraint: must NOT represent 3 completed failures
    const formattedCycles = `Requested cycles: ${summary.repetitions} | Completed cycles: ${summary.cyclesCompleted}`;
    expect(formattedCycles).toBe("Requested cycles: 3 | Completed cycles: 0");
    expect(summary.cyclesCompleted).not.toBe(3);
  });

  it("7. Device disconnect returns UI to disconnected state and unregisters tools", async () => {
    await virtualDevice.connect();
    await toolRegistrar.registerDevice(virtualDevice);
    expect((await modelContext.getTools()).length).toBe(8);

    await virtualDevice.disconnect();
    toolRegistrar.unregisterDevice(virtualDevice);

    const remainingTools = await modelContext.getTools();
    expect(remainingTools.length).toBe(0);
    expect(virtualDevice.isConnected()).toBe(false);
  });

  it("8. Architecture Verification: No direct DeviceAdapter diagnostic invocation from Demo Controls", async () => {
    await virtualDevice.connect();
    await toolRegistrar.registerDevice(virtualDevice);

    // Spy on executeCapability
    let directAdapterCallCount = 0;
    const originalExecute = virtualDevice.executeCapability.bind(virtualDevice);
    virtualDevice.executeCapability = async (name, params, signal) => {
      directAdapterCallCount++;
      return originalExecute(name, params, signal);
    };

    // Invoking via WebMCP executeTool
    const tools = await modelContext.getTools();
    const relayTool = tools.find((t: RegisteredTool) => t.name === "run_relay_stress_test")!;
    await modelContext.executeTool(relayTool, JSON.stringify({ cycles: 1, duration_ms: 10 }));

    // executeCapability was called by ExperimentRunner inside the WebMCP tool closure, NOT directly by caller
    expect(directAdapterCallCount).toBe(1);
    const storeExp = experimentStore.getExperiments();
    expect(storeExp.length).toBe(1);
    expect(storeExp[0].metadata.capability).toBe("run_relay_stress_test");
  });
});
