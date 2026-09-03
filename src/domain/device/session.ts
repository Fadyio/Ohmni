/**
 * Device Session Types and State.
 *
 * Supports seamless dual-mode switching between the Virtual Demo Challenge
 * and physical hardware connected via Web Serial.
 */

import type { DeviceAdapter } from "./adapter";
import type { DeviceDescriptor } from "./descriptor";

export type DeviceMode = "virtual" | "physical";

export type DeviceConnectionState =
  | "disconnected"
  | "requesting_permission"
  | "opening_port"
  | "negotiating_protocol"
  | "connected"
  | "reconnecting"
  | "error";

export interface DeviceSessionState {
  readonly mode: DeviceMode;
  readonly adapter: DeviceAdapter;
  readonly descriptor: DeviceDescriptor | null;
  readonly connectionState: DeviceConnectionState;
  readonly errorMessage?: string;
}
