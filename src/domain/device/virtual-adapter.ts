/**
 * Pure TypeScript deterministic simulation of the ESP32-S3 Environmental Controller.
 * Implements DeviceAdapter and models electrical dynamics, brownout conditions,
 * I2C bus address decoding, and physical line continuity faults.
 */

import type { DeviceAdapter, CapabilityResult } from "./adapter";
import type { DeviceDescriptor, DeviceCapability } from "./descriptor";
import type { DeviceEvent, ResetReason, ResetEvent } from "./events";

export type RelayPowerSource = "3v3" | "5v";

export interface VirtualDeviceConfig {
  readonly initialRelayPower?: RelayPowerSource;
  readonly nominalVoltage?: number;
  readonly brownoutThreshold?: number;
  readonly initialSensorAddress?: "0x76" | "0x77";
  readonly firmwareTargetAddress?: "0x76" | "0x77";
  readonly initialSdaConnected?: boolean;
}

export class VirtualDeviceAdapter implements DeviceAdapter {
  private connected = false;
  private relayPowerSource: RelayPowerSource = "3v3";
  private relayState: "open" | "closed" = "open";
  private sensorAddress: "0x76" | "0x77" = "0x76";
  private firmwareTargetAddress: "0x76" | "0x77" = "0x76";
  private sdaConnected = true;
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
    this.sensorAddress = config.initialSensorAddress ?? "0x76";
    this.firmwareTargetAddress = config.firmwareTargetAddress ?? "0x76";
    this.sdaConnected = config.initialSdaConnected ?? true;

