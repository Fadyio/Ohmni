/**
 * Trusted Browser-Owned Capability Registry.
 * Maps validated DeviceCapability names to secure, trusted WebMCP tool definitions.
 * Prevents untrusted devices from registering arbitrary, unvetted tool implementations.
 */

import type { DeviceAdapter } from "@/domain/device/adapter";
import type { ModelContextTool } from "./types";

export type ToolFactory = (adapter: DeviceAdapter) => ModelContextTool;

export class CapabilityRegistry {
  private readonly factories: Map<string, ToolFactory> = new Map();

  constructor() {
    this.registerDefaultFactories();
  }

  private registerDefaultFactories(): void {
    // 1. read_device_info (Green / ReadOnly)
    this.registerFactory("read_device_info", (adapter) => ({
      name: "read_device_info",
      title: "Read Device Info",
      description:
        "Read hardware model, chip architecture, and firmware revision of the connected controller.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
      annotations: {
        readOnlyHint: true,
      },
      execute: async (_input, options) => {
        const result = await adapter.executeCapability("read_device_info", {}, options?.signal);
        return result.data;
      },
    }));

    // 2. read_reset_history (Green / ReadOnly)
    this.registerFactory("read_reset_history", (adapter) => ({
      name: "read_reset_history",
      title: "Read Reset History",
      description:
        "Read chronological reset causes reported by the connected controller. Use this when investigating unexpected restarts or determining whether failures are caused by brownout, watchdog, software, or external reset conditions.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
      annotations: {
        readOnlyHint: true,
      },
      execute: async (_input, options) => {
        const result = await adapter.executeCapability("read_reset_history", {}, options?.signal);
        return result.data;
      },
    }));

    // 3. read_system_health (Green / ReadOnly)
    this.registerFactory("read_system_health", (adapter) => ({
      name: "read_system_health",
      title: "Read System Health",
      description:
        "Read runtime telemetry including free heap memory, CPU temperature, task watchdog status, and uptime.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
      annotations: {
        readOnlyHint: true,
      },
      execute: async (_input, options) => {
        const result = await adapter.executeCapability("read_system_health", {}, options?.signal);
        return result.data;
      },
    }));

    // 4. measure_supply_voltage (Green / ReadOnly)
    this.registerFactory("measure_supply_voltage", (adapter) => ({
      name: "measure_supply_voltage",
      title: "Measure Supply Voltage",
      description:
        "Sample instantaneous voltage on the primary 3.3V rail to assess supply rail stability and noise.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
      annotations: {
        readOnlyHint: true,
      },
      execute: async (_input, options) => {
        const result = await adapter.executeCapability("measure_supply_voltage", {}, options?.signal);
        return result.data;
      },
    }));

    // 5. run_relay_stress_test (Amber / Actuation)
    this.registerFactory("run_relay_stress_test", (adapter) => ({
      name: "run_relay_stress_test",
      title: "Run Relay Stress Test",
      description:
        "Actuate the onboard relay under inrush load to test power supply rail stability and detect load-induced brownout resets.",
      inputSchema: {
        type: "object",
        properties: {
          cycles: {
            type: "integer",
            minimum: 1,
            maximum: 10,
            description: "Number of relay activation cycles (default 3)",
          },
          duration_ms: {
            type: "integer",
            minimum: 10,
            maximum: 500,
            description: "Duration in milliseconds for each relay cycle (default 50)",
          },
        },
        additionalProperties: false,
      },
      annotations: {
        readOnlyHint: false,
      },
      execute: async (input, options) => {
        const cycles = typeof input.cycles === "number" ? input.cycles : 3;
        const durationMs = typeof input.duration_ms === "number" ? input.duration_ms : 50;

        const result = await adapter.executeCapability(
          "run_relay_stress_test",
          { cycles, durationMs },
          options?.signal
        );
        return result.data;
      },
    }));
  }

  public registerFactory(capabilityName: string, factory: ToolFactory): void {
    this.factories.set(capabilityName, factory);
  }

  public hasCapability(capabilityName: string): boolean {
    return this.factories.has(capabilityName);
  }

  public createTool(capabilityName: string, adapter: DeviceAdapter): ModelContextTool | undefined {
    const factory = this.factories.get(capabilityName);
    if (!factory) {
      return undefined;
    }
    return factory(adapter);
  }
}
