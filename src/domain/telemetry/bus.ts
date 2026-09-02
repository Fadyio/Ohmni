/**
 * High-frequency Telemetry Event Bus.
 * Decoupled local event transport delivering real-time device telemetry
 * (voltage samples, relay state transitions, resets) to UI visualizers,
 * canvas renderers, and ring buffers without React/Zustand render churn.
 */

import type { DeviceEvent } from "../device/events";

export type TelemetryListener = (event: DeviceEvent, experimentId?: string) => void;

export interface ITelemetryEventBus {
  subscribe(listener: TelemetryListener): () => void;
  unsubscribe(listener: TelemetryListener): void;
  publish(event: DeviceEvent, experimentId?: string): void;
  subscriberCount(): number;
  clear(): void;
}

export class TelemetryEventBus implements ITelemetryEventBus {
  private readonly listeners: Set<TelemetryListener> = new Set();

  /**
   * Subscribes a listener to the telemetry stream.
   * Returns an idempotent unsubscribe cleanup function.
   */
  public subscribe(listener: TelemetryListener): () => void {
    this.listeners.add(listener);

    let unsubscribed = false;
    return () => {
      if (unsubscribed) return;
      unsubscribed = true;
      this.unsubscribe(listener);
    };
  }

  /**
   * Safely removes a listener from the bus.
   */
  public unsubscribe(listener: TelemetryListener): void {
    this.listeners.delete(listener);
  }

  /**
   * Publishes a device event to all subscribers in synchronous order.
   * Isolates listener exceptions so a failing visualizer cannot crash
   * experiment orchestration or other telemetry consumers.
   */
  public publish(event: DeviceEvent, experimentId?: string): void {
    if (this.listeners.size === 0) return;

    // Snapshot current listeners to allow safe subscription/unsubscription during dispatch
    const currentListeners = Array.from(this.listeners);

    for (const listener of currentListeners) {
      // Verify listener was not removed by a preceding listener in the same dispatch cycle
      if (!this.listeners.has(listener)) {
        continue;
      }

      try {
        listener(event, experimentId);
      } catch (err) {
        // Isolate subscriber errors: do not allow one faulty subscriber to break telemetry pipeline
        if (typeof console !== "undefined" && typeof console.warn === "function") {
          console.warn("[TelemetryEventBus] Subscriber threw an error during dispatch:", err);
        }
      }
    }
  }

  /**
   * Returns the current number of active subscribers.
   */
  public subscriberCount(): number {
    return this.listeners.size;
  }

  /**
   * Removes all active subscribers.
   */
  public clear(): void {
    this.listeners.clear();
  }
}
