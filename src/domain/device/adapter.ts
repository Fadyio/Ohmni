/**
 * Uniform Hardware Abstraction Interface.
 * Implemented identically by VirtualDeviceAdapter and SerialDeviceAdapter.
 */

import type { DeviceDescriptor } from "./descriptor";
import type { DeviceEvent } from "./events";

export interface CapabilityResult<T = Record<string, unknown>> {
  readonly ok: boolean;
  readonly data: T;
  readonly error?: {
    readonly code: string;
    readonly message: string;
  };
}

export interface DeviceAdapter {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
  getDescriptor(): DeviceDescriptor;
  executeCapability<T = Record<string, unknown>>(
    name: string,
    params?: Record<string, unknown>,
    signal?: AbortSignal
  ): Promise<CapabilityResult<T>>;
  subscribe(listener: (event: DeviceEvent) => void): () => void;
}
