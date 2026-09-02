/**
 * Pure TypeScript deterministic simulation of the ESP32-S3 Environmental Controller.
 * Implements DeviceAdapter and models electrical dynamics and brownout conditions.
 */

import type { DeviceAdapter, CapabilityResult } from "./adapter";
import type { DeviceDescriptor, DeviceCapability } from "./descriptor";
import type { DeviceEvent, ResetReason, ResetEvent } from "./events";

export type RelayPowerSource = "3v3" | "5v";

export interface VirtualDeviceConfig {
  readonly initialRelayPower?: RelayPowerSource;
  readonly nominalVoltage?: number;
  readonly brownoutThreshold?: number;
}

export class VirtualDeviceAdapter implements DeviceAdapter {
  private connected = false;
  private relayPowerSource: RelayPowerSource = "3v3";
  private relayState: "open" | "closed" = "open";
  private interventionPoints: Map<string, string> = new Map();
  private subscribers: Set<(event: DeviceEvent) => void> = new Set();
  private resetHistory: Array<{
    readonly timestamp: number;
    readonly reason: ResetReason;
    readonly message?: string;
  }> = [];

  private readonly nominalVoltage: number;
  private readonly brownoutThreshold: number;

  constructor(config: VirtualDeviceConfig = {}) {
    this.relayPowerSource = config.initialRelayPower ?? "3v3";
    this.interventionPoints.set(
      "relay_power_jumper",
      this.relayPowerSource
    );
    this.nominalVoltage = config.nominalVoltage ?? 3.30;
    this.brownoutThreshold = config.brownoutThreshold ?? 2.80;

    // Initial power-on reset
    this.resetHistory.push({
      timestamp: Date.now() - 60_000,
      reason: "POWER_ON",
      message: "Initial system cold boot",
    });
  }

  public async connect(): Promise<void> {
    this.connected = true;
  }

  public async disconnect(): Promise<void> {
    this.relayState = "open";
    this.connected = false;
  }

  public isConnected(): boolean {
    return this.connected;
  }

  public getDescriptor(): DeviceDescriptor {
    const capabilities: DeviceCapability[] = [
      {
        name: "read_device_info",
        description: "Read hardware identifiers, chip model, and firmware version.",
        safety: "green",
        readOnly: true,
      },
      {
        name: "read_reset_history",
        description: "Retrieve chronological log of system reset events and causes.",
        safety: "green",
        readOnly: true,
      },
      {
        name: "read_system_health",
        description: "Read system metrics including free heap, CPU temperature, and uptime.",
        safety: "green",
        readOnly: true,
      },
      {
        name: "measure_supply_voltage",
        description: "Sample instantaneous voltage on the primary 3.3V rail.",
        safety: "green",
        readOnly: true,
      },
      {
        name: "run_relay_stress_test",
        description: "Cycle the onboard relay to test power supply stability under inrush load.",
        safety: "amber",
        readOnly: false,
        parameters: {
          type: "object",
          properties: {
            cycles: { type: "integer", minimum: 1, maximum: 10, default: 3 },
            durationMs: { type: "integer", minimum: 10, maximum: 500, default: 50 },
          },
        },
      },
    ];

    return {
      id: "virtual-esp32s3-env",
      name: "ESP32-S3 Environmental Controller (Virtual)",
      firmwareVersion: "1.0.0",
      protocolVersion: 1,
      capabilities,
      limits: {
        maxCycles: 10,
        maxDurationMs: 500,
      },
    };
  }

  public subscribe(listener: (event: DeviceEvent) => void): () => void {
    this.subscribers.add(listener);
    return () => {
      this.subscribers.delete(listener);
    };
  }

  private emit(event: DeviceEvent): void {
    for (const subscriber of this.subscribers) {
      subscriber(event);
    }
  }

  public setInterventionPoint(point: string, value: string): void {
    this.interventionPoints.set(point, value);
    if (point === "relay_power_jumper") {
      if (value === "3v3" || value === "5v") {
        this.relayPowerSource = value;
      }
    }
  }

  public getInterventionPoint(point: string): string | undefined {
    return this.interventionPoints.get(point);
  }

  public getRelayState(): "open" | "closed" {
    return this.relayState;
  }

  public async executeCapability<T = Record<string, unknown>>(
    name: string,
    params: Record<string, unknown> = {},
    signal?: AbortSignal
  ): Promise<CapabilityResult<T>> {
    if (!this.connected) {
      throw new Error("Device is not connected");
    }

    if (signal?.aborted) {
      throw new Error("Capability execution aborted");
    }

    switch (name) {
      case "read_device_info":
        return this.handleReadDeviceInfo() as Promise<CapabilityResult<T>>;
      case "read_reset_history":
        return this.handleReadResetHistory() as Promise<CapabilityResult<T>>;
      case "read_system_health":
        return this.handleReadSystemHealth() as Promise<CapabilityResult<T>>;
      case "measure_supply_voltage":
        return this.handleMeasureSupplyVoltage() as Promise<CapabilityResult<T>>;
      case "run_relay_stress_test":
        return this.handleRunRelayStressTest(params, signal) as Promise<CapabilityResult<T>>;
      default:
        throw new Error(`Unknown capability: ${name}`);
    }
  }

  private async handleReadDeviceInfo(): Promise<CapabilityResult> {
    return {
      ok: true,
      data: {
        chip: "ESP32-S3",
        firmwareVersion: "1.0.0",
        relayPowerSource: this.relayPowerSource,
        nominalVoltage: this.nominalVoltage,
        relayState: this.relayState,
      },
    };
  }

