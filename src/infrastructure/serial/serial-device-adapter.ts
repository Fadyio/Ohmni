/**
 * Production Serial Device Adapter.
 *
 * Implements DeviceAdapter over Web Serial (or LoopbackSerialTransport in test).
 * Manages:
 * - Protocol v1 hello/descriptor handshake
 * - Correlated request/response RPC with timeouts and out-of-order resolution
 * - AbortSignal cancellation and CANCEL message delivery
 * - Asynchronous EVENT and chunked TELEMETRY mapping to DeviceEvent
 * - Capability firewall (blocking red, malicious, or unknown physical tools)
 * - Microcontroller brownout reset detection, boot text quarantine, and re-handshake
 */

import type { DeviceAdapter, CapabilityResult } from "@/domain/device/adapter";
import type { DeviceDescriptor, DeviceCapability, SafetyClassification } from "@/domain/device/descriptor";
import type { DeviceEvent, ResetReason } from "@/domain/device/events";
import type { SerialTransport } from "./serial-transport";
import { NdjsonParser } from "./ndjson-parser";
import { RawDeviceLog } from "./raw-device-log";
import {
  type ProtocolMessage,
  type DescriptorMessage,
  type ResponseMessage,
  type TelemetryMessage,
  type EventMessage,
  PROTOCOL_VERSION,
  parseProtocolMessage,
} from "./protocol";

const FORBIDDEN_CAPABILITY_NAMES = new Set<string>([
  "erase_flash",
  "raw_memory_write",
  "arbitrary_serial",
  "format_storage",
  "disable_safety",
  "write_efuse",
  "modify_bootloader",
]);

export interface SerialDeviceAdapterOptions {
  readonly handshakeTimeoutMs?: number;
  readonly defaultRequestTimeoutMs?: number;
  readonly rawLog?: RawDeviceLog;
  readonly onDisconnect?: (reason: string) => void;
  readonly onResetDetected?: (reason: string) => void;
  readonly onDescriptorUpdated?: (descriptor: DeviceDescriptor) => void;
}

type TimeoutHandle = number | object;

interface PendingRpc<T = Record<string, unknown>> {
  readonly capability: string;
  readonly resolve: (result: CapabilityResult<T>) => void;
  readonly reject: (error: Error) => void;
  readonly timeoutId: TimeoutHandle;
  readonly abortCleanup?: () => void;
}

export class SerialDeviceAdapter implements DeviceAdapter {
  private readonly transport: SerialTransport;
  private readonly parser: NdjsonParser;
  private readonly rawLog: RawDeviceLog;
  private readonly handshakeTimeoutMs: number;
  private readonly defaultRequestTimeoutMs: number;
  private readonly onDisconnectCb?: (reason: string) => void;
  private readonly onResetDetectedCb?: (reason: string) => void;
  private readonly onDescriptorUpdatedCb?: (descriptor: DeviceDescriptor) => void;

  private _connected = false;
  private descriptor?: DeviceDescriptor;
  private rawDescriptor?: DescriptorMessage;
  private readonly eventSubscribers = new Set<(event: DeviceEvent) => void>();
  private readonly pendingRequests = new Map<string, PendingRpc<unknown>>();
  private rpcCounter = 0;
  private unsubscribeTransportData?: () => void;
  private unsubscribeTransportDisconnect?: () => void;
  private unsubscribeBootDetected?: () => void;

  constructor(transport: SerialTransport, options: SerialDeviceAdapterOptions = {}) {
    this.transport = transport;
    this.handshakeTimeoutMs = options.handshakeTimeoutMs ?? 4_000;
    this.defaultRequestTimeoutMs = options.defaultRequestTimeoutMs ?? 6_000;
    this.onDisconnectCb = options.onDisconnect;
    this.onResetDetectedCb = options.onResetDetected;
    this.onDescriptorUpdatedCb = options.onDescriptorUpdated;

    this.rawLog = options.rawLog ?? new RawDeviceLog();
    this.parser = new NdjsonParser({ rawLog: this.rawLog });

    this.setupParserAndSubscriptions();
  }

