/**
 * ExperimentRunner Subsystem.
 * Orchestrates physical and virtual diagnostic experiments.
 *
 * Responsibilities:
 * 1. Assigns unique experiment_id correlation tokens.
 * 2. Subscribes to DeviceAdapter events.
 * 3. Executes diagnostic capabilities.
 * 4. Correlates emitted events to the active experiment.
 * 5. Streams live samples and state changes to TelemetryEventBus.
 * 6. Stores high-frequency trace and timeline history in ExperimentRecord.
 * 7. Propagates AbortSignal cancellation and preserves partial records.
 * 8. Safely unsubscribes upon completion/abort (zero listener leak).
 * 9. Synthesizes concise structured semantic summaries for WebMCP tools.
 * 10. Persists ExperimentRecord into ExperimentStore.
 */

import type { DeviceAdapter, CapabilityResult } from "../device/adapter";
import type { DeviceEvent, ResetEvent, RelayStateEvent } from "../device/events";
import {
  generateExperimentId,
  type ExperimentEvent,
  type ExperimentMetadata,
  type ExperimentRecord,
  type ExperimentStatus,
  type ExperimentSummary,
  type NumericSample,
  type VoltageSummary,
} from "./types";
import { type ExperimentStore, InMemoryExperimentStore } from "./store";
import { type ITelemetryEventBus, TelemetryEventBus } from "../telemetry/bus";

export interface ExperimentRunnerOptions {
  readonly eventBus?: ITelemetryEventBus;
  readonly store?: ExperimentStore;
}

export class ExperimentRunner {
  private readonly eventBus: ITelemetryEventBus;
  private readonly store: ExperimentStore;

  constructor(options: ExperimentRunnerOptions = {}) {
    this.eventBus = options.eventBus ?? new TelemetryEventBus();
    this.store = options.store ?? new InMemoryExperimentStore();
  }

  public getEventBus(): ITelemetryEventBus {
    return this.eventBus;
  }

  public getStore(): ExperimentStore {
    return this.store;
  }

  /**
   * Executes a diagnostic experiment against a connected DeviceAdapter.
   */
  public async runExperiment(
    adapter: DeviceAdapter,
    capabilityName: string,
    parameters: Record<string, unknown> = {},
    signal?: AbortSignal
  ): Promise<ExperimentSummary> {
    const experimentId = generateExperimentId();
    const startedAt = Date.now();

    const events: ExperimentEvent[] = [];
    const voltageSamples: NumericSample[] = [];
    const resetEvents: ResetEvent[] = [];
    const relayEvents: RelayStateEvent[] = [];

    // Check pre-aborted signal
    if (signal?.aborted) {
      const summary: ExperimentSummary = this.synthesizeSummary({
        experimentId,
        capabilityName,
        status: "aborted",
        parameters,
        voltageSamples,
        resetEvents,
        message: "Experiment aborted before execution started.",
      });

      const record: ExperimentRecord = {
        metadata: {
          id: experimentId,
          capability: capabilityName,
          startedAt,
          completedAt: startedAt,
          status: "aborted",
          parameters,
        },
        events: [],
        traces: {
          supply_voltage: {
            channel: "supply_voltage",
            unit: "V",
            samples: [],
          },
        },
        summary,
      };

      this.store.save(record);
      throw new Error(`Tool execution aborted for '${capabilityName}'`);
    }

    // Subscribe to DeviceAdapter for the duration of this experiment
    const unsubscribe = adapter.subscribe((deviceEvent: DeviceEvent) => {
      const timestamp = (deviceEvent as { timestamp?: number }).timestamp ?? Date.now();

      const expEvent: ExperimentEvent = {
        experimentId,
        timestamp,
        event: deviceEvent,
      };
      events.push(expEvent);

      if (deviceEvent.type === "voltage_sample") {
        voltageSamples.push({
          tMs: Math.max(0, timestamp - startedAt),
          value: deviceEvent.voltage,
        });
      } else if (deviceEvent.type === "reset") {
        resetEvents.push(deviceEvent);
      } else if (deviceEvent.type === "relay_state") {
        relayEvents.push(deviceEvent);
      } else if (deviceEvent.type === "telemetry_chunk") {
        if (deviceEvent.channel === "supply_voltage") {
          let t = deviceEvent.t0_ms;
          for (const sample of deviceEvent.samples) {
            voltageSamples.push({
              tMs: Math.max(0, t - startedAt),
              value: sample,
            });
            t += deviceEvent.dt_ms;
          }
        }
      }

      // Stream live to TelemetryEventBus with experiment correlation
      this.eventBus.publish(deviceEvent, experimentId);
    });

    let capabilityResult: CapabilityResult | undefined;
    let executionError: unknown = undefined;
    let isAborted = false;

    try {
      capabilityResult = await adapter.executeCapability(
        capabilityName,
        parameters,
        signal
      );
    } catch (err: any) {
      executionError = err;
      if (
        signal?.aborted ||
        err?.name === "AbortError" ||
        /abort/i.test(err?.message || "")
      ) {
        isAborted = true;
      }
    } finally {
      // Guaranteed teardown: unsubscribe immediately so zero listeners leak
      unsubscribe();
    }

    const completedAt = Date.now();
    let status: ExperimentStatus = "completed";

    if (isAborted) {
      status = "aborted";
    } else if (executionError) {
      status = "failed";
    }

    const summary = this.synthesizeSummary({
      experimentId,
      capabilityName,
      status,
      parameters,
      capabilityResult,
      voltageSamples,
      resetEvents,
      message: isAborted
        ? "Experiment execution aborted"
        : executionError
        ? (executionError as Error)?.message || "Experiment failed"
        : (capabilityResult?.data as { message?: string })?.message,
    });

    const record: ExperimentRecord = {
      metadata: {
        id: experimentId,
        capability: capabilityName,
        startedAt,
        completedAt,
        status,
        parameters,
      },
      events,
      traces: {
        supply_voltage: {
          channel: "supply_voltage",
          unit: "V",
          samples: voltageSamples,
        },
      },
      summary,
    };

    // Save full trace & event record in local experiment store
    this.store.save(record);

    if (executionError) {
      throw executionError;
    }

    return summary;
  }

