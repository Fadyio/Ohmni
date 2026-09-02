/**
 * Lightweight bounded ring buffer for high-frequency numerical telemetry.
 * Pre-allocated circular buffer enforcing fixed capacity with O(1) sample pushes,
 * deterministic oldest-sample eviction, and ordered trace extraction.
 */

import type { NumericSample } from "../experiment/types";

export interface RingBufferOptions {
  readonly capacity: number;
  readonly channel?: string;
  readonly unit?: string;
}

export class TelemetryRingBuffer {
  public readonly capacity: number;
  public readonly channel: string;
  public readonly unit: string;

  private readonly buffer: Array<NumericSample | null>;
  private head: number = 0; // Index of next write location
  private count: number = 0;

  constructor(capacityOrOptions: number | RingBufferOptions = 1000) {
    if (typeof capacityOrOptions === "number") {
      if (capacityOrOptions <= 0 || !Number.isFinite(capacityOrOptions)) {
        throw new Error(`Invalid ring buffer capacity: ${capacityOrOptions}`);
      }
      this.capacity = Math.floor(capacityOrOptions);
      this.channel = "default";
      this.unit = "";
    } else {
      const { capacity, channel = "default", unit = "" } = capacityOrOptions;
      if (capacity <= 0 || !Number.isFinite(capacity)) {
        throw new Error(`Invalid ring buffer capacity: ${capacity}`);
      }
      this.capacity = Math.floor(capacity);
      this.channel = channel;
      this.unit = unit;
    }

    this.buffer = new Array(this.capacity).fill(null);
  }

  /**
   * Pushes a sample into the circular buffer.
   * Discards the oldest sample if capacity is exceeded.
   */
  public push(sample: NumericSample): void;
  public push(tMs: number, value: number): void;
  public push(sampleOrTMs: NumericSample | number, maybeValue?: number): void {
    const sample: NumericSample =
      typeof sampleOrTMs === "number"
        ? { tMs: sampleOrTMs, value: maybeValue! }
        : sampleOrTMs;

    this.buffer[this.head] = sample;
    this.head = (this.head + 1) % this.capacity;
    if (this.count < this.capacity) {
      this.count++;
    }
  }

  /**
   * Current number of stored samples.
   */
  public get size(): number {
    return this.count;
  }

  /**
   * Returns true if buffer reached its fixed capacity limit.
   */
  public isFull(): boolean {
    return this.count === this.capacity;
  }

  /**
   * Returns true if buffer contains no samples.
   */
  public isEmpty(): boolean {
    return this.count === 0;
  }

  /**
   * Returns all stored samples in chronological order (oldest to newest).
   */
  public toArray(): NumericSample[] {
    if (this.count === 0) return [];
    const result: NumericSample[] = new Array(this.count);
    const start = this.count < this.capacity ? 0 : this.head;
    for (let i = 0; i < this.count; i++) {
      const idx = (start + i) % this.capacity;
      result[i] = this.buffer[idx]!;
    }
    return result;
  }

  /**
   * Alias for toArray().
   */
  public getSamples(): readonly NumericSample[] {
    return this.toArray();
  }

  /**
   * Returns the most recent sample, or undefined if empty.
   */
  public getLatest(): NumericSample | undefined {
    if (this.count === 0) return undefined;
    const lastIdx = (this.head - 1 + this.capacity) % this.capacity;
    return this.buffer[lastIdx] ?? undefined;
  }

  /**
   * Resets the buffer to empty state.
   */
  public clear(): void {
    this.buffer.fill(null);
    this.head = 0;
    this.count = 0;
  }
}