  public getRawLog(): RawDeviceLog {
    return this.rawLog;
  }

  public getTransport(): SerialTransport {
    return this.transport;
  }

  public isConnected(): boolean {
    return this._connected && this.transport.connected;
  }

  public getDescriptor(): DeviceDescriptor {
    if (this.descriptor) {
      return this.descriptor;
    }
    return {
      id: "unconnected-serial-device",
      name: "Serial Device",
      firmwareVersion: "0.0.0",
      protocolVersion: PROTOCOL_VERSION,
      capabilities: [
        {
          name: "measure_supply_voltage",
          description: "Sample instantaneous supply rail voltage",
          safety: "green",
          readOnly: true,
        },
      ],
    };
  }

  public getRawDescriptor(): DescriptorMessage | undefined {
    return this.rawDescriptor;
  }

  private setupParserAndSubscriptions(): void {
    this.parser.onMessage((msg) => this.handleProtocolMessage(msg));

    this.unsubscribeTransportData = this.transport.subscribeData((bytes) => {
      this.parser.push(bytes);
    });

    this.unsubscribeTransportDisconnect = this.transport.subscribeDisconnect((reason) => {
      void this.handleTransportDisconnected(reason ?? "Physical transport closed");
    });

    this.unsubscribeBootDetected = this.rawLog.onBootDetected((entry) => {
      this.handleBootTextDetected(entry.line);
    });
  }

  public async connect(): Promise<void> {
    if (this._connected) {
      return;
    }

    if (!this.transport.connected) {
      await this.transport.connect();
    }

    this.parser.reset();

    const { promise, resolve, reject } = Promise.withResolvers<DescriptorMessage>();

    const timeoutId = setTimeout(() => {
      cleanup();
      reject(
        new Error(
          `Handshake timeout: Device did not respond with descriptor within ${this.handshakeTimeoutMs}ms`
        )
      );
    }, this.handshakeTimeoutMs);

    const unsubscribeMessage = this.parser.onMessage((msg) => {
      if (msg.type === "descriptor") {
        cleanup();
        resolve(msg);
      }
    });

    // If peer sends a line claiming to be a descriptor that failed protocol validation, fail fast
    const unsubscribeRaw = this.parser.getRawLog().subscribe((entry) => {
      if (entry.line.includes('"descriptor"')) {
        cleanup();
        reject(new Error(`Invalid device descriptor received during handshake: ${entry.line.trim()}`));
      }
    });

    const cleanup = () => {
      clearTimeout(timeoutId as unknown as number);
      unsubscribeMessage();
      unsubscribeRaw();
    };
    // Send Hello v1
    const hello = JSON.stringify({ type: "hello", protocol: PROTOCOL_VERSION }) + "\n";
    await this.transport.write(hello);

    let descMsg: DescriptorMessage;
    try {
      descMsg = await promise;
    } catch (err) {
      // Failed handshake — disconnect transport
      await this.transport.disconnect("Handshake failed");
      throw err;
    }

    if (descMsg.protocol !== PROTOCOL_VERSION) {
      await this.transport.disconnect("Unsupported protocol version");
      throw new Error(
        `Unsupported protocol version: Expected v${PROTOCOL_VERSION}, device reported v${descMsg.protocol}`
      );
    }

    this.rawDescriptor = descMsg;
    this.descriptor = this.convertDescriptor(descMsg);
    this._connected = true;
  }

