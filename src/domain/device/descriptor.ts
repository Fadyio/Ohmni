/**
 * Device capability and metadata descriptors.
 * Used for capability discovery and WebMCP tool generation.
 */

export type SafetyClassification = "green" | "amber" | "red";

export interface DeviceCapability {
  readonly name: string;
  readonly description: string;
  readonly safety: SafetyClassification;
  readonly readOnly: boolean;
  readonly parameters?: Record<string, unknown>;
}

export interface DeviceDescriptor {
  readonly id: string;
  readonly name: string;
  readonly firmwareVersion: string;
  readonly protocolVersion: number;
  readonly capabilities: readonly DeviceCapability[];
  readonly limits?: Readonly<Record<string, unknown>>;
}
