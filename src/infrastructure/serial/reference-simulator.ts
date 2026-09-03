/**
 * Reference Serial Hardware Simulator.
 *
 * Implements a realistic hardware test peer that speaks ADR 0006 v1 over any SerialTransport.
 * Emulates the ESP32-S3 microcontroller electrical dynamics, relay actuation,
 * brownout resets, chunked telemetry, and asynchronous protocol events.
 */

import type { SerialTransport } from "./serial-transport";
import {
  type ProtocolMessage,
  type HelloMessage,
  type RequestMessage,
  type CancelMessage,
  type DescriptorMessage,
  PROTOCOL_VERSION,
} from "./protocol";
import { NdjsonParser } from "./ndjson-parser";

export interface SimulatorBehaviorOptions {
  readonly protocolVersion?: number;
  readonly handshakeDelayMs?: number;
  readonly responseDelayMs?: number;
  readonly brownoutOnRelay?: boolean;
  readonly maliciousCapabilities?: boolean;
  readonly malformedDescriptor?: boolean;
  readonly chunkFragmentation?: number;
  readonly outOfOrderResponses?: boolean;
}

export class ReferenceSerialDeviceSimulator {
  private readonly transport: SerialTransport;
  private readonly parser: NdjsonParser;
  private options: SimulatorBehaviorOptions;
  private relayState: "open" | "closed" = "open";
  private railVoltage = 3.31;
  private resetCount = 0;
  private readonly activeRequests = new Map<string, { capability: string; cancelled: boolean }>();
  private readonly encoder = new TextEncoder();
  private unsubscribeTransport?: () => void;

  constructor(transport: SerialTransport, options: SimulatorBehaviorOptions = {}) {
    this.transport = transport;
    this.options = options;
    this.parser = new NdjsonParser();

    if (!this.transport.connected) {
      void this.transport.connect();
    }

    this.parser.onMessage((msg) => this.handleMessage(msg));
    this.unsubscribeTransport = this.transport.subscribeData((bytes) => {
      this.parser.push(bytes);
    });
  }

  public setOptions(options: Partial<SimulatorBehaviorOptions>): void {
    this.options = { ...this.options, ...options };
  }

  public getRelayState(): "open" | "closed" {
    return this.relayState;
  }

  public getRailVoltage(): number {
    return this.railVoltage;
  }

  public getResetCount(): number {
    return this.resetCount;
  }

  public destroy(): void {
    if (this.unsubscribeTransport) {
      this.unsubscribeTransport();
      this.unsubscribeTransport = undefined;
    }
  }

  private async handleMessage(msg: ProtocolMessage): Promise<void> {
    switch (msg.type) {
      case "hello":
        await this.handleHello(msg);
        break;
      case "request":
        await this.handleRequest(msg);
        break;
      case "cancel":
        await this.handleCancel(msg);
        break;
      default:
        // Ignore unrecognized inbound messages
        break;
    }
  }

  private async handleHello(msg: HelloMessage): Promise<void> {
    if (this.options.handshakeDelayMs && this.options.handshakeDelayMs > 0) {
      await this.sleep(this.options.handshakeDelayMs);
    }

    if (this.options.malformedDescriptor) {
      await this.sendRaw("NOT_A_VALID_DESCRIPTOR_AT_ALL\n");
      return;
    }

    const capabilities = this.options.maliciousCapabilities
      ? [
          { name: "read_device_info", safety: "green" as const, readOnly: true },
          { name: "erase_flash", safety: "red" as const, readOnly: false },
          { name: "raw_memory_write", safety: "red" as const, readOnly: false },
          { name: "arbitrary_serial", safety: "red" as const, readOnly: false },
        ]
      : [
          {
            name: "read_device_info",
            description: "Read hardware identity, chip model, and firmware version.",
            safety: "green" as const,
            readOnly: true,
          },
          {
            name: "read_reset_history",
            description: "Retrieve chronological log of system reset events and causes.",
            safety: "green" as const,
            readOnly: true,
          },
          {
            name: "read_system_health",
            description: "Read operational diagnostics including free heap, core temp, and uptime.",
            safety: "green" as const,
            readOnly: true,
          },
          {
            name: "measure_supply_voltage",
            description: "Sample instantaneous voltage on the primary 3.3V rail.",
            safety: "green" as const,
            readOnly: true,
          },
          {
            name: "run_relay_stress_test",
            description: "Actuate relay coil and monitor supply rail for brownout droop.",
            safety: "amber" as const,
            readOnly: false,
            parameters: {
              cycles: { type: "integer", minimum: 1, maximum: 10 },
              duration_ms: { type: "integer", minimum: 10, maximum: 500 },
            },
          },
        ];

    const descriptor: DescriptorMessage = {
      type: "descriptor",
      protocol: this.options.protocolVersion ?? PROTOCOL_VERSION,
      device: {
        id: "esp32s3-ref-001",
        name: "ESP32-S3 Reference Controller",
        firmwareVersion: "1.0.0",
        manufacturer: "Espressif",
        model: "ESP32-S3-WROOM-1",
        hardwareRevision: "Rev 1.0",
        transport: "Web Serial",
      },
      capabilities,
      limits: {
        maxRelayCycles: 10,
        maxRelayDurationMs: 500,
        voltageSagThreshold: 2.8,
      },
    };

    await this.sendMessage(descriptor);
  }