  private convertDescriptor(descMsg: DescriptorMessage): DeviceDescriptor {
    const safeCapabilities: DeviceCapability[] = [];

    for (const cap of descMsg.capabilities) {
      // 1. Security Firewall: reject explicit red tools
      if (cap.safety === "red") {
        console.warn(`[SecurityFirewall] Stripped red physical capability: ${cap.name}`);
        continue;
      }

      // 2. Security Firewall: reject known forbidden destructive tool names
      if (FORBIDDEN_CAPABILITY_NAMES.has(cap.name.toLowerCase())) {
        console.warn(`[SecurityFirewall] Blocked forbidden capability: ${cap.name}`);
        continue;
      }

      const safety: SafetyClassification =
        cap.safety === "amber" ? "amber" : "green";

      safeCapabilities.push({
        name: cap.name,
        description: cap.description ?? `Discovered serial capability: ${cap.name}`,
        safety,
        readOnly: cap.readOnly ?? (safety === "green"),
        parameters: cap.parameters,
      });
    }

    return {
      id: descMsg.device.id,
      name: descMsg.device.name,
      firmwareVersion: descMsg.device.firmwareVersion,
      protocolVersion: descMsg.protocol,
      manufacturer: descMsg.device.manufacturer,
      model: descMsg.device.model,
      hardwareRevision: descMsg.device.hardwareRevision,
      transport: descMsg.device.transport ?? "Web Serial",
      presentationProfile: "generic_serial",
      capabilities: safeCapabilities,
      limits: descMsg.limits,
    };
  }
  public async disconnect(): Promise<void> {
    this._connected = false;

    // Fail any in-flight RPCs immediately
    for (const [id, rpc] of this.pendingRequests.entries()) {
      clearTimeout(rpc.timeoutId as unknown as number);
      if (rpc.abortCleanup) rpc.abortCleanup();
      rpc.reject(new Error("Device disconnected while request was pending"));
      this.pendingRequests.delete(id);
    }

    await this.transport.disconnect("User disconnected");
  }

  private async handleTransportDisconnected(reason: string): Promise<void> {
    if (!this._connected) return;
    this._connected = false;

    for (const [id, rpc] of this.pendingRequests.entries()) {
      clearTimeout(rpc.timeoutId as unknown as number);
      if (rpc.abortCleanup) rpc.abortCleanup();
      rpc.reject(new Error(`Device disconnected: ${reason}`));
      this.pendingRequests.delete(id);
    }

    this.emitEvent({
      type: "reset",
      timestamp: Date.now(),
      reason: "EXTERNAL_PIN",
      message: `Physical transport disconnected: ${reason}`,
    });

    if (this.onDisconnectCb) {
      this.onDisconnectCb(reason);
    }
  }

  private handleBootTextDetected(line: string): void {
    if (!this._connected) return;

    // Abort pending requests with DEVICE_RESET error
    for (const [id, rpc] of this.pendingRequests.entries()) {
      clearTimeout(rpc.timeoutId as unknown as number);
      if (rpc.abortCleanup) rpc.abortCleanup();
      rpc.resolve({
        ok: false,
        data: {},
        error: {
          code: "DEVICE_RESET",
          message: `Target device reset during '${rpc.capability}': ${line}`,
        },
      });
      this.pendingRequests.delete(id);
    }

    const reason: ResetReason = /BROWNOUT/i.test(line)
      ? "BROWNOUT"
      : /WDT/i.test(line)
      ? "WATCHDOG"
      : "POWER_ON";

    this.emitEvent({
      type: "reset",
      timestamp: Date.now(),
      reason,
      message: `ESP32 bootloader activity detected: ${line}`,
    });

    if (this.onResetDetectedCb) {
      this.onResetDetectedCb(line);
    }

    // Trigger non-blocking re-handshake to restore device state
    void this.rehandshakeAfterReset();
  }

  private async rehandshakeAfterReset(): Promise<void> {
    try {
      const hello = JSON.stringify({ type: "hello", protocol: PROTOCOL_VERSION }) + "\n";
      await this.transport.write(hello);
    } catch (err) {
      console.warn("[SerialDeviceAdapter] Failed to send re-handshake hello:", err);
    }
  }

