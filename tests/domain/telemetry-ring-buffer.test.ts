/**
 * Slice 3C: TelemetryRingBuffer Unit Tests & Bounded Capacity Verification.
 */

import { describe, it, expect, beforeEach } from "bun:test";
import { TelemetryRingBuffer } from "@/domain/telemetry/ring-buffer";

describe("Slice 3C: TelemetryRingBuffer", () => {
  it("initializes with specified capacity and channel metadata", () => {
    const buffer = new TelemetryRingBuffer({
      capacity: 50,
      channel: "supply_voltage",
      unit: "V",
    });

    expect(buffer.capacity).toBe(50);
    expect(buffer.channel).toBe("supply_voltage");
    expect(buffer.unit).toBe("V");
    expect(buffer.size).toBe(0);
    expect(buffer.isEmpty()).toBe(true);
    expect(buffer.isFull()).toBe(false);
    expect(buffer.getLatest()).toBeUndefined();
    expect(buffer.toArray()).toEqual([]);
  });

  it("throws on invalid capacity values", () => {
    expect(() => new TelemetryRingBuffer(0)).toThrow();
    expect(() => new TelemetryRingBuffer(-5)).toThrow();
    expect(() => new TelemetryRingBuffer(NaN)).toThrow();
  });

  it("preserves insertion order when below capacity", () => {
    const buffer = new TelemetryRingBuffer(5);

    buffer.push(10, 3.31);
    buffer.push({ tMs: 20, value: 3.30 });
    buffer.push(30, 3.28);

    expect(buffer.size).toBe(3);
    expect(buffer.isEmpty()).toBe(false);
    expect(buffer.isFull()).toBe(false);
    expect(buffer.getLatest()).toEqual({ tMs: 30, value: 3.28 });

    expect(buffer.toArray()).toEqual([
      { tMs: 10, value: 3.31 },
      { tMs: 20, value: 3.30 },
      { tMs: 30, value: 3.28 },
    ]);
  });

  it("enforces fixed capacity and discards oldest samples first (FIFO eviction)", () => {
    const buffer = new TelemetryRingBuffer(3);

    buffer.push(1, 100);
    buffer.push(2, 200);
    buffer.push(3, 300);

    expect(buffer.size).toBe(3);
    expect(buffer.isFull()).toBe(true);
    expect(buffer.toArray()).toEqual([
      { tMs: 1, value: 100 },
      { tMs: 2, value: 200 },
      { tMs: 3, value: 300 },
    ]);

    // Push 4th sample: 1st sample (tMs: 1) should be evicted
    buffer.push(4, 400);
    expect(buffer.size).toBe(3);
    expect(buffer.isFull()).toBe(true);
    expect(buffer.toArray()).toEqual([
      { tMs: 2, value: 200 },
      { tMs: 3, value: 300 },
      { tMs: 4, value: 400 },
    ]);

    // Push 5th sample: 2nd sample (tMs: 2) should be evicted
    buffer.push(5, 500);
    expect(buffer.size).toBe(3);
    expect(buffer.toArray()).toEqual([
      { tMs: 3, value: 300 },
      { tMs: 4, value: 400 },
      { tMs: 5, value: 500 },
    ]);
  });

  it("clear() resets size and clears all samples", () => {
    const buffer = new TelemetryRingBuffer(4);
    buffer.push(1, 10);
    buffer.push(2, 20);
    expect(buffer.size).toBe(2);

    buffer.clear();
    expect(buffer.size).toBe(0);
    expect(buffer.isEmpty()).toBe(true);
    expect(buffer.isFull()).toBe(false);
    expect(buffer.toArray()).toEqual([]);
    expect(buffer.getLatest()).toBeUndefined();

    // After clear, new inserts work cleanly
    buffer.push(3, 30);
    expect(buffer.size).toBe(1);
    expect(buffer.toArray()).toEqual([{ tMs: 3, value: 30 }]);
  });

  it("handles 1000+ inserts deterministically without memory growth", () => {
    const capacity = 250;
    const buffer = new TelemetryRingBuffer(capacity);

    for (let i = 0; i < 1500; i++) {
      buffer.push(i, 3.3 - (i % 10) * 0.05);
    }

    expect(buffer.size).toBe(capacity);
    expect(buffer.isFull()).toBe(true);

    const samples = buffer.toArray();
    expect(samples.length).toBe(capacity);

    // Oldest sample in buffer should be i = 1500 - 250 = 1250
    expect(samples[0].tMs).toBe(1250);
    // Newest sample should be i = 1499
    expect(samples[samples.length - 1].tMs).toBe(1499);
    expect(buffer.getLatest()?.tMs).toBe(1499);
  });
});