  private async handleRequest(req: RequestMessage): Promise<void> {
    const entry = { capability: req.capability, cancelled: false };
    this.activeRequests.set(req.id, entry);

    if (this.options.responseDelayMs && this.options.responseDelayMs > 0) {
      await this.sleep(this.options.responseDelayMs);
    }

    if (entry.cancelled) {
      return;
    }

    switch (req.capability) {
      case "read_device_info":
        await this.sendMessage({
          type: "response",
          id: req.id,
          ok: true,
          result: {
            chip: "ESP32-S3",
            boardIdentifier: "ESP32-S3-REF-001",
            firmwareVersion: "1.0.0",
            protocolVersion: "1.0",
            flashSizeMb: 16,
            macAddress: "7C:DF:A1:02:4B:9C",
            nominalVoltage: 3.3,
          },
        });
        break;

      case "read_reset_history":
        await this.sendMessage({
          type: "response",
          id: req.id,
          ok: true,
          result: {
            resetCount: this.resetCount,
            history: [
              {
                timestamp: Date.now() - 120_000,
                reason: "POWER_ON",
                message: "Initial cold boot",
              },
              ...(this.resetCount > 0
                ? [
                    {
                      timestamp: Date.now() - 5_000,
                      reason: "BROWNOUT",
                      message: "Supply rail collapsed below 2.80V threshold",
                    },
                  ]
                : []),
            ],
          },
        });
        break;

      case "read_system_health":
        await this.sendMessage({
          type: "response",
          id: req.id,
          ok: true,
          result: {
            freeHeapBytes: 284_120,
            minFreeHeapBytes: 245_100,
            coreTemperatureC: 41.5,
            uptimeSeconds: 120,
          },
        });
        break;

      case "measure_supply_voltage":
        await this.sendMessage({
          type: "response",
          id: req.id,
          ok: true,
          result: {
            voltage: this.railVoltage,
            unit: "V",
            status: this.railVoltage >= 2.8 ? "NOMINAL" : "BROWNOUT_WARNING",
          },
        });
        break;

      case "run_relay_stress_test":
        await this.executeRelayStressTest(req, entry);
        break;

      default:
        await this.sendMessage({
          type: "response",
          id: req.id,
          ok: false,
          error: {
            code: "UNKNOWN_CAPABILITY",
            message: `Capability '${req.capability}' is not implemented by device`,
          },
        });
        break;
    }

    this.activeRequests.delete(req.id);
  }

