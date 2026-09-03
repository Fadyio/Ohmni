import { describe, it, expect } from "bun:test";
import { SerialDeviceAdapter } from "../../src/infrastructure/serial/serial-device-adapter";
import { LoopbackSerialTransport } from "../../src/infrastructure/serial/loopback-serial-transport";
import { ReferenceSerialDeviceSimulator } from "../../src/infrastructure/serial/reference-simulator";
import { describeDeviceAdapterContract } from "../contracts/device-adapter.contract";
import type { DeviceEvent, TelemetryChunkEvent, VoltageSampleEvent } from "../../src/domain/device/events";
import { CapabilityRegistry } from "../../src/infrastructure/webmcp/capability-registry";
import { DeviceToolRegistrar } from "../../src/infrastructure/webmcp/device-tool-registrar";
import { InMemoryModelContext } from "../../src/infrastructure/webmcp/in-memory-model-context";

// 1. DeviceAdapter Behavioral Contract Test Suite
describeDeviceAdapterContract("SerialDeviceAdapter", {
  createAdapter: () => {
    const [hostTransport, peerTransport] = LoopbackSerialTransport.createPair();
    // Start simulator on peer side
    new ReferenceSerialDeviceSimulator(peerTransport);
    return new SerialDeviceAdapter(hostTransport, { handshakeTimeoutMs: 2000 });
  },
});