  private handleProtocolMessage(msg: ProtocolMessage): void {
    switch (msg.type) {
      case "response":
        this.handleResponse(msg);
        break;
      case "event":
        this.handleEvent(msg);
        break;
      case "telemetry":
        this.handleTelemetry(msg);
        break;
      case "descriptor":
        // Device re-announced itself after reset
        if (this._connected) {
          this.rawDescriptor = msg;
          this.descriptor = this.convertDescriptor(msg);
          if (this.onDescriptorUpdatedCb) {
            this.onDescriptorUpdatedCb(this.descriptor);
          }
        }
        break;
      default:
        break;
    }
  }

  private handleResponse(msg: ResponseMessage): void {
    const pending = this.pendingRequests.get(msg.id);
    if (!pending) {
      return;
    }

    clearTimeout(pending.timeoutId as unknown as number);
    if (pending.abortCleanup) pending.abortCleanup();
    this.pendingRequests.delete(msg.id);

    if (msg.ok) {
      pending.resolve({
        ok: true,
        data: (msg.result ?? {}) as Record<string, unknown>,
      });
    } else if (msg.error.code === "ABORTED") {
      pending.reject(
        new Error(`Operation '${pending.capability}' cancelled by host AbortSignal`)
      );
    } else {
      pending.resolve({
        ok: false,
        data: {},
        error: {
          code: msg.error.code,
          message: msg.error.message,
        },
      });
    }
  }

  private handleEvent(msg: EventMessage): void {
    const timestamp = msg.timestamp ?? Date.now();

    if (msg.event === "relay_state") {
      const state = msg.state === "closed" ? "closed" : "open";
      const pin = typeof msg.pin === "number" ? msg.pin : 4;
      this.emitEvent({
        type: "relay_state",
        timestamp,
        state,
        pin,
      });
    } else if (msg.event === "reset") {
      const rawReason = String(msg.reason ?? "SOFTWARE");
      const reason: ResetReason =
        rawReason === "BROWNOUT" ||
        rawReason === "WATCHDOG" ||
        rawReason === "POWER_ON" ||
        rawReason === "EXTERNAL_PIN"
          ? rawReason
          : "SOFTWARE";

      this.emitEvent({
        type: "reset",
        timestamp,
        reason,
        message: typeof msg.message === "string" ? msg.message : undefined,
      });
    } else if (msg.event === "voltage_sample") {
      this.emitEvent({
        type: "voltage_sample",
        timestamp,
        voltage: typeof msg.voltage === "number" ? msg.voltage : 3.3,
        unit: "V",
      });
    } else if (msg.event === "sensor_reading") {
      this.emitEvent({
        type: "sensor_reading",
        timestamp,
        sensor: typeof msg.sensor === "string" ? msg.sensor : "sensor",
        value: typeof msg.value === "number" ? msg.value : 0,
        unit: typeof msg.unit === "string" ? msg.unit : "",
      });
    }
  }

  private handleTelemetry(msg: TelemetryMessage): void {
    // 1. Emit native chunk event for ExperimentRunner
    this.emitEvent({
      type: "telemetry_chunk",
      channel: msg.channel,
      t0_ms: msg.t0_ms,
      dt_ms: msg.dt_ms,
      samples: msg.samples,
    });

    // 2. For supply_voltage, also emit discrete voltage_sample events
    // so continuous oscilloscope ring buffers render at 60fps
    if (msg.channel === "supply_voltage") {
      let t = msg.t0_ms;
      for (const sample of msg.samples) {
        this.emitEvent({
          type: "voltage_sample",
          timestamp: t,
          voltage: sample,
          unit: "V",
        });
        t += msg.dt_ms;
      }
    }
  }

  private emitEvent(event: DeviceEvent): void {
    for (const listener of this.eventSubscribers) {
      try {
        listener(event);
      } catch (err) {
        console.error("[SerialDeviceAdapter] Event listener error:", err);
      }
    }
  }