  private async executeRelayStressTest(
    req: RequestMessage,
    entry: { capability: string; cancelled: boolean }
  ): Promise<void> {
    const rawCycles = req.params?.cycles;
    const rawDuration = req.params?.duration_ms ?? req.params?.durationMs;
    const cycles = typeof rawCycles === "number" ? Math.min(10, Math.max(1, rawCycles)) : 3;
    const durationMs = typeof rawDuration === "number" ? Math.min(500, Math.max(10, rawDuration)) : 50;

    const t0 = Date.now();
    const isBrownout = Boolean(this.options.brownoutOnRelay);

    // Actuate relay
    this.relayState = "closed";
    await this.sendMessage({
      type: "event",
      event: "relay_state",
      state: "closed",
      pin: 4,
      timestamp: Date.now(),
    });

    if (isBrownout) {
      // Rail droop to 2.72 V
      this.railVoltage = 2.72;
      const sagSamples = [3.31, 3.25, 3.05, 2.85, 2.72, 2.72];
      await this.sendMessage({
        type: "telemetry",
        channel: "supply_voltage",
        unit: "V",
        t0_ms: t0,
        dt_ms: 10,
        samples: sagSamples,
      });

      // Emulate MCU reset
      this.resetCount++;
      this.relayState = "open"; // Hardware resets to safe state
      this.railVoltage = 3.31; // Rail recovers after relay drops

      await this.sendMessage({
        type: "event",
        event: "reset",
        reason: "BROWNOUT",
        timestamp: Date.now(),
        message: "ESP32-S3 supply voltage fell below 2.80V brownout threshold",
      });

      // Emit ESP32 bootloader ROM output
      await this.sendRaw(
        "rst:0xf (BROWNOUT_RST),boot:0x13 (SPI_FAST_FLASH_BOOT)\n" +
          "configsip: 0, SPIWP:0xee\n" +
          "clk_drv:0x00,q_drv:0x00,d_drv:0x00,cs0_drv:0x00,hd_drv:0x00,wp_drv:0x00\n" +
          "mode:DIO, clock div:1\n" +
          "load:0x3fce3808,len:0x043c\n" +
          "entry 0x403c9880\n"
      );

      // Return failure response indicating brownout reset occurred
      await this.sendMessage({
        type: "response",
        id: req.id,
        ok: false,
        error: {
          code: "DEVICE_RESET",
          message: "Target microcontroller brownout reset occurred during relay actuation",
        },
      });
      return;
    }

    // Stable run
    this.railVoltage = 3.28;
    const nominalSamples = [3.31, 3.3, 3.29, 3.28, 3.28, 3.3];
    await this.sendMessage({
      type: "telemetry",
      channel: "supply_voltage",
      unit: "V",
      t0_ms: t0,
      dt_ms: 10,
      samples: nominalSamples,
    });

    if (entry.cancelled) {
      this.relayState = "open";
      return;
    }

    // Return relay to open state
    this.relayState = "open";
    this.railVoltage = 3.31;
    await this.sendMessage({
      type: "event",
      event: "relay_state",
      state: "open",
      pin: 4,
      timestamp: Date.now(),
    });

    await this.sendMessage({
      type: "response",
      id: req.id,
      ok: true,
      result: {
        executedCycles: cycles,
        durationMs,
        baselineVoltage: 3.31,
        minVoltage: 3.28,
        sagDelta: 0.03,
        finalVoltage: 3.31,
        resetOccurred: false,
      },
    });
  }

  private async handleCancel(cancel: CancelMessage): Promise<void> {
    const active = this.activeRequests.get(cancel.id);
    if (active) {
      active.cancelled = true;
      this.relayState = "open"; // Ensure hardware returns to safe state immediately
      await this.sendMessage({
        type: "response",
        id: cancel.id,
        ok: false,
        error: {
          code: "ABORTED",
          message: "Command cancelled by host request",
        },
      });
      this.activeRequests.delete(cancel.id);
    }
  }

  public async simulateReset(reason = "BROWNOUT"): Promise<void> {
    this.resetCount++;
    this.relayState = "open";
    this.railVoltage = 3.31;

    await this.sendRaw(
      `rst:0xf (${reason}_RST),boot:0x13 (SPI_FAST_FLASH_BOOT)\n` +
        "configsip: 0, SPIWP:0xee\n" +
        "entry 0x403c9880\n"
    );

    await this.sendMessage({
      type: "event",
      event: "reset",
      reason,
      timestamp: Date.now(),
    });
  }

  public async simulateBootGarbage(): Promise<void> {
    await this.sendRaw(
      "ets Jun  8 2016 00:22:57\n" +
        "rst:0x1 (POWERON_RESET),boot:0x13 (SPI_FAST_FLASH_BOOT)\n"
    );
  }

  public async simulateMalformedJson(line = '{"type":"broken_json"\n'): Promise<void> {
    await this.sendRaw(line.endsWith("\n") ? line : `${line}\n`);
  }

  private async sendMessage(msg: ProtocolMessage): Promise<void> {
    const json = JSON.stringify(msg) + "\n";
    await this.sendRaw(json);
  }

  private async sendRaw(text: string): Promise<void> {
    if (!this.transport.connected) return;

    const bytes = this.encoder.encode(text);
    const frag = this.options.chunkFragmentation;

    if (frag && frag > 0 && bytes.length > frag) {
      for (let offset = 0; offset < bytes.length; offset += frag) {
        const slice = bytes.slice(offset, offset + frag);
        await this.transport.write(slice);
      }
    } else {
      await this.transport.write(bytes);
    }
  }

  private sleep(ms: number): Promise<void> {
    const { promise, resolve } = Promise.withResolvers<void>();
    setTimeout(resolve, ms);
    return promise;
  }
}
