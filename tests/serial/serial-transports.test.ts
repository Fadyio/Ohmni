import { describe, it, expect } from "bun:test";
import { LoopbackSerialTransport } from "../../src/infrastructure/serial/loopback-serial-transport";
import {
  WebSerialTransport,
  isWebSerialSupported,
  checkWebSerialSupport,
} from "../../src/infrastructure/serial/web-serial-transport";
import { ReferenceSerialDeviceSimulator } from "../../src/infrastructure/serial/reference-simulator";
import { NdjsonParser } from "../../src/infrastructure/serial/ndjson-parser";
import type {
  DescriptorMessage,
  ResponseMessage,
  TelemetryMessage,
  EventMessage,
} from "../../src/infrastructure/serial/protocol";

describe("Serial Transports & Reference Simulator", () => {
  describe("LoopbackSerialTransport", () => {
    it("connects and bidirectionally transmits byte streams between pairs", async () => {
      const [host, peer] = LoopbackSerialTransport.createPair();
      await host.connect();
      await peer.connect();

      expect(host.connected).toBe(true);
      expect(peer.connected).toBe(true);

      const hostReceived: string[] = [];
      const peerReceived: string[] = [];
      const decoder = new TextDecoder();

      host.subscribeData((b) => hostReceived.push(decoder.decode(b)));
      peer.subscribeData((b) => peerReceived.push(decoder.decode(b)));

      await host.write("PING\n");
      await peer.write("PONG\n");

      expect(peerReceived.join("")).toBe("PING\n");
      expect(hostReceived.join("")).toBe("PONG\n");

      await host.disconnect();
      expect(host.connected).toBe(false);
      expect(peer.connected).toBe(false);
    });

    it("fragments transmissions when chunkSize is configured", async () => {
      const [host, peer] = LoopbackSerialTransport.createPair({ chunkSize: 4 });
      await host.connect();
      await peer.connect();

      const chunks: number[] = [];
      peer.subscribeData((b) => chunks.push(b.length));

      await host.write("1234567890"); // 10 bytes -> 4, 4, 2

      expect(chunks).toEqual([4, 4, 2]);
    });

    it("propagates disconnect to subscribers", async () => {
      const [host, peer] = LoopbackSerialTransport.createPair();
      await host.connect();
      await peer.connect();

      let hostDisconnected = false;
      let peerDisconnected = false;

      host.subscribeDisconnect(() => {
        hostDisconnected = true;
      });
      peer.subscribeDisconnect(() => {
        peerDisconnected = true;
      });

      await host.disconnect("User unplugged");

      expect(hostDisconnected).toBe(true);
      expect(peerDisconnected).toBe(true);
    });
  });

  describe("WebSerialTransport Feature & Support Detection", () => {
    it("truthfully detects environment support without throwing", () => {
      const supported = isWebSerialSupported();
      const check = checkWebSerialSupport();

      expect(typeof supported).toBe("boolean");
      expect(typeof check.supported).toBe("boolean");

      // In non-browser Bun runtime, check.supported must be false and explain why
      if (typeof window === "undefined") {
        expect(check.supported).toBe(false);
        expect(check.reason).toContain("browser");
      }
    });
  });

  describe("ReferenceSerialDeviceSimulator", () => {
    it("responds to hello with a valid ADR 0006 descriptor", async () => {
      const [hostTransport, peerTransport] = LoopbackSerialTransport.createPair();
      await hostTransport.connect();
      await peerTransport.connect();

      const simulator = new ReferenceSerialDeviceSimulator(peerTransport);
      const hostParser = new NdjsonParser();
      hostTransport.subscribeData((b) => hostParser.push(b));

      const { promise, resolve } = Promise.withResolvers<DescriptorMessage>();
      hostParser.onMessage((msg) => {
        if (msg.type === "descriptor") resolve(msg);
      });

      await hostTransport.write('{"type":"hello","protocol":1}\n');
      const descriptor = await promise;

      expect(descriptor.type).toBe("descriptor");
      expect(descriptor.protocol).toBe(1);
      expect(descriptor.device.id).toBe("esp32s3-ref-001");
      expect(descriptor.capabilities.some((c) => c.name === "read_device_info")).toBe(true);
      expect(descriptor.capabilities.some((c) => c.name === "run_relay_stress_test")).toBe(true);

      simulator.destroy();
      await hostTransport.disconnect();
    });

    it("executes correlated requests and responds with results", async () => {
      const [hostTransport, peerTransport] = LoopbackSerialTransport.createPair();
      await hostTransport.connect();
      await peerTransport.connect();

      const simulator = new ReferenceSerialDeviceSimulator(peerTransport);
      const hostParser = new NdjsonParser();
      hostTransport.subscribeData((b) => hostParser.push(b));

      const { promise, resolve } = Promise.withResolvers<ResponseMessage>();
      hostParser.onMessage((msg) => {
        if (msg.type === "response" && msg.id === "req_info") resolve(msg);
      });

      await hostTransport.write(
        '{"type":"request","id":"req_info","capability":"read_device_info"}\n'
      );
      const response = await promise;

      expect(response.ok).toBe(true);
      if (response.ok) {
        expect(response.result?.chip).toBe("ESP32-S3");
        expect(response.result?.boardIdentifier).toBe("ESP32-S3-REF-001");
      }

      simulator.destroy();
      await hostTransport.disconnect();
    });

    it("runs relay stress test, streams telemetry, and returns to safe open state", async () => {
      const [hostTransport, peerTransport] = LoopbackSerialTransport.createPair();
      await hostTransport.connect();
      await peerTransport.connect();

      const simulator = new ReferenceSerialDeviceSimulator(peerTransport);
      const hostParser = new NdjsonParser();
      hostTransport.subscribeData((b) => hostParser.push(b));

      let telemetryReceived = false;
      let relayEnergized = false;
      let relayOpened = false;

      const { promise, resolve } = Promise.withResolvers<ResponseMessage>();

      hostParser.onMessage((msg) => {
        if (msg.type === "telemetry") {
          telemetryReceived = true;
        } else if (msg.type === "event" && msg.event === "relay_state") {
          const state = "state" in msg ? msg.state : undefined;
          if (state === "closed") relayEnergized = true;
          if (state === "open") relayOpened = true;
        } else if (msg.type === "response" && msg.id === "req_relay") {
          resolve(msg);
        }
      });

      await hostTransport.write(
        '{"type":"request","id":"req_relay","capability":"run_relay_stress_test","params":{"cycles":2,"duration_ms":30}}\n'
      );
      const response = await promise;

      expect(response.ok).toBe(true);
      expect(telemetryReceived).toBe(true);
      expect(relayEnergized).toBe(true);
      expect(relayOpened).toBe(true);
      expect(simulator.getRelayState()).toBe("open"); // Safe state verified

      simulator.destroy();
      await hostTransport.disconnect();
    });
    it("simulates brownout reset and resets hardware to safe state", async () => {
      const [hostTransport, peerTransport] = LoopbackSerialTransport.createPair();
      await hostTransport.connect();
      await peerTransport.connect();

      const simulator = new ReferenceSerialDeviceSimulator(peerTransport, {
        brownoutOnRelay: true,
      });
      const hostParser = new NdjsonParser();
      hostTransport.subscribeData((b) => hostParser.push(b));

      let resetEventReceived = false;
      const { promise, resolve } = Promise.withResolvers<ResponseMessage>();

      hostParser.onMessage((msg) => {
        if (msg.type === "event" && msg.event === "reset") {
          resetEventReceived = true;
        } else if (msg.type === "response" && msg.id === "req_brownout") {
          resolve(msg);
        }
      });

      await hostTransport.write(
        '{"type":"request","id":"req_brownout","capability":"run_relay_stress_test"}\n'
      );
      const response = await promise;

      expect(response.ok).toBe(false);
      if (!response.ok) {
        expect(response.error.code).toBe("DEVICE_RESET");
      }
      expect(resetEventReceived).toBe(true);
      expect(simulator.getRelayState()).toBe("open"); // Relay forced open on reset

      // Boot text was routed to RawDeviceLog
      const rawEntries = hostParser.getRawLog().getEntries();
      expect(rawEntries.some((e) => e.isBootText)).toBe(true);

      simulator.destroy();
      await hostTransport.disconnect();
    });

    it("handles cancel message and returns hardware to safe open state", async () => {
      const [hostTransport, peerTransport] = LoopbackSerialTransport.createPair();
      await hostTransport.connect();
      await peerTransport.connect();

      const simulator = new ReferenceSerialDeviceSimulator(peerTransport, {
        responseDelayMs: 50,
      });
      const hostParser = new NdjsonParser();
      hostTransport.subscribeData((b) => hostParser.push(b));

      const { promise, resolve } = Promise.withResolvers<ResponseMessage>();
      hostParser.onMessage((msg) => {
        if (msg.type === "response" && msg.id === "req_cancel") {
          resolve(msg);
        }
      });

      // Send request
      await hostTransport.write(
        '{"type":"request","id":"req_cancel","capability":"run_relay_stress_test"}\n'
      );

      // Send cancel immediately
      await hostTransport.write('{"type":"cancel","id":"req_cancel"}\n');

      const response = await promise;
      expect(response.ok).toBe(false);
      if (!response.ok) {
        expect(response.error.code).toBe("ABORTED");
      }
      expect(simulator.getRelayState()).toBe("open");

      simulator.destroy();
      await hostTransport.disconnect();
    });
  });
});
