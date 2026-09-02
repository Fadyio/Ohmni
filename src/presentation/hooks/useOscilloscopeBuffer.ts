/**
 * Hook to manage TelemetryRingBuffer and event markers for the Canvas Oscilloscope.
 * Pushes high-frequency telemetry samples (100Hz+) directly to circular buffer
 * with zero React component rerenders per sample.
 */

import { useEffect, useRef, useCallback } from "react";
import type { ITelemetryEventBus } from "@/domain/telemetry/bus";
import { TelemetryRingBuffer } from "@/domain/telemetry/ring-buffer";
import type { DeviceEvent } from "@/domain/device/events";

export interface ScopeEventMarker {
  readonly id: string;
  readonly tMs: number;
  readonly label: string;
  readonly type: "relay_on" | "relay_off" | "brownout" | "reset";
  readonly voltage?: number;
}

export interface OscilloscopeBufferHandle {
  readonly ringBufferRef: React.RefObject<TelemetryRingBuffer>;
  readonly markersRef: React.RefObject<ScopeEventMarker[]>;
  readonly clear: () => void;
}

export function useOscilloscopeBuffer(eventBus?: ITelemetryEventBus, capacity = 2000): OscilloscopeBufferHandle {
  const ringBufferRef = useRef<TelemetryRingBuffer>(new TelemetryRingBuffer({ capacity, channel: "3v3_rail", unit: "V" }));
  const markersRef = useRef<ScopeEventMarker[]>([]);
  const experimentStartRef = useRef<number | null>(null);
  const brownoutDetectedRef = useRef<boolean>(false);

  const clear = useCallback(() => {
    ringBufferRef.current.clear();
    markersRef.current = [];
    experimentStartRef.current = null;
    brownoutDetectedRef.current = false;
  }, []);

  useEffect(() => {
    if (!eventBus) return;

    const unsubscribe = eventBus.subscribe((event: DeviceEvent, expId?: string) => {
      const now = Date.now();
      if (experimentStartRef.current === null) {
        experimentStartRef.current = now;
      }
      const tMs = now - (experimentStartRef.current ?? now);

      if (event.type === "voltage_sample") {
        ringBufferRef.current.push(tMs, event.voltage);

        // Detect brownout crossing for scope marker
        if (event.voltage < 2.80 && !brownoutDetectedRef.current) {
          brownoutDetectedRef.current = true;
          markersRef.current.push({
            id: `mkr_${now}_brownout`,
            tMs,
            label: "BROWNOUT",
            type: "brownout",
            voltage: event.voltage,
          });
        }
      } else if (event.type === "relay_state") {
        markersRef.current.push({
          id: `mkr_${now}_relay`,
          tMs,
          label: event.state === "closed" ? "RELAY ON" : "RELAY OPEN",
          type: event.state === "closed" ? "relay_on" : "relay_off",
        });
      } else if (event.type === "reset") {
        markersRef.current.push({
          id: `mkr_${now}_reset`,
          tMs,
          label: `RESET (${event.reason})`,
          type: "reset",
        });
      }
    });

    return () => {
      unsubscribe();
    };
  }, [eventBus]);

  return {
    ringBufferRef,
    markersRef,
    clear,
  };
}