  private synthesizeSummary(params: {
    experimentId: string;
    capabilityName: string;
    status: ExperimentStatus;
    parameters: Record<string, unknown>;
    capabilityResult?: CapabilityResult;
    voltageSamples: readonly NumericSample[];
    resetEvents: readonly ResetEvent[];
    message?: string;
  }): ExperimentSummary {
    const {
      experimentId,
      capabilityName,
      status,
      parameters,
      capabilityResult,
      voltageSamples,
      resetEvents,
      message,
    } = params;

    const repetitions =
      typeof parameters.cycles === "number"
        ? parameters.cycles
        : typeof parameters.repetitions === "number"
        ? parameters.repetitions
        : 3;

    // Reset causes histogram
    const reset_reasons: Record<string, number> = {};
    for (const r of resetEvents) {
      reset_reasons[r.reason] = (reset_reasons[r.reason] || 0) + 1;
    }

    const unexpected_resets = resetEvents.length;
    const failures = resetEvents.filter((r) => r.reason === "BROWNOUT").length;

    // Compute voltage metrics
    const baseline_v =
      typeof (capabilityResult?.data as any)?.baselineVoltage === "number"
        ? (capabilityResult!.data as any).baselineVoltage
        : voltageSamples.length > 0
        ? voltageSamples[0].value
        : 3.31;

    const minimum_v =
      typeof (capabilityResult?.data as any)?.minVoltage === "number"
        ? (capabilityResult!.data as any).minVoltage
        : voltageSamples.length > 0
        ? Math.min(...voltageSamples.map((s) => s.value))
        : 3.31;

    const drop_v = Math.round((baseline_v - minimum_v) * 100) / 100;

    const supply_voltage: VoltageSummary = {
      baseline_v,
      minimum_v,
      drop_v,
    };

    const faultReproduced =
      (capabilityResult?.data as any)?.faultReproduced ??
      (resetEvents.length > 0 && resetEvents.some((r) => r.reason === "BROWNOUT"));

    const resetOccurred =
      (capabilityResult?.data as any)?.resetOccurred ?? (resetEvents.length > 0);

    const resetReason =
      (capabilityResult?.data as any)?.resetReason ??
      (resetEvents.length > 0 ? resetEvents[0].reason : undefined);

    const cyclesCompleted =
      (capabilityResult?.data as any)?.cyclesCompleted ??
      (status === "completed" && !resetOccurred ? repetitions : 0);

    const success =
      (capabilityResult?.data as any)?.success ??
      (status === "completed" && !resetOccurred);

    return {
      experiment_id: experimentId,
      status,
      test: capabilityName,
      repetitions,
      failures: failures > 0 ? failures : unexpected_resets,
      unexpected_resets,
      reset_reasons,
      supply_voltage,
      // Backward-compatible fields
      success,
      faultReproduced,
      resetOccurred,
      resetReason,
      minVoltage: minimum_v,
      baselineVoltage: baseline_v,
      cyclesCompleted,
      message: message || (success ? "Experiment completed successfully." : "Experiment fault observed."),
    };
  }
}
