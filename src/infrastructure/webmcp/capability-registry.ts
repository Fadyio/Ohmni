/**
 * Trusted Browser-Owned Capability Registry.
 * Maps validated DeviceCapability names to secure, trusted WebMCP tool definitions.
 * Prevents untrusted devices from registering arbitrary, unvetted tool implementations.
 *
 * Routes experimental actuation tools (e.g. run_relay_stress_test) through
 * ExperimentRunner to correlate high-frequency telemetry and synthesize concise summaries.
 */

import type { DeviceAdapter } from "@/domain/device/adapter";
import type { ModelContextTool } from "./types";
import { ExperimentRunner } from "@/domain/experiment/runner";

export type ToolFactory = (adapter: DeviceAdapter, runner?: ExperimentRunner) => ModelContextTool;

export class CapabilityRegistry {
  private readonly runner: ExperimentRunner;
  private readonly factories: Map<string, ToolFactory> = new Map();

  constructor(runner?: ExperimentRunner) {
    this.runner = runner ?? new ExperimentRunner();
    this.registerDefaultFactories();
  }

  public getRunner(): ExperimentRunner {
    return this.runner;
  }

  private registerDefaultFactories(): void {
    // 1. read_device_info (Green / ReadOnly)
    this.registerFactory("read_device_info", (adapter) => ({
      name: "read_device_info",
      title: "Read Device Information",
      description:
        "Read hardware identity, firmware build metadata, MCU architecture, and MAC address from the connected device.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
      annotations: {
        readOnlyHint: true,
      },
      execute: async (_input, _options) => {
        const result = await adapter.executeCapability("read_device_info");
        return result.data;
      },
    }));

    // 2. read_reset_history (Green / ReadOnly)
    this.registerFactory("read_reset_history", (adapter) => ({
      name: "read_reset_history",
      title: "Read Reset History",
      description:
        "Retrieve the hardware boot and reset event history log to identify past brownouts, watchdogs, software resets, and reset causes.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
      annotations: {
        readOnlyHint: true,
      },
      execute: async (_input, _options) => {
        const result = await adapter.executeCapability("read_reset_history");
        return result.data;
      },
    }));

    // 3. read_system_health (Green / ReadOnly)
    this.registerFactory("read_system_health", (adapter) => ({
      name: "read_system_health",
      title: "Read System Health",
      description:
        "Read current operational diagnostics: heap memory, internal core temperature, and system uptime.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
      annotations: {
        readOnlyHint: true,
      },
      execute: async (_input, _options) => {
        const result = await adapter.executeCapability("read_system_health");
        return result.data;
      },
    }));

    // 4. measure_supply_voltage (Green / ReadOnly)
    this.registerFactory("measure_supply_voltage", (adapter) => ({
      name: "measure_supply_voltage",
      title: "Measure Supply Voltage",
      description:
        "Sample the internal analog-to-digital converter (ADC) to measure instantaneous VDD rail voltage.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
      annotations: {
        readOnlyHint: true,
      },
      execute: async (_input, _options) => {
        const result = await adapter.executeCapability("measure_supply_voltage");
        return result.data;
      },
    }));

    // 5. run_relay_stress_test (Amber / Actuation — ExperimentRunner)
    this.registerFactory("run_relay_stress_test", (adapter, runner) => ({
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

        const effectiveRunner = runner ?? this.runner;
        const summary = await effectiveRunner.runExperiment(
          adapter,
          "run_relay_stress_test",
          { cycles, durationMs },
          options?.signal
        );

        return summary;
      },
    }));
  }

  public registerFactory(capabilityName: string, factory: ToolFactory): void {
    this.factories.set(capabilityName, factory);
  }

  public hasCapability(capabilityName: string): boolean {
    return this.factories.has(capabilityName);
  }

  public createTool(
    capabilityName: string,
    adapter: DeviceAdapter,
    runner?: ExperimentRunner
  ): ModelContextTool | undefined {
    const factory = this.factories.get(capabilityName);
    if (!factory) {
      return undefined;
    }
    return factory(adapter, runner ?? this.runner);
  }
}
