/**
 * Slice 3A: Experiment Domain Model & Store Unit Tests.
 */

import { describe, it, expect, beforeEach } from "bun:test";
import {
  generateExperimentId,
  type ExperimentMetadata,
  type ExperimentRecord,
  type ExperimentStatus,
  InMemoryExperimentStore,
} from "@/domain/experiment";

describe("Slice 3A: Experiment Domain Model & Store", () => {
  let store: InMemoryExperimentStore;

  beforeEach(() => {
    store = new InMemoryExperimentStore();
  });

  it("generates unique experiment IDs with exp_ prefix", () => {
    const id1 = generateExperimentId();
    const id2 = generateExperimentId();

    expect(id1.startsWith("exp_")).toBe(true);
    expect(id2.startsWith("exp_")).toBe(true);
    expect(id1).not.toBe(id2);
  });

  it("records valid experiment metadata and status transitions", () => {
    const id = generateExperimentId();
    const startedAt = Date.now();

    const runningMetadata: ExperimentMetadata = {
      id,
      capability: "run_relay_stress_test",
      startedAt,
      status: "running",
      parameters: { cycles: 3, duration_ms: 100 },
    };

    expect(runningMetadata.status).toBe("running");
    expect(runningMetadata.completedAt).toBeUndefined();

    // Transition to completed
    const completedAt = startedAt + 150;
    const completedMetadata: ExperimentMetadata = {
      ...runningMetadata,
      status: "completed",
      completedAt,
    };

    expect(completedMetadata.status).toBe("completed");
    expect(completedMetadata.completedAt).toBe(completedAt);
    expect(completedMetadata.completedAt).toBeGreaterThanOrEqual(completedMetadata.startedAt);
  });

  it("aborted experiment stays strictly distinguishable from failed experiment", () => {
    const idAborted = generateExperimentId();
    const idFailed = generateExperimentId();

    const abortedRecord: ExperimentRecord = {
      metadata: {
        id: idAborted,
        capability: "run_relay_stress_test",
        startedAt: 1000,
        completedAt: 1050,
        status: "aborted",
        parameters: { cycles: 10 },
      },
      events: [],
      traces: {},
      summary: {
        experiment_id: idAborted,
        status: "aborted",
        test: "run_relay_stress_test",
        message: "Experiment aborted by user",
      },
    };

    const failedRecord: ExperimentRecord = {
      metadata: {
        id: idFailed,
        capability: "run_relay_stress_test",
        startedAt: 1000,
        completedAt: 1100,
        status: "failed",
        parameters: { cycles: 10 },
      },
      events: [],
      traces: {},
      summary: {
        experiment_id: idFailed,
        status: "failed",
        test: "run_relay_stress_test",
        message: "Hardware error during execution",
      },
    };

    store.save(abortedRecord);
    store.save(failedRecord);

    expect(store.getExperiment(idAborted)?.metadata.status).toBe("aborted");
    expect(store.getExperiment(idFailed)?.metadata.status).toBe("failed");
    expect(store.getExperiment(idAborted)?.metadata.status).not.toBe(
      store.getExperiment(idFailed)?.metadata.status
    );
  });

  it("in-memory store saves, retrieves by id, returns all experiments in insertion order, and retrieves latest", () => {
    expect(store.count()).toBe(0);
    expect(store.latest()).toBeUndefined();
    expect(store.getExperiments()).toEqual([]);

    const id1 = generateExperimentId();
    const record1: ExperimentRecord = {
      metadata: {
        id: id1,
        capability: "read_device_info",
        startedAt: 100,
        completedAt: 110,
        status: "completed",
        parameters: {},
      },
      events: [],
      traces: {},
    };

    const id2 = generateExperimentId();
    const record2: ExperimentRecord = {
      metadata: {
        id: id2,
        capability: "run_relay_stress_test",
        startedAt: 200,
        completedAt: 300,
        status: "completed",
        parameters: { cycles: 3 },
      },
      events: [],
      traces: {
        supply_voltage: {
          channel: "supply_voltage",
          unit: "V",
          samples: [
            { tMs: 0, value: 3.3 },
            { tMs: 10, value: 2.7 },
          ],
        },
      },
      summary: {
        experiment_id: id2,
        status: "completed",
        test: "run_relay_stress_test",
      },
    };

    store.save(record1);
    expect(store.count()).toBe(1);
    expect(store.getExperiment(id1)).toEqual(record1);
    expect(store.latest()?.metadata.id).toBe(id1);

    store.save(record2);
    expect(store.count()).toBe(2);
    expect(store.getExperiment(id2)).toEqual(record2);
    expect(store.latest()?.metadata.id).toBe(id2);

    const all = store.getExperiments();
    expect(all.length).toBe(2);
    expect(all[0].metadata.id).toBe(id1);
    expect(all[1].metadata.id).toBe(id2);

    // Update existing record
    const updatedRecord2: ExperimentRecord = {
      ...record2,
      summary: {
        ...record2.summary!,
        status: "completed",
        failures: 1,
      },
    };
    store.save(updatedRecord2);
    expect(store.count()).toBe(2);
    expect(store.getExperiment(id2)?.summary?.failures).toBe(1);

    store.clear();
    expect(store.count()).toBe(0);
    expect(store.latest()).toBeUndefined();
    expect(store.getExperiments()).toEqual([]);
  });
});
