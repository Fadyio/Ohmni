/**
 * PERMANENT GOLDEN-PATH REGRESSION TEST
 *
 * Core invariant: Physical repair changes measurable device behavior.
 * This test uses strictly public/domain APIs to prove that moving the
 * physical relay power jumper from 3.3V to 5V converts a failing
 * brownout stress test into a passing test with stable supply voltage.
 *
 * This test is PERMANENT and must pass for every future milestone.
 */

import { describe, it, expect, beforeEach } from "bun:test";
import { VirtualDeviceAdapter } from "@/domain/device/virtual-adapter";
import type { DeviceEvent, ResetEvent, VoltageSampleEvent } from "@/domain/device/events";

interface StressTestResult {
  success: boolean;
  faultReproduced: boolean;
  resetOccurred: boolean;
  resetReason?: string;
  minVoltage: number;
  baselineVoltage: number;
  cyclesCompleted: number;
  message: string;
}

interface ResetHistoryResult {
  resets: Array<{ timestamp: number; reason: string; message?: string }>;
  count: number;
}

describe("Golden Path — Empirical Diagnostic & Verification Loop", () => {
  let adapter: VirtualDeviceAdapter;

  beforeEach(() => {
    adapter = new VirtualDeviceAdapter();
  });

  it("golden path: identical relay test fails before jumper repair and passes after repair", async () => {
    await adapter.connect();

    // -------------------------------------------------------------------------
    // STEP 1: Initial Fault State (Jumper at 3V3)
    // -------------------------------------------------------------------------
    adapter.setInterventionPoint("relay_power_jumper", "3v3");

    const beforeEvents: DeviceEvent[] = [];
    const unsubscribeBefore = adapter.subscribe((e) => beforeEvents.push(e));

    // Identical stress experiment parameters
    const experimentParams = { cycles: 3, durationMs: 50 };

    const beforeResult = await adapter.executeCapability<StressTestResult>(
      "run_relay_stress_test",
      experimentParams
    );

    unsubscribeBefore();

    // Observable Proof 1: Stress test reports brownout reset failure
    expect(beforeResult.ok).toBe(false);
    expect(beforeResult.data.resetOccurred).toBe(true);
    expect(beforeResult.data.resetReason).toBe("BROWNOUT");
    expect(beforeResult.data.minVoltage).toBeLessThan(2.80);

    // Observable Proof 2: Voltage telemetry recorded sag below 2.80V threshold
    const beforeVoltageSamples = beforeEvents.filter(
      (e): e is VoltageSampleEvent => e.type === "voltage_sample"
    );
    expect(beforeVoltageSamples.length).toBeGreaterThan(0);
    const beforeMinVoltage = Math.min(...beforeVoltageSamples.map((s) => s.voltage));
    expect(beforeMinVoltage).toBeLessThan(2.80);

    // Observable Proof 3: Asynchronous reset event was dispatched
    const beforeResetEvents = beforeEvents.filter(
      (e): e is ResetEvent => e.type === "reset"
    );
    expect(beforeResetEvents.some((r) => r.reason === "BROWNOUT")).toBe(true);

    // -------------------------------------------------------------------------
    // STEP 2: Physical Human Intervention (Jumper moved to 5V)
    // -------------------------------------------------------------------------
    adapter.setInterventionPoint("relay_power_jumper", "5v");

    // -------------------------------------------------------------------------
    // STEP 3: Retest using EXACT SAME Experiment Parameters
    // -------------------------------------------------------------------------
    const afterEvents: DeviceEvent[] = [];
    const unsubscribeAfter = adapter.subscribe((e) => afterEvents.push(e));

    const afterResult = await adapter.executeCapability<StressTestResult>(
      "run_relay_stress_test",
      experimentParams
    );

    unsubscribeAfter();

    // Observable Proof 4: Stress test succeeds completely with 0 resets
    expect(afterResult.ok).toBe(true);
    expect(afterResult.data.resetOccurred).toBe(false);
    expect(afterResult.data.cyclesCompleted).toBe(3);
    expect(afterResult.data.minVoltage).toBeGreaterThanOrEqual(3.10);

    // Observable Proof 5: Telemetry confirms supply voltage stayed safe throughout
    const afterVoltageSamples = afterEvents.filter(
      (e): e is VoltageSampleEvent => e.type === "voltage_sample"
    );
    expect(afterVoltageSamples.length).toBeGreaterThan(0);
    for (const sample of afterVoltageSamples) {
      expect(sample.voltage).toBeGreaterThanOrEqual(3.10);
    }

    // Observable Proof 6: No reset events emitted during the second run
    const afterResetEvents = afterEvents.filter((e) => e.type === "reset");
    expect(afterResetEvents.length).toBe(0);

    // Observable Proof 7: Reset history count did not increment after repair
    const historyResult = await adapter.executeCapability<ResetHistoryResult>(
      "read_reset_history"
    );
    expect(historyResult.ok).toBe(true);
    // Initial power-on (1) + before brownout (1) = 2 resets total
    expect(historyResult.data.resets.length).toBe(2);
  });
});
