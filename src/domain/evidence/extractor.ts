/**
 * Evidence Extractor Subsystem.
 * Converts completed, aborted, or failed ExperimentRecords into immutable,
 * factual EvidenceRecord items.
 *
 * Invariants:
 * 1. ONLY extracts objective observations ("WHAT HAPPENED").
 * 2. NEVER generates causal interpretations, diagnoses, or hypotheses ("WHAT WE THINK IT MEANS").
 * 3. Preserves precise cycle counts and reset timing.
 * 4. Captures partial facts from aborted or failed experiments with explicit status provenance.
 */

import type { ExperimentRecord } from "../experiment/types";
import type { EvidenceProvenance, EvidenceRecord, EvidenceType } from "./types";
import type { EvidenceStore, CreateEvidenceParams } from "./store";

export class EvidenceExtractor {
  /**
   * Analyzes an ExperimentRecord and extracts a list of factual evidence specifications.
   */
  public extract(record: ExperimentRecord): CreateEvidenceParams[] {
    const results: CreateEvidenceParams[] = [];
    const metadata = record.metadata;
    const summary = record.summary;
    const events = record.events ?? [];
    const traces = record.traces ?? {};

    const experimentId = metadata.id;
    const capability = metadata.capability;
    const isVirtual = true; // Virtual device in current workbench
    const origin = isVirtual ? ("virtual_device" as const) : ("physical_device" as const);

    const baseProvenance: EvidenceProvenance = {
      origin,
      experimentId,
      capability,
      toolName: capability,
      experimentStatus: metadata.status,
    };

    // 1. Reset Events
    const resetEvents = events.filter((e) => e.event.type === "reset");
    const resetReasonsSummary = summary?.reset_reasons ?? {};
    const recordedReasons = new Set<string>();

    if (resetEvents.length > 0) {
      for (const re of resetEvents) {
        if (re.event.type === "reset") {
          const reason = re.event.reason || "UNKNOWN";
          if (!recordedReasons.has(reason)) {
            recordedReasons.add(reason);
            results.push({
              type: "reset_event",
              summary: `Reset reason: ${reason}`,
              createdAt: re.timestamp,
              experimentId,
              sourceTool: capability,
              source: "experiment",
              data: {
                reason,
                timestamp: re.timestamp,
              },
              provenance: {
                ...baseProvenance,
                eventTimestamp: re.timestamp,
              },
            });
          }
        }
      }
    } else if (Object.keys(resetReasonsSummary).length > 0) {
      for (const [reason, count] of Object.entries(resetReasonsSummary)) {
        if (count > 0 && !recordedReasons.has(reason)) {
          recordedReasons.add(reason);
          results.push({
            type: "reset_event",
            summary: `Reset reason: ${reason}`,
            createdAt: metadata.completedAt ?? Date.now(),
            experimentId,
            sourceTool: capability,
            source: "experiment",
            data: {
              reason,
              count,
            },
            provenance: baseProvenance,
          });
        }
      }
    }

    // 2. Voltage Measurements (Minimum supply & Drop)
    let minV: number | undefined;
    let baselineV: number | undefined;
    let dropV: number | undefined;

    if (summary?.supply_voltage) {
      minV = summary.supply_voltage.minimum_v;
      baselineV = summary.supply_voltage.baseline_v;
      dropV = summary.supply_voltage.drop_v;
    } else if (traces.rail_voltage && traces.rail_voltage.samples.length > 0) {
      const samples = traces.rail_voltage.samples;
      baselineV = samples[0].value;
      minV = Math.min(...samples.map((s) => s.value));
      dropV = baselineV - minV;
    }

    if (typeof minV === "number" && Number.isFinite(minV)) {
      results.push({
        type: "measurement",
        summary: `Minimum MCU supply during experiment: ${minV.toFixed(2)} V`,
        createdAt: metadata.completedAt ?? Date.now(),
        experimentId,
        sourceTool: capability,
        source: "device",
        data: {
          metric: "supply_voltage_min",
          value: minV,
          unit: "V",
          baseline: baselineV,
        },
        provenance: baseProvenance,
      });

      if (typeof dropV === "number" && Number.isFinite(dropV) && dropV > 0.05) {
        results.push({
          type: "measurement",
          summary: `Supply drop from baseline: ${dropV.toFixed(2)} V`,
          createdAt: metadata.completedAt ?? Date.now(),
          experimentId,
          sourceTool: capability,
          source: "device",
          data: {
            metric: "supply_voltage_drop",
            value: dropV,
            baseline: baselineV,
            minimum: minV,
            unit: "V",
          },
          provenance: baseProvenance,
        });
      }
    }

    // 3. Test Execution & Cycle Results (Factual precision)
    const requestedCycles = (summary?.requested_cycles as number | undefined) ??
      (metadata.parameters.cycles as number | undefined) ??
      (summary?.repetitions as number | undefined);

    const completedCycles = (summary?.completed_cycles as number | undefined) ?? 0;
    const cycleOfReset = summary?.cycle_of_reset as number | undefined;

    if (metadata.status === "aborted") {
      const durationMs = (metadata.completedAt ?? Date.now()) - metadata.startedAt;
      results.push({
        type: "test_result",
        summary: `Experiment aborted after ${durationMs} ms (status: aborted)`,
        createdAt: metadata.completedAt ?? Date.now(),
        experimentId,
        sourceTool: capability,
        source: "experiment",
        data: {
          status: "aborted",
          durationMs,
        },
        provenance: baseProvenance,
      });
    } else if (metadata.status === "failed") {
      results.push({
        type: "test_result",
        summary: `Experiment execution failed (status: failed)`,
        createdAt: metadata.completedAt ?? Date.now(),
        experimentId,
        sourceTool: capability,
        source: "experiment",
        data: {
          status: "failed",
        },
        provenance: baseProvenance,
      });
    } else if (typeof requestedCycles === "number" && requestedCycles > 0) {
      if (typeof cycleOfReset === "number" || (summary?.unexpected_resets as number) > 0) {
        const resetCycle = cycleOfReset ?? 1;
        results.push({
          type: "test_result",
          summary: `Reset occurred during cycle ${resetCycle} of requested ${requestedCycles} cycles (completed: ${completedCycles})`,
          createdAt: metadata.completedAt ?? Date.now(),
          experimentId,
          sourceTool: capability,
          source: "experiment",
          data: {
            requestedCycles,
            completedCycles,
            cycleOfReset: resetCycle,
            unexpectedResets: summary?.unexpected_resets ?? 1,
          },
          provenance: baseProvenance,
        });
      } else if (completedCycles >= requestedCycles) {
        results.push({
          type: "test_result",
          summary: `${completedCycles} of ${requestedCycles} requested cycles completed without resets`,
          createdAt: metadata.completedAt ?? Date.now(),
          experimentId,
          sourceTool: capability,
          source: "experiment",
          data: {
            requestedCycles,
            completedCycles,
            unexpectedResets: 0,
          },
          provenance: baseProvenance,
        });
      }
    }

    // 4. Sequence Timing Facts (ONLY if verified in events)
    const relayEvent = events.find((e) => e.event.type === "relay_state" && (e.event as { state?: string }).state === "closed");
    const firstReset = events.find((e) => e.event.type === "reset");

    if (relayEvent && firstReset && relayEvent.timestamp <= firstReset.timestamp) {
      const deltaMs = firstReset.timestamp - relayEvent.timestamp;
      results.push({
        type: "test_result",
        summary: `Relay activation occurred before the reset (${deltaMs} ms prior)`,
        createdAt: firstReset.timestamp,
        experimentId,
        sourceTool: capability,
        source: "experiment",
        data: {
          relayTimestamp: relayEvent.timestamp,
          resetTimestamp: firstReset.timestamp,
          deltaMs,
        },
        provenance: {
          ...baseProvenance,
          relayTimestamp: relayEvent.timestamp,
          resetTimestamp: firstReset.timestamp,
        },
      });
    }

    return results;
  }

  /**
   * Extracts evidence from the given ExperimentRecord and appends each to the EvidenceStore.
   * Returns the newly created immutable EvidenceRecord array.
   */
  public extractAndStore(
    record: ExperimentRecord,
    store: EvidenceStore
  ): Readonly<EvidenceRecord>[] {
    const items = this.extract(record);
    const created: Readonly<EvidenceRecord>[] = [];
    for (const item of items) {
      const record = store.createAndAdd(item);
      created.push(record);
    }
    return created;
  }
}
