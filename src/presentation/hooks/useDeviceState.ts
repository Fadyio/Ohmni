/**
 * Hook to observe DeviceAdapter state, descriptor, and physical events.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import type { DeviceAdapter } from "@/domain/device/adapter";
import type { DeviceDescriptor } from "@/domain/device/descriptor";
import type { DeviceEvent, ResetReason } from "@/domain/device/events";

export interface DeviceState {
  readonly isConnected: boolean;
  readonly isConnecting: boolean;
  readonly descriptor: DeviceDescriptor | null;
  readonly relayState: "open" | "closed";
  readonly resetCount: number;
  readonly lastResetReason: ResetReason | null;
  readonly statusVisual: "nominal" | "reset" | "disconnected";
  readonly railVoltage: number;
}

export interface DeviceStateHandle extends DeviceState {
  readonly connect: () => Promise<void>;
  readonly disconnect: () => Promise<void>;
}

export function useDeviceState(adapter?: DeviceAdapter): DeviceStateHandle {
  const [state, setState] = useState<DeviceState>(() => {
    const isConn = adapter ? adapter.isConnected() : false;
    const desc = adapter && isConn ? adapter.getDescriptor() : null;
    return {
      isConnected: isConn,
      isConnecting: false,
      descriptor: desc,
      relayState: "open",
      resetCount: 0,
      lastResetReason: null,
      statusVisual: isConn ? "nominal" : "disconnected",
      railVoltage: 3.31,
    };
  });

  const resetTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!adapter) return;

    const updateFromAdapter = () => {
      const isConn = adapter.isConnected();
      const desc = isConn ? adapter.getDescriptor() : null;
      setState((prev) => ({
        ...prev,
        isConnected: isConn,
        descriptor: desc,
        statusVisual: isConn
          ? prev.statusVisual === "reset"
            ? "reset"
            : "nominal"
          : "disconnected",
      }));
    };

    updateFromAdapter();
    const pollInterval = setInterval(updateFromAdapter, 100);

    const unsubscribe = adapter.subscribe((event: DeviceEvent) => {
      if (event.type === "reset") {
        setState((prev) => ({
          ...prev,
          resetCount: prev.resetCount + 1,
          lastResetReason: event.reason,
          statusVisual: "reset",
        }));

        if (resetTimerRef.current !== null) {
          clearTimeout(resetTimerRef.current);
        }
        resetTimerRef.current = window.setTimeout(() => {
          setState((prev) => ({
            ...prev,
            statusVisual: adapter.isConnected() ? "nominal" : "disconnected",
          }));
        }, 900);
      } else if (event.type === "relay_state") {
        setState((prev) => ({
          ...prev,
          relayState: event.state,
        }));
      } else if (event.type === "voltage_sample") {
        setState((prev) => ({
          ...prev,
          railVoltage: event.voltage,
        }));
      }
    });

    return () => {
      clearInterval(pollInterval);
      unsubscribe();
      if (resetTimerRef.current !== null) {
        clearTimeout(resetTimerRef.current);
      }
    };
  }, [adapter]);

  const connect = useCallback(async () => {
    if (!adapter) return;
    setState((prev) => ({ ...prev, isConnecting: true }));
    try {
      await adapter.connect();
      const desc = adapter.getDescriptor();
      setState((prev) => ({
        ...prev,
        isConnected: true,
        isConnecting: false,
        descriptor: desc,
        statusVisual: "nominal",
      }));
    } catch (err) {
      setState((prev) => ({ ...prev, isConnecting: false }));
      throw err;
    }
  }, [adapter]);

  const disconnect = useCallback(async () => {
    if (!adapter) return;
    try {
      await adapter.disconnect();
      setState((prev) => ({
        ...prev,
        isConnected: false,
        isConnecting: false,
        descriptor: null,
        statusVisual: "disconnected",
      }));
    } catch (err) {
      throw err;
    }
  }, [adapter]);

  return {
    ...state,
    connect,
    disconnect,
  };
}
