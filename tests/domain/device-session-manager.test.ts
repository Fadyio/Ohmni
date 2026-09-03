import { describe, it, expect } from "bun:test";
import { DeviceSessionManager } from "../../src/domain/device/session-manager";
import { VirtualDeviceAdapter } from "../../src/domain/device/virtual-adapter";
import { SerialDeviceAdapter } from "../../src/infrastructure/serial/serial-device-adapter";
import { LoopbackSerialTransport } from "../../src/infrastructure/serial/loopback-serial-transport";
import { ReferenceSerialDeviceSimulator } from "../../src/infrastructure/serial/reference-simulator";
import { DeviceToolRegistrar } from "../../src/infrastructure/webmcp/device-tool-registrar";
import { CapabilityRegistry } from "../../src/infrastructure/webmcp/capability-registry";
import { InMemoryModelContext } from "../../src/infrastructure/webmcp/in-memory-model-context";
import { TelemetryEventBus } from "../../src/domain/telemetry/bus";
import { InMemoryEvidenceStore } from "../../src/domain/evidence/store";
import { InMemoryHypothesisStore } from "../../src/domain/hypothesis/store";

describe("DeviceSessionManager — Adapter Switching & Tool Lifecycle", () => {
  it("manages seamless switching between Virtual and Physical hardware adapters", async () => {
    const modelContext = new InMemoryModelContext();
    const capabilityRegistry = new CapabilityRegistry();
    const toolRegistrar = new DeviceToolRegistrar(modelContext, capabilityRegistry);
    const telemetryBus = new TelemetryEventBus();

    const evidenceStore = new InMemoryEvidenceStore();
    const hypothesisStore = new InMemoryHypothesisStore(evidenceStore);

    evidenceStore.createAndAdd({
      type: "measurement",
      source: "device",
      summary: "Baseline observation prior to adapter switch",
      provenance: { origin: "virtual_device" },
    });

    const virtualAdapter = new VirtualDeviceAdapter();
    const manager = new DeviceSessionManager({
      initialAdapter: virtualAdapter,
      initialMode: "virtual",
      toolRegistrar,
      telemetryBus,
    });

    // 1. Initial Virtual Session State
    expect(manager.getMode()).toBe("virtual");
    expect(manager.getAdapter()).toBe(virtualAdapter);
    expect(manager.getState().connectionState).toBe("disconnected");

    // Connect Virtual Device
    await manager.connect();
    expect(manager.getState().connectionState).toBe("connected");

    // WebMCP tools registered for virtual device
    let tools = await modelContext.getTools();
    expect(tools.length).toBeGreaterThan(0);
    expect(tools.some((t) => t.name === "read_device_info")).toBe(true);

    // 2. Switch to Physical Hardware (using LoopbackSerialTransport & Simulator)
    const [hostTransport, peerTransport] = LoopbackSerialTransport.createPair();
    const sim = new ReferenceSerialDeviceSimulator(peerTransport);
    const serialAdapter = new SerialDeviceAdapter(hostTransport);

    await manager.switchToPhysical(serialAdapter);

    // Virtual tools must be cleanly unregistered
    tools = await modelContext.getTools();
    expect(tools.length).toBe(0);
    expect(virtualAdapter.isConnected()).toBe(false);
    expect(manager.getMode()).toBe("physical");
    expect(manager.getAdapter()).toBe(serialAdapter);

    // Connect Physical Device
    await manager.connect();
    expect(manager.getState().connectionState).toBe("connected");

    // Physical tools registered on WebMCP
    tools = await modelContext.getTools();
    expect(tools.length).toBeGreaterThan(0);
    expect(tools.some((t) => t.name === "read_device_info")).toBe(true);

    // Evidence and hypothesis stores remain intact!
    expect(evidenceStore.getAll().length).toBe(1);
    expect(evidenceStore.getAll()[0].summary).toBe(
      "Baseline observation prior to adapter switch"
    );

    // 3. Switch back to Virtual Device
    await manager.switchToVirtual(virtualAdapter);

    // Physical tools must be cleanly unregistered
    tools = await modelContext.getTools();
    expect(tools.length).toBe(0);
    expect(serialAdapter.isConnected()).toBe(false);
    expect(manager.getMode()).toBe("virtual");

    // Connect Virtual Device again
    await manager.connect();
    tools = await modelContext.getTools();
    expect(tools.length).toBeGreaterThan(0);

    // Teardown
    await manager.disconnect();
    sim.destroy();
  });
});