  private async handleReadResetHistory(): Promise<CapabilityResult> {
    return {
      ok: true,
      data: {
        resets: [...this.resetHistory],
        count: this.resetHistory.length,
      },
    };
  }
  private async handleReadSystemHealth(): Promise<CapabilityResult> {
    return {
      ok: true,
      data: {
        freeHeapBytes: 245760,
        totalHeapBytes: 327680,
        cpuTemperatureC: 38.5,
        uptimeMs: 124500,
        i2cBusStatus: "ok",
        taskWatchdogStatus: "ok",
      },
    };
  }


  private async handleMeasureSupplyVoltage(): Promise<CapabilityResult> {
    const voltage = this.relayState === "closed"
      ? (this.relayPowerSource === "3v3" ? 2.74 : 3.18)
      : 3.31;

    this.emit({
      type: "voltage_sample",
      timestamp: Date.now(),
      voltage,
      unit: "V",
    });

    return {
      ok: true,
      data: {
        voltage,
        unit: "V",
        nominal: this.nominalVoltage,
        status: voltage >= this.brownoutThreshold ? "normal" : "brownout",
      },
    };
  }

  private async delay(ms: number, signal?: AbortSignal): Promise<void> {
    if (ms <= 0) return;
    if (signal?.aborted) {
      throw new Error("Capability execution aborted");
    }
    const { promise, resolve, reject } = Promise.withResolvers<void>();
    const timer = setTimeout(() => {
      cleanup();
      resolve();
    }, ms);
    const onAbort = () => {
      cleanup();
      reject(new Error("Capability execution aborted"));
    };
    const cleanup = () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
    };
    signal?.addEventListener("abort", onAbort);
    return promise;
  }

  private async handleRunRelayStressTest(
    params: Record<string, unknown>,
    signal?: AbortSignal
  ): Promise<CapabilityResult> {
    const cycles = typeof params.cycles === "number" ? params.cycles : 3;
    const durationMs = typeof params.durationMs === "number" ? params.durationMs : 0;
    const now = Date.now();
    let minVoltage = this.nominalVoltage;
    let resetOccurred = false;
    let cyclesCompleted = 0;

    // Emit baseline voltage before actuation
    this.emit({
      type: "voltage_sample",
      timestamp: now,
      voltage: 3.31,
      unit: "V",
    });

    try {
      for (let i = 0; i < cycles; i++) {
        if (signal?.aborted) {
          throw new Error("Capability execution aborted");
        }

        // Close relay (energize coil)
        this.relayState = "closed";
        this.emit({
          type: "relay_state",
          timestamp: Date.now(),
          state: "closed",
          pin: 14,
        });

        if (durationMs > 0) {
          await this.delay(durationMs, signal);
        }

        if (this.relayPowerSource === "3v3") {
          // Deterministic Physics: Relay inrush current from 3.3V rail pulls voltage down to 2.72V
          const sagVoltage = 2.72;
          minVoltage = Math.min(minVoltage, sagVoltage);

          this.emit({
            type: "voltage_sample",
            timestamp: Date.now(),
            voltage: sagVoltage,
            unit: "V",
          });

          // Brownout reset triggered
          resetOccurred = true;
          this.relayState = "open";

          const resetEvent: ResetEvent = {
            type: "reset",
            timestamp: Date.now(),
            reason: "BROWNOUT",
            message: `Supply voltage sagged to ${sagVoltage.toFixed(2)}V (< ${this.brownoutThreshold.toFixed(2)}V threshold)`,
          };

          this.resetHistory.push({
            timestamp: resetEvent.timestamp,
            reason: resetEvent.reason,
            message: resetEvent.message,
          });

          this.emit(resetEvent);
          this.emit({
            type: "relay_state",
            timestamp: Date.now(),
            state: "open",
            pin: 14,
          });

          // Halt stress test immediately due to MCU reset
          break;
        } else {
          // Deterministic Physics: Relay powered from isolated 5V rail; 3.3V rail stays stable at ~3.18V
          const loadedVoltage = 3.18;
          minVoltage = Math.min(minVoltage, loadedVoltage);

          this.emit({
            type: "voltage_sample",
            timestamp: Date.now(),
            voltage: loadedVoltage,
            unit: "V",
          });

          // Open relay after cycle
          this.relayState = "open";
          this.emit({
            type: "relay_state",
            timestamp: Date.now(),
            state: "open",
            pin: 14,
          });

          cyclesCompleted++;
        }
      }
    } catch (err) {
      // Ensure relay is left in safe/open state on abort or error
      this.relayState = "open";
      this.emit({
        type: "relay_state",
        timestamp: Date.now(),
        state: "open",
        pin: 14,
      });
      throw err;
    }

    if (resetOccurred) {
      return {
        ok: false,
        data: {
          success: false,
          faultReproduced: true,
          resetOccurred: true,
          resetReason: "BROWNOUT",
          minVoltage,
          baselineVoltage: 3.31,
          cyclesCompleted,
          message: "Brownout reset triggered during relay actuation on 3.3V rail.",
        },
      };
    }

    return {
      ok: true,
      data: {
        success: true,
        faultReproduced: false,
        resetOccurred: false,
        minVoltage,
        baselineVoltage: 3.31,
        cyclesCompleted,
        message: "Relay stress test completed with stable supply rail.",
      },
    };
  }
}
