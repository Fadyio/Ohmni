import { describe, it, expect, beforeEach } from "bun:test";
import { VirtualDeviceAdapter } from "@/domain/device/virtual-adapter";
import type { DeviceEvent, ResetEvent, VoltageSampleEvent } from "@/domain/device/events";

interface DeviceInfoData {
  chip: string;
  firmwareVersion: string;
  relayPowerSource: string;
  nominalVoltage: number;
  relayState: string;
}

interface VoltageData {
  voltage: number;
  unit: string;
  nominal: number;
  status: string;
}

interface ResetHistoryData {
  resets: Array<{ timestamp: number; reason: string; message?: string }>;
  count: number;
}

interface RelayStressTestData {
  success: boolean;
  faultReproduced: boolean;
  resetOccurred: boolean;
  resetReason?: string;
  minVoltage: number;
  baselineVoltage: number;
  cyclesCompleted: number;
  message: string;
}

describe("VirtualDeviceAdapter - Domain Foundation & Deterministic Physics", () => {
  let adapter: VirtualDeviceAdapter;

  beforeEach(() => {
    adapter = new VirtualDeviceAdapter();
  });

  describe("Lifecycle & Descriptor", () => {
    it("starts disconnected and connects successfully", async () => {
      expect(adapter.isConnected()).toBe(false);
      await adapter.connect();
      expect(adapter.isConnected()).toBe(true);

      const descriptor = adapter.getDescriptor();
      expect(descriptor.id).toBe("virtual-esp32s3-env");
      expect(descriptor.name).toBe("ESP32-S3 Environmental Controller (Virtual)");
      expect(descriptor.protocolVersion).toBe(1);
      expect(descriptor.capabilities.map((c) => c.name)).toEqual([
        "read_device_info",
        "read_reset_history",
        "read_system_health",
        "measure_supply_voltage",
        "run_relay_stress_test",
      ]);

      await adapter.disconnect();
      expect(adapter.isConnected()).toBe(false);
    });

    it("throws when executing capabilities while disconnected", async () => {
      expect(() => adapter.executeCapability("read_device_info")).toThrow(
        /not connected/i
      );
    });
  });

  describe("Observational Capabilities (Green)", () => {
    beforeEach(async () => {
      await adapter.connect();
    });

    it("reads device info", async () => {
      const result = await adapter.executeCapability<DeviceInfoData>("read_device_info");
      expect(result.ok).toBe(true);
      expect(result.data.chip).toBe("ESP32-S3");
      expect(result.data.firmwareVersion).toBe("1.0.0");
      expect(result.data.relayPowerSource).toBe("3v3");
    });

    it("measures baseline supply voltage at nominal ~3.3V", async () => {
      const result = await adapter.executeCapability<VoltageData>("measure_supply_voltage");
      expect(result.ok).toBe(true);
      expect(result.data.voltage).toBeGreaterThanOrEqual(3.28);
      expect(result.data.voltage).toBeLessThanOrEqual(3.34);
      expect(result.data.unit).toBe("V");
    });

    it("reads system health metrics", async () => {
      const result = await adapter.executeCapability<{
        freeHeapBytes: number;
        cpuTemperatureC: number;
        i2cBusStatus: string;
      }>("read_system_health");
      expect(result.ok).toBe(true);
      expect(result.data.freeHeapBytes).toBeGreaterThan(100_000);
      expect(result.data.cpuTemperatureC).toBeGreaterThan(20);
      expect(result.data.i2cBusStatus).toBe("ok");
    });
    it("reads initial reset history containing initial power-on reset", async () => {
      const result = await adapter.executeCapability<ResetHistoryData>("read_reset_history");
      expect(result.ok).toBe(true);
      expect(Array.isArray(result.data.resets)).toBe(true);
      expect(result.data.resets.length).toBeGreaterThanOrEqual(1);
      expect(result.data.resets[0].reason).toBe("POWER_ON");
    });
  });

  describe("Deterministic Brownout Physics (Milestone 1 Core Invariant)", () => {
    beforeEach(async () => {
      await adapter.connect();
    });

    it("reproduces supply sag and brownout reset when relay_power is 3v3", async () => {
      // Default state: relay_power = 3v3
      const events: DeviceEvent[] = [];
      const unsubscribe = adapter.subscribe((e) => events.push(e));

      const result = await adapter.executeCapability<RelayStressTestData>(
        "run_relay_stress_test",
        { cycles: 3, durationMs: 50 }
      );

      unsubscribe();

      // In 3v3 mode, relay inrush current pulls 3.3V rail down below 2.80V brownout threshold
      expect(result.ok).toBe(false);
      expect(result.data.resetOccurred).toBe(true);
      expect(result.data.resetReason).toBe("BROWNOUT");
      expect(result.data.minVoltage).toBeLessThan(2.80);
      expect(result.data.faultReproduced).toBe(true);

      // Verify telemetry event stream contains voltage sags and brownout reset
      const voltageSamples: VoltageSampleEvent[] = events.filter(
        (e): e is VoltageSampleEvent => e.type === "voltage_sample"
      );
      expect(voltageSamples.length).toBeGreaterThan(0);
      const minSample = Math.min(...voltageSamples.map((e) => e.voltage));
      expect(minSample).toBeLessThan(2.80);

      const resetEvents: ResetEvent[] = events.filter(
        (e): e is ResetEvent => e.type === "reset"
      );
      expect(resetEvents.length).toBeGreaterThanOrEqual(1);
      expect(resetEvents.some((r) => r.reason === "BROWNOUT")).toBe(true);

      // Verify reset history now includes the BROWNOUT reset event
      const historyResult = await adapter.executeCapability<ResetHistoryData>("read_reset_history");
      expect(historyResult.ok).toBe(true);
      const latestReset = historyResult.data.resets[historyResult.data.resets.length - 1];
      expect(latestReset.reason).toBe("BROWNOUT");
    });

    it("maintains stable supply and passes relay stress test when relay_power is 5v", async () => {
      // Configure intervention point to 5V (isolated from 3.3V MCU rail)
      adapter.setInterventionPoint("relay_power_jumper", "5v");

      const events: DeviceEvent[] = [];
      const unsubscribe = adapter.subscribe((e) => events.push(e));

      const result = await adapter.executeCapability<RelayStressTestData>(
        "run_relay_stress_test",
        { cycles: 3, durationMs: 50 }
      );

      unsubscribe();

      // In 5v mode, 3.3V rail remains stable (> 3.10V) and no brownout occurs
      expect(result.ok).toBe(true);
      expect(result.data.resetOccurred).toBe(false);
      expect(result.data.minVoltage).toBeGreaterThanOrEqual(3.10);
      expect(result.data.cyclesCompleted).toBe(3);
      expect(result.data.faultReproduced).toBe(false);

      // Verify no reset events were emitted
      const resetEvents = events.filter((e) => e.type === "reset");
      expect(resetEvents.length).toBe(0);

      // Verify all voltage samples remained well above brownout threshold (2.80V)
      const voltageSamples: VoltageSampleEvent[] = events.filter(
        (e): e is VoltageSampleEvent => e.type === "voltage_sample"
      );
      expect(voltageSamples.length).toBeGreaterThan(0);
      for (const sample of voltageSamples) {
        expect(sample.voltage).toBeGreaterThanOrEqual(3.10);
      }
    });

    it("empirically demonstrates before/after comparison when jumper position is changed", async () => {
      // 1. Initial state (3v3): Run test -> Fails with brownout
      adapter.setInterventionPoint("relay_power_jumper", "3v3");
      const beforeResult = await adapter.executeCapability<RelayStressTestData>(
        "run_relay_stress_test",
        { cycles: 1, durationMs: 40 }
      );
      expect(beforeResult.data.resetOccurred).toBe(true);
      expect(beforeResult.data.minVoltage).toBeLessThan(2.80);

      // 2. Physical intervention: Move jumper to 5v
      adapter.setInterventionPoint("relay_power_jumper", "5v");

      // 3. Rerun identical experiment (5v): Passes with stable rail
      const afterResult = await adapter.executeCapability<RelayStressTestData>(
        "run_relay_stress_test",
        { cycles: 1, durationMs: 40 }
      );
      expect(afterResult.data.resetOccurred).toBe(false);
      expect(afterResult.data.minVoltage).toBeGreaterThanOrEqual(3.10);
    });
  });

  describe("Safety & AbortSignal Support", () => {
    beforeEach(async () => {
      await adapter.connect();
    });

    it("aborts capability execution when AbortSignal is already aborted and leaves relay open", async () => {
      const controller = new AbortController();
      controller.abort();

      const promise = adapter.executeCapability(
        "run_relay_stress_test",
        { cycles: 10, durationMs: 100 },
        controller.signal
      );

      await expect(promise).rejects.toThrow(/aborted/i);
      expect(adapter.getRelayState()).toBe("open");
    });
  });
});
