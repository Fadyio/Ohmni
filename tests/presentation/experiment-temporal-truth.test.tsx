/**
 * Milestone 8 — Experiment Temporal Truth Invariant Test.
 *
 * Requirements:
 * 1. During active test (isRunning = true):
 *    - Header tag displays "REAL-TIME LOAD TEST"
 *    - Relay visual indicates ENERGIZED / closed (COIL ENERGIZED)
 *    - Live chip indicates RELAY ENERGIZED (ACTIVE)
 * 2. After fault / completion (isRunning = false):
 *    - Header tag displays "FAULT REPRODUCED (BROWNOUT RESET)"
 *    - Header NEVER calls frozen result "REAL-TIME"
 *    - Relay visual indicates SAFELY OPEN / inert (COIL INERT)
 *    - Live chip indicates RELAY SAFELY OPEN (INERT)
 */

import React from "react";
import { describe, expect, it } from "bun:test";
import { renderToString } from "react-dom/server";
import { RunningExperimentScene } from "@/presentation/components/investigation-story/scenes/RunningExperimentScene";
import { TelemetryRingBuffer } from "@/domain/telemetry/ring-buffer";

describe("Milestone 8 — Experiment Temporal Truth Invariant", () => {
  const ringBuffer = new TelemetryRingBuffer(100);
  const ringBufferRef = { current: ringBuffer };
  const markersRef = { current: [] };

  it("renders active real-time load test state with energized relay when isRunning is true", () => {
    const html = renderToString(
      <RunningExperimentScene
        ringBufferRef={ringBufferRef}
        markersRef={markersRef}
        isRunning={true}
        relayState="open" // Even if underlying prop is lagging, isRunning forces active energized visual
        railVoltage={3.15}
      />
    );

    // 1. Must clearly indicate active real-time load test
    expect(html).toContain("REAL-TIME LOAD TEST");
    expect(html).toContain("Active Relay Actuation &amp; Oscilloscope Telemetry");

    // 2. Relay visual must indicate energized / closed
    expect(html).toContain("RELAY ENERGIZED (ACTIVE)");
    expect(html).toContain("COIL ENERGIZED");
    expect(html).toContain('data-relay-state="closed"');
    expect(html).toContain('data-diagnostic-phase="sampling"');
    expect(html).toContain("3V3 rail → K1 coil → fan load");
    expect(html).not.toContain("FAULT REPRODUCED");
  });

  it("renders captured post-fault safe open state without real-time claims when isRunning is false", () => {
    const html = renderToString(
      <RunningExperimentScene
        ringBufferRef={ringBufferRef}
        markersRef={markersRef}
        isRunning={false}
        relayState="open"
        railVoltage={2.72}
      />
    );

    // 1. Must clearly indicate reproduced fault, NOT active real-time
    expect(html).toContain("Fault reproduced: Brownout reset");
    expect(html).toContain("Captured Oscilloscope Waveform");
    expect(html).not.toContain("REAL-TIME LOAD TEST");
    expect(html).not.toContain("REAL-TIME PHYSICAL EXPERIMENT");

    // 2. Relay visual must indicate safely open / inert
    expect(html).toContain("RELAY SAFELY OPEN (INERT)");
    expect(html).toContain("COIL INERT (SAFELY OPEN)");
    expect(html).toContain('data-relay-state="open"');
    expect(html).toContain('data-diagnostic-phase="brownout"');
    expect(html).toContain("2.72 V minimum → MCU brownout reset");
  });

  it("renders the isolated 5 V recovery path during verification", () => {
    const html = renderToString(
      <RunningExperimentScene
        ringBufferRef={ringBufferRef}
        markersRef={markersRef}
        isRunning={true}
        relayState="closed"
        railVoltage={3.18}
        isVerification={true}
      />
    );

    expect(html).toContain('data-diagnostic-phase="verified"');
    expect(html).toContain("JP1 5V isolated →");
    expect(html).toContain("3.18 V stable");
  });

  it("does not animate a completed historical experiment as live", () => {
    const capturedBuffer = new TelemetryRingBuffer(10);
    capturedBuffer.push(0, 3.31);
    capturedBuffer.push(100, 2.72);
    capturedBuffer.push(200, 3.30);
    const html = renderToString(
      <RunningExperimentScene
        ringBufferRef={{ current: capturedBuffer }}
        markersRef={markersRef}
        isRunning={false}
        relayState="open"
        railVoltage={3.31}
      />
    );

    expect(html).toContain("FAULT CAPTURED");
    expect(html).toContain("2.72 V minimum");
    expect(html).toContain("CAPTURED STATE");
    expect(html).not.toContain("LOAD TEST RUNNING");
    expect(html).not.toContain("board-fan-rotor");
  });
});
