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
    expect(html).toContain("FAULT REPRODUCED (BROWNOUT RESET)");
    expect(html).toContain("Captured Oscilloscope Waveform");
    expect(html).not.toContain("REAL-TIME LOAD TEST");
    expect(html).not.toContain("REAL-TIME PHYSICAL EXPERIMENT");

    // 2. Relay visual must indicate safely open / inert
    expect(html).toContain("RELAY SAFELY OPEN (INERT)");
    expect(html).toContain("COIL INERT (SAFELY OPEN)");
    expect(html).toContain('data-relay-state="open"');
  });
});
