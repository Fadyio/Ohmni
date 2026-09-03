/**
 * ADR 0006 Versioned NDJSON Protocol v1 Types & Schema Validators.
 *
 * Defines all inbound and outbound message families exchanged over Web Serial:
 * - hello
 * - descriptor
 * - request
 * - response (success / error)
 * - event
 * - telemetry
 * - cancel
 */

export const PROTOCOL_VERSION = 1;

export interface HelloMessage {
  readonly type: "hello";
  readonly protocol: number;
}

export interface DeviceMeta {
  readonly id: string;
  readonly name: string;
  readonly firmwareVersion: string;
  readonly manufacturer?: string;
  readonly model?: string;
  readonly hardwareRevision?: string;
  readonly transport?: string;
  readonly presentationProfile?: string;
}

export interface ProtocolCapability {
  readonly name: string;
  readonly description?: string;
  readonly safety?: "green" | "amber" | "red";
  readonly readOnly?: boolean;
  readonly parameters?: Record<string, unknown>;
}

export interface DescriptorMessage {
  readonly type: "descriptor";
  readonly protocol: number;
  readonly device: DeviceMeta;
  readonly capabilities: readonly ProtocolCapability[];
  readonly limits?: Readonly<Record<string, unknown>>;
}

export interface RequestMessage {
  readonly type: "request";
  readonly id: string;
  readonly capability: string;
  readonly params?: Readonly<Record<string, unknown>>;
}

export interface ResponseSuccessMessage {
  readonly type: "response";
  readonly id: string;
  readonly ok: true;
  readonly result?: Readonly<Record<string, unknown>>;
}

export interface ResponseErrorMessage {
  readonly type: "response";
  readonly id: string;
  readonly ok: false;
  readonly error: {
    readonly code: string;
    readonly message: string;
  };
}

export type ResponseMessage = ResponseSuccessMessage | ResponseErrorMessage;

export interface EventMessage {
  readonly type: "event";
  readonly event: string;
  readonly timestamp?: number;
  readonly data?: Readonly<Record<string, unknown>>;
  readonly [key: string]: unknown;
}

export interface TelemetryMessage {
  readonly type: "telemetry";
  readonly channel: string;
  readonly unit?: string;
  readonly t0_ms: number;
  readonly dt_ms: number;
  readonly samples: readonly number[];
}

export interface CancelMessage {
  readonly type: "cancel";
  readonly id: string;
}

export type ProtocolMessage =
  | HelloMessage
  | DescriptorMessage
  | RequestMessage
  | ResponseMessage
  | EventMessage
  | TelemetryMessage
  | CancelMessage;

function isObject(val: unknown): val is Record<string, unknown> {
  return typeof val === "object" && val !== null && !Array.isArray(val);
}

export function isHelloMessage(val: unknown): val is HelloMessage {
  if (!isObject(val)) return false;
  return val.type === "hello" && typeof val.protocol === "number";
}

export function isDescriptorMessage(val: unknown): val is DescriptorMessage {
  if (!isObject(val)) return false;
  if (val.type !== "descriptor" || typeof val.protocol !== "number") return false;
  if (!isObject(val.device)) return false;
  const dev = val.device;
  if (
    typeof dev.id !== "string" ||
    typeof dev.name !== "string" ||
    typeof dev.firmwareVersion !== "string"
  ) {
    return false;
  }
  if (!Array.isArray(val.capabilities)) return false;
  for (const cap of val.capabilities) {
    if (!isObject(cap) || typeof cap.name !== "string") {
      return false;
    }
  }
  return true;
}

export function isRequestMessage(val: unknown): val is RequestMessage {
  if (!isObject(val)) return false;
  return (
    val.type === "request" &&
    typeof val.id === "string" &&
    val.id.length > 0 &&
    typeof val.capability === "string" &&
    val.capability.length > 0 &&
    (val.params === undefined || isObject(val.params))
  );
}

export function isResponseMessage(val: unknown): val is ResponseMessage {
  if (!isObject(val)) return false;
  if (val.type !== "response" || typeof val.id !== "string" || typeof val.ok !== "boolean") {
    return false;
  }
  if (val.ok === true) {
    return val.result === undefined || isObject(val.result);
  }
  if (!isObject(val.error)) return false;
  const err = val.error;
  return typeof err.code === "string" && typeof err.message === "string";
}

export function isEventMessage(val: unknown): val is EventMessage {
  if (!isObject(val)) return false;
  return val.type === "event" && typeof val.event === "string";
}

export function isTelemetryMessage(val: unknown): val is TelemetryMessage {
  if (!isObject(val)) return false;
  if (
    val.type !== "telemetry" ||
    typeof val.channel !== "string" ||
    typeof val.t0_ms !== "number" ||
    typeof val.dt_ms !== "number" ||
    !Array.isArray(val.samples)
  ) {
    return false;
  }
  return val.samples.every((s) => typeof s === "number");
}

export function isCancelMessage(val: unknown): val is CancelMessage {
  if (!isObject(val)) return false;
  return val.type === "cancel" && typeof val.id === "string" && val.id.length > 0;
}

export function isProtocolMessage(val: unknown): val is ProtocolMessage {
  return (
    isHelloMessage(val) ||
    isDescriptorMessage(val) ||
    isRequestMessage(val) ||
    isResponseMessage(val) ||
    isEventMessage(val) ||
    isTelemetryMessage(val) ||
    isCancelMessage(val)
  );
}

export type ParseResult =
  | { readonly ok: true; readonly message: ProtocolMessage }
  | { readonly ok: false; readonly raw: string; readonly reason: string };

export function parseProtocolMessage(line: string): ParseResult {
  const trimmed = line.trim();
  if (!trimmed) {
    return { ok: false, raw: line, reason: "EMPTY_LINE" };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch (err) {
    return {
      ok: false,
      raw: line,
      reason: `INVALID_JSON: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  if (!isProtocolMessage(parsed)) {
    return {
      ok: false,
      raw: line,
      reason: "SCHEMA_MISMATCH: JSON did not match any ADR 0006 protocol message type",
    };
  }

  return { ok: true, message: parsed };
}