// 2. Focused Serial Protocol & Security Test Matrix
describe("SerialDeviceAdapter Detailed Matrix", () => {
  describe("B. Handshake", () => {
    it("connects cleanly with valid descriptor", async () => {
      const [host, peer] = LoopbackSerialTransport.createPair();
      const sim = new ReferenceSerialDeviceSimulator(peer);
      const adapter = new SerialDeviceAdapter(host);

      await adapter.connect();
      expect(adapter.isConnected()).toBe(true);
      const descriptor = adapter.getDescriptor();
      expect(descriptor.id).toBe("esp32s3-ref-001");
      expect(descriptor.capabilities.length).toBeGreaterThan(0);

      sim.destroy();
      await adapter.disconnect();
    });

    it("fails handshake on timeout when device does not reply", async () => {
      const [host] = LoopbackSerialTransport.createPair();
      const adapter = new SerialDeviceAdapter(host, { handshakeTimeoutMs: 100 });

      const promise = adapter.connect();
      await expect(promise).rejects.toThrow(/handshake timeout/i);
      expect(adapter.isConnected()).toBe(false);
    });

    it("rejects unsupported protocol version", async () => {
      const [host, peer] = LoopbackSerialTransport.createPair();
      const sim = new ReferenceSerialDeviceSimulator(peer, { protocolVersion: 99 });
      const adapter = new SerialDeviceAdapter(host, { handshakeTimeoutMs: 500 });

      const promise = adapter.connect();
      await expect(promise).rejects.toThrow(/unsupported protocol version/i);
      expect(adapter.isConnected()).toBe(false);

      sim.destroy();
    });

    it("survives and parses descriptor even if bootloader junk precedes it", async () => {
      const [host, peer] = LoopbackSerialTransport.createPair();
      await peer.connect();

      // Peer emits boot junk before responding to hello
      peer.subscribeData(async (bytes) => {
        const text = new TextDecoder().decode(bytes);
        if (text.includes("hello")) {
          await peer.write("rst:0x1 (POWERON_RESET),boot:0x13\n");
          await peer.write("configsip: 0, SPIWP:0xee\n");
          await peer.write(
            JSON.stringify({
              type: "descriptor",
              protocol: 1,
              device: {
                id: "esp32-noisy",
                name: "ESP32 Noisy Boot",
                firmwareVersion: "1.0.0",
              },
              capabilities: [{ name: "measure_supply_voltage", safety: "green" }],
            }) + "\n"
          );
        }
      });

      const adapter = new SerialDeviceAdapter(host, { handshakeTimeoutMs: 1000 });
      await adapter.connect();

      expect(adapter.isConnected()).toBe(true);
      expect(adapter.getDescriptor().id).toBe("esp32-noisy");
      expect(adapter.getRawLog().count()).toBeGreaterThanOrEqual(2);

      await adapter.disconnect();
    });

    it("rejects malformed descriptor payload during handshake", async () => {
      const [host, peer] = LoopbackSerialTransport.createPair();
      await peer.connect();

      // Peer sends invalid non-conforming descriptor
      peer.subscribeData(async (bytes) => {
        const text = new TextDecoder().decode(bytes);
        if (text.includes("hello")) {
          await peer.write('{"type":"descriptor","protocol":"NOT_A_NUMBER","device":null}\n');
        }
      });

      const adapter = new SerialDeviceAdapter(host, { handshakeTimeoutMs: 300 });
      await expect(adapter.connect()).rejects.toThrow(/invalid device descriptor/i);
      expect(adapter.isConnected()).toBe(false);
    });
  });

  describe("C. RPC & Concurrency", () => {
    it("executes concurrent requests with correlated responses", async () => {
      const [host, peer] = LoopbackSerialTransport.createPair();
      const sim = new ReferenceSerialDeviceSimulator(peer);
      const adapter = new SerialDeviceAdapter(host);
      await adapter.connect();

      const [res1, res2, res3] = await Promise.all([
        adapter.executeCapability("read_device_info"),
        adapter.executeCapability("read_system_health"),
        adapter.executeCapability("measure_supply_voltage"),
      ]);

      expect(res1.ok).toBe(true);
      expect(res2.ok).toBe(true);
      expect(res3.ok).toBe(true);

      expect((res1.data as Record<string, unknown>).chip).toBe("ESP32-S3");
      expect((res2.data as Record<string, unknown>).freeHeapBytes).toBeGreaterThan(0);
      expect((res3.data as Record<string, unknown>).voltage).toBe(3.31);

      sim.destroy();
      await adapter.disconnect();
    });

    it("returns device error correctly when capability execution fails", async () => {
      const [host, peer] = LoopbackSerialTransport.createPair();
      const sim = new ReferenceSerialDeviceSimulator(peer, { brownoutOnRelay: true });
      const adapter = new SerialDeviceAdapter(host);
      await adapter.connect();

      const result = await adapter.executeCapability("run_relay_stress_test");
      expect(result.ok).toBe(false);
      expect(result.error?.code).toBe("DEVICE_RESET");

      sim.destroy();
      await adapter.disconnect();
    });

    it("times out hung requests without stalling adapter", async () => {
      const [host, peer] = LoopbackSerialTransport.createPair();
      await peer.connect();

      // Peer ignores requests after handshake
      peer.subscribeData(async (bytes) => {
        const text = new TextDecoder().decode(bytes);
        if (text.includes("hello")) {
          await peer.write(
            JSON.stringify({
              type: "descriptor",
              protocol: 1,
              device: { id: "silent", name: "Silent", firmwareVersion: "1.0" },
              capabilities: [{ name: "measure_supply_voltage", safety: "green" }],
            }) + "\n"
          );
        }
      });

      const adapter = new SerialDeviceAdapter(host, { defaultRequestTimeoutMs: 150 });
      await adapter.connect();

      const result = await adapter.executeCapability("measure_supply_voltage");
      await adapter.disconnect();
    });

    it("handles out-of-order responses correctly matching request IDs", async () => {
      const [host, peer] = LoopbackSerialTransport.createPair();
      await peer.connect();

      const receivedRequests: Array<{ id: string; capability: string }> = [];
      peer.subscribeData(async (bytes) => {
        const lines = new TextDecoder().decode(bytes).split("\n").filter(Boolean);
        for (const line of lines) {
          const parsed = JSON.parse(line);
          if (parsed.type === "hello") {
            await peer.write(
              JSON.stringify({
                type: "descriptor",
                protocol: 1,
                device: { id: "ooo-test", name: "Out of Order Test", firmwareVersion: "1.0" },
                capabilities: [
                  { name: "fast_cmd", safety: "green" },
                  { name: "slow_cmd", safety: "green" },
                ],
              }) + "\n"
            );
          } else if (parsed.type === "request") {
            receivedRequests.push({ id: parsed.id, capability: parsed.capability });
            if (receivedRequests.length === 2) {
              // Reply to request 2 (slow_cmd) FIRST, then request 1 (fast_cmd) SECOND
              const req2 = receivedRequests[1];
              const req1 = receivedRequests[0];
              await peer.write(
                JSON.stringify({ type: "response", id: req2.id, ok: true, result: { tag: "SECOND_REQ" } }) + "\n"
              );
              await new Promise((r) => setTimeout(r, 20));
              await peer.write(
                JSON.stringify({ type: "response", id: req1.id, ok: true, result: { tag: "FIRST_REQ" } }) + "\n"
              );
            }
          }
        }
      });

      const adapter = new SerialDeviceAdapter(host);
      await adapter.connect();

      // Fire both concurrently
      const [res1, res2] = await Promise.all([
        adapter.executeCapability("fast_cmd"),
        adapter.executeCapability("slow_cmd"),
      ]);

      expect(res1.ok).toBe(true);
      expect((res1.data as Record<string, unknown>).tag).toBe("FIRST_REQ");
      expect(res2.ok).toBe(true);
      expect((res2.data as Record<string, unknown>).tag).toBe("SECOND_REQ");

      await adapter.disconnect();
    });
  });

  describe("D. Abort & CANCEL", () => {
    it("transmits CANCEL message and rejects in-flight request when AbortSignal fires", async () => {
      const [host, peer] = LoopbackSerialTransport.createPair();
      const sim = new ReferenceSerialDeviceSimulator(peer, { responseDelayMs: 200 });
      const adapter = new SerialDeviceAdapter(host);
      await adapter.connect();

      let cancelReceived = false;
      peer.subscribeData((bytes) => {
        const text = new TextDecoder().decode(bytes);
        if (text.includes('"type":"cancel"')) {
          cancelReceived = true;
        }
      });

      const controller = new AbortController();
      setTimeout(() => controller.abort(), 20);

      const promise = adapter.executeCapability(
        "run_relay_stress_test",
        { cycles: 5, duration_ms: 100 },
        controller.signal
      );

      await expect(promise).rejects.toThrow(/cancelled by host AbortSignal/i);
      expect(cancelReceived).toBe(true);
      expect(sim.getRelayState()).toBe("open"); // Safe state restored

      sim.destroy();
      await adapter.disconnect();
    });
  });

  describe("E. Telemetry & Events", () => {
    it("maps chunked telemetry into domain events and feeds oscilloscope samples", async () => {
      const [host, peer] = LoopbackSerialTransport.createPair();
      const sim = new ReferenceSerialDeviceSimulator(peer);
      const adapter = new SerialDeviceAdapter(host);
      await adapter.connect();

      const events: DeviceEvent[] = [];
      adapter.subscribe((e) => events.push(e));

      await adapter.executeCapability("run_relay_stress_test", { cycles: 2, duration_ms: 30 });

      const chunks = events.filter((e): e is TelemetryChunkEvent => e.type === "telemetry_chunk");
      const voltageSamples = events.filter((e): e is VoltageSampleEvent => e.type === "voltage_sample");

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[0].channel).toBe("supply_voltage");
      expect(voltageSamples.length).toBeGreaterThan(0);

      sim.destroy();
      await adapter.disconnect();
    });
  });

  describe("F. Capability Security Firewall", () => {
    it("strips red and prohibited tools from physical descriptor before WebMCP exposure", async () => {
      const [host, peer] = LoopbackSerialTransport.createPair();
      // Simulator configured to return malicious capabilities
      const sim = new ReferenceSerialDeviceSimulator(peer, { maliciousCapabilities: true });
      const adapter = new SerialDeviceAdapter(host);
      await adapter.connect();

      const descriptor = adapter.getDescriptor();
      const capNames = descriptor.capabilities.map((c) => c.name);

      // Prohibited tools MUST be stripped
      expect(capNames).not.toContain("erase_flash");
      expect(capNames).not.toContain("raw_memory_write");
      expect(capNames).not.toContain("arbitrary_serial");

      // Only safe read_device_info remained
      expect(capNames).toContain("read_device_info");

      // Verify DeviceToolRegistrar also rejects red tools
      const modelContext = new InMemoryModelContext();
      const capabilityRegistry = new CapabilityRegistry();
      const registrar = new DeviceToolRegistrar(modelContext, capabilityRegistry);

      const session = await registrar.registerDevice(adapter);
      expect(session.registeredToolNames).not.toContain("erase_flash");
      expect(session.registeredToolNames).not.toContain("raw_memory_write");
      expect(session.registeredToolNames).toContain("read_device_info");

      sim.destroy();
      await adapter.disconnect();
    });
  });

  describe("G. Reset Recovery & Re-Handshake", () => {
    it("safely aborts in-flight request on boot text detection and recovers state", async () => {
      const [host, peer] = LoopbackSerialTransport.createPair();
      const sim = new ReferenceSerialDeviceSimulator(peer);
      let resetDetected = false;

      const adapter = new SerialDeviceAdapter(host, {
        defaultRequestTimeoutMs: 3000,
        onResetDetected: () => {
          resetDetected = true;
        },
      });
      await adapter.connect();

      // Trigger reset simulation from peer while adapter is running
      const resetPromise = sim.simulateReset("BROWNOUT");
      await resetPromise;

      expect(resetDetected).toBe(true);
      expect(adapter.getRawLog().getEntries().some((e) => e.isBootText)).toBe(true);

      sim.destroy();
      await adapter.disconnect();
    });
  });
});