  public async executeCapability<T = Record<string, unknown>>(
    name: string,
    params?: Record<string, unknown>,
    signal?: AbortSignal
  ): Promise<CapabilityResult<T>> {
    if (!this.isConnected()) {
      throw new Error("Cannot execute capability: Device is not connected");
    }

    if (signal?.aborted) {
      throw new Error(`Capability '${name}' aborted prior to execution`);
    }

    // Security Firewall: double check for red or forbidden tools
    if (FORBIDDEN_CAPABILITY_NAMES.has(name.toLowerCase())) {
      return {
        ok: false,
        data: {} as T,
        error: {
          code: "SECURITY_VIOLATION",
          message: `Prohibited capability '${name}' is blocked by device safety firewall`,
        },
      };
    }

    // Verify capability reported by descriptor
    const descriptor = this.getDescriptor();
    const cap = descriptor.capabilities.find((c) => c.name === name);
    if (!cap) {
      return {
        ok: false,
        data: {} as T,
        error: {
          code: "UNKNOWN_CAPABILITY",
          message: `Capability '${name}' is not supported by connected hardware descriptor`,
        },
      };
    }

    const id = `cmd_${Date.now()}_${++this.rpcCounter}`;
    const { promise, resolve, reject } = Promise.withResolvers<CapabilityResult<T>>();

    const extraDuration =
      params && typeof params.duration_ms === "number"
        ? params.duration_ms
        : params && typeof params.durationMs === "number"
        ? params.durationMs
        : 0;
    const timeoutMs = this.defaultRequestTimeoutMs + extraDuration;

    let abortCleanup: (() => void) | undefined;
    let timeoutId: TimeoutHandle | undefined;

    if (signal) {
      const onAbort = () => {
        if (timeoutId) clearTimeout(timeoutId as unknown as number);
        this.pendingRequests.delete(id);
        if (abortCleanup) abortCleanup();

        if (this.transport.connected) {
          const cancelMsg = JSON.stringify({ type: "cancel", id }) + "\n";
          void this.transport.write(cancelMsg).catch(() => undefined);
        }

        reject(new Error(`Operation '${name}' cancelled by host AbortSignal`));
      };

      signal.addEventListener("abort", onAbort, { once: true });
      abortCleanup = () => signal.removeEventListener("abort", onAbort);
    }

    timeoutId = setTimeout(() => {
      if (abortCleanup) abortCleanup();
      this.pendingRequests.delete(id);
      resolve({
        ok: false,
        data: {} as T,
        error: {
          code: "TIMEOUT",
          message: `Capability execution '${name}' timed out after ${timeoutMs}ms`,
        },
      });
    }, timeoutMs);

    this.pendingRequests.set(id, {
      capability: name,
      resolve: resolve as (res: CapabilityResult<unknown>) => void,
      reject,
      timeoutId,
      abortCleanup,
    });

    const requestPayload =
      JSON.stringify({
        type: "request",
        id,
        capability: name,
        params: params ?? {},
      }) + "\n";

    try {
      await this.transport.write(requestPayload);
    } catch (err) {
      clearTimeout(timeoutId as unknown as number);
      if (abortCleanup) abortCleanup();
      this.pendingRequests.delete(id);
      return {
        ok: false,
        data: {} as T,
        error: {
          code: "WRITE_ERROR",
          message: `Failed to transmit request for '${name}': ${err instanceof Error ? err.message : String(err)}`,
        },
      };
    }

    const result = await promise;
    if (
      result.ok &&
      name === "measure_supply_voltage" &&
      result.data &&
      typeof (result.data as Record<string, unknown>).voltage === "number"
    ) {
      this.emitEvent({
        type: "voltage_sample",
        timestamp: Date.now(),
        voltage: (result.data as Record<string, unknown>).voltage as number,
        unit: "V",
      });
    }

    return result;
  }

  public subscribe(listener: (event: DeviceEvent) => void): () => void {
    this.eventSubscribers.add(listener);
    return () => this.eventSubscribers.delete(listener);
  }
}