    this.interventionPoints.set("relay_power_jumper", this.relayPowerSource);
    this.interventionPoints.set("sensor_address_selector", this.sensorAddress);
    this.interventionPoints.set("sda_connection", this.sdaConnected ? "connected" : "unseated");

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
        name: "scan_i2c_bus",
        description: "Probe the active I²C bus for responding 7-bit addresses. Returns observed ACK addresses only.",
        safety: "green",
        readOnly: true,
      },
      {
        name: "read_sensor_status",
        description: "Query firmware environmental sensor status register. Returns configured target address and last transaction outcome.",
        safety: "green",
        readOnly: true,
      },
      {
        name: "read_i2c_line_state",
        description: "Sample electrical logic levels on I²C clock (SCL) and data (SDA) lines.",
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

  public subscriberCount(): number {
    return this.subscribers.size;
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
    } else if (point === "sensor_address_selector") {
      if (value === "0x76" || value === "0x77") {
        this.sensorAddress = value;
      }
    } else if (point === "sda_connection") {
      this.sdaConnected = value === "connected";
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
      case "scan_i2c_bus":
        return this.handleScanI2cBus() as Promise<CapabilityResult<T>>;
      case "read_sensor_status":
        return this.handleReadSensorStatus() as Promise<CapabilityResult<T>>;
      case "read_i2c_line_state":
        return this.handleReadI2cLineState() as Promise<CapabilityResult<T>>;
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
        i2cBusStatus: this.sdaConnected ? "ok" : "degraded",
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

  private async handleScanI2cBus(): Promise<CapabilityResult> {
    // If SDA is unseated/open, bus scan cannot receive ACKs from any peripheral
    if (!this.sdaConnected) {
      return {
        ok: true,
        data: {
          devices: [],
          count: 0,
          busStatus: "NO_RESPONSE",
          message: "I2C bus scan completed: 0 responding devices detected.",
        },
      };
    }

    // When SDA is connected, device responds at its physically configured address
    return {
      ok: true,
      data: {
        devices: [this.sensorAddress],
        count: 1,
        busStatus: "ACTIVE",
        message: `I2C bus scan completed: 1 responding device detected at ${this.sensorAddress}.`,
      },
    };
  }

  private async handleReadSensorStatus(): Promise<CapabilityResult> {
    if (!this.sdaConnected) {
      return {
        ok: true,
        data: {
          configuredTargetAddress: this.firmwareTargetAddress,
          transactionStatus: "BUS_ERROR",
          temperatureC: null,
          humidityPct: null,
          message: "I2C communication error: SDA line floating / no ACK received.",
        },
      };
    }

    if (this.sensorAddress !== this.firmwareTargetAddress) {
      return {
        ok: true,
        data: {
          configuredTargetAddress: this.firmwareTargetAddress,
          transactionStatus: "NACK",
          temperatureC: null,
          humidityPct: null,
          message: `Sensor transaction failed: device at address ${this.firmwareTargetAddress} did not acknowledge (NACK).`,
        },
      };
    }

    return {
      ok: true,
      data: {
        configuredTargetAddress: this.firmwareTargetAddress,
        transactionStatus: "ACK",
        temperatureC: 24.2,
        humidityPct: 48.5,
        message: "Environmental sensor transaction succeeded: valid temperature & humidity reading returned.",
      },
    };
  }

  private async handleReadI2cLineState(): Promise<CapabilityResult> {
    return {
      ok: true,
      data: {
        scl: "HIGH",
        sda: this.sdaConnected ? "HIGH" : "FLOATING",
        pullupVoltage: 3.30,
        busReady: this.sdaConnected,
        message: this.sdaConnected
          ? "I2C bus idle lines nominal (SCL=HIGH, SDA=HIGH, 3.30V pullup)."
          : "I2C bus line abnormal (SCL=HIGH, SDA=FLOATING / high-impedance).",
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
    const cycles = typeof params.cycles === "number" ? Math.min(Math.max(1, params.cycles), 10) : 3;
    const durationMs = typeof params.durationMs === "number" ? Math.min(Math.max(0, params.durationMs), 500) : 0;
    const startTime = Date.now();
    let minVoltage = this.nominalVoltage;
    let resetOccurred = false;
    let cyclesCompleted = 0;

    // 1. High-Fidelity Pre-Trigger Phase (10 deterministic samples around 3.31V)
    const preTriggerVoltages = [
      3.310, 3.312, 3.308, 3.311, 3.309,
      3.312, 3.308, 3.310, 3.311, 3.310
    ];
    for (let i = 0; i < preTriggerVoltages.length; i++) {
      if (signal?.aborted) throw new Error("Capability execution aborted");
      this.emit({
        type: "voltage_sample",
        timestamp: startTime + i * 2,
        voltage: preTriggerVoltages[i],
        unit: "V",
      });
    }

    try {
      for (let cycle = 0; cycle < cycles; cycle++) {
        if (signal?.aborted) {
          throw new Error("Capability execution aborted");
        }

        // Close relay (energize coil)
        this.relayState = "closed";
        const cycleStartTime = Date.now();
        this.emit({
          type: "relay_state",
          timestamp: cycleStartTime,
          state: "closed",
          pin: 14,
        });

        if (this.relayPowerSource === "3v3") {
          // Deterministic Physics: Relay inrush current from 3.3V rail pulls voltage down to 2.72V
          const sagCurve = [
            3.305, 3.290, 3.265, 3.220, 3.160,
            3.090, 3.010, 2.930, 2.855, 2.810,
            2.780, 2.750, 2.730, 2.720, 2.720
          ];

          const stepDelay = durationMs > 0 ? (durationMs * 0.4) / sagCurve.length : 0;
          for (let s = 0; s < sagCurve.length; s++) {
            if (signal?.aborted) throw new Error("Capability execution aborted");
            const sampleVoltage = sagCurve[s];
            minVoltage = Math.min(minVoltage, sampleVoltage);
            this.emit({
              type: "voltage_sample",
              timestamp: Date.now(),
              voltage: sampleVoltage,
              unit: "V",
            });
            if (stepDelay > 0) {
              await this.delay(stepDelay, signal);
            }
          }

          // Brownout reset triggered once threshold crossed
          resetOccurred = true;
          this.relayState = "open";

          const resetEvent: ResetEvent = {
            type: "reset",
            timestamp: Date.now(),
            reason: "BROWNOUT",
            message: `Supply voltage sagged to ${minVoltage.toFixed(2)}V (< ${this.brownoutThreshold.toFixed(2)}V threshold)`,
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

          // Post-reset recovery bounce curve (15 deterministic samples back to 3.31V)
          const recoveryCurve = [
            2.740, 2.810, 2.920, 3.050, 3.160,
            3.240, 3.285, 3.305, 3.310, 3.312,
            3.308, 3.310, 3.311, 3.310, 3.310
          ];
          const recoveryStepDelay = durationMs > 0 ? (durationMs * 0.4) / recoveryCurve.length : 0;
          for (let r = 0; r < recoveryCurve.length; r++) {
            if (signal?.aborted) throw new Error("Capability execution aborted");
            this.emit({
              type: "voltage_sample",
              timestamp: Date.now(),
              voltage: recoveryCurve[r],
              unit: "V",
            });
            if (recoveryStepDelay > 0) {
              await this.delay(recoveryStepDelay, signal);
            }
          }

          // Halt stress test immediately due to MCU reset
          break;
        } else {
          // Deterministic Physics: Relay powered from isolated 5V rail; 3.3V rail stays stable at ~3.18V
          const loadedCurve = [
            3.295, 3.270, 3.240, 3.210, 3.190,
            3.180, 3.180, 3.185, 3.200, 3.230,
            3.265, 3.290, 3.305, 3.310, 3.310
          ];

          const stepDelay = durationMs > 0 ? durationMs / loadedCurve.length : 0;
          for (let s = 0; s < loadedCurve.length; s++) {
            if (signal?.aborted) throw new Error("Capability execution aborted");
            const sampleVoltage = loadedCurve[s];
            minVoltage = Math.min(minVoltage, sampleVoltage);
            this.emit({
              type: "voltage_sample",
              timestamp: Date.now(),
              voltage: sampleVoltage,
              unit: "V",
            });
            if (stepDelay > 0) {
              await this.delay(stepDelay, signal);
            }
          }

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
