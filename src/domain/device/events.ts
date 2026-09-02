/**
 * Hardware and simulated device event definitions.
 * Emitted over TelemetryEventBus and DeviceAdapter subscriptions.
 */

export type ResetReason =
  | "POWER_ON"
  | "BROWNOUT"
  | "WATCHDOG"
  | "SOFTWARE"
  | "EXTERNAL_PIN";

export interface VoltageSampleEvent {
  readonly type: "voltage_sample";
  readonly timestamp: number;
  readonly voltage: number;
  readonly unit: "V";
}

export interface RelayStateEvent {
  readonly type: "relay_state";
  readonly timestamp: number;
  readonly state: "open" | "closed";
  readonly pin: number;
}

export interface ResetEvent {
  readonly type: "reset";
  readonly timestamp: number;
  readonly reason: ResetReason;
  readonly message?: string;
}

export interface SensorReadingEvent {
  readonly type: "sensor_reading";
  readonly timestamp: number;
  readonly sensor: string;
  readonly value: number;
  readonly unit: string;
}

export interface TelemetryChunkEvent {
  readonly type: "telemetry_chunk";
  readonly channel: string;
  readonly t0_ms: number;
  readonly dt_ms: number;
  readonly samples: readonly number[];
}

export type DeviceEvent =
  | VoltageSampleEvent
  | RelayStateEvent
  | ResetEvent
  | SensorReadingEvent
  | TelemetryChunkEvent;
