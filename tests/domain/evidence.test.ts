import { describe, expect, it } from "bun:test";
import {
  formatEvidenceId,
  parseEvidenceIdSequence,
  type EvidenceRecord,
  type EvidenceSource,
  type EvidenceType,
  type EvidenceProvenance,
} from "../../src/domain/evidence/types";
import {
  EvidenceStore,
  InMemoryEvidenceStore,
  createHumanObservation,
} from "../../src/domain/evidence/store";

describe("Evidence Domain Model & Types", () => {
  it("formats and parses compact human-readable evidence IDs", () => {
    expect(formatEvidenceId(1)).toBe("E-001");
    expect(formatEvidenceId(2)).toBe("E-002");
    expect(formatEvidenceId(42)).toBe("E-042");
    expect(formatEvidenceId(100)).toBe("E-100");
    expect(formatEvidenceId(1234)).toBe("E-1234");

    expect(parseEvidenceIdSequence("E-001")).toBe(1);
    expect(parseEvidenceIdSequence("E-042")).toBe(42);
    expect(parseEvidenceIdSequence("E-1234")).toBe(1234);
    expect(parseEvidenceIdSequence("invalid")).toBeNull();
  });

  it("preserves evidence types, experiment correlation, and provenance", () => {
    const provenance: EvidenceProvenance = {
      origin: "virtual_device",
      experimentId: "exp_12345",
      capability: "run_relay_stress_test",
    };

    const record: EvidenceRecord = {
      id: "E-001",
      type: "reset_event",
      summary: "Reset reason was BROWNOUT",
      createdAt: 1700000000000,
      experimentId: "exp_12345",
      sourceTool: "run_relay_stress_test",
      source: "experiment",
      data: {
        reason: "BROWNOUT",
        resetCount: 1,
      },
      provenance,
    };

    expect(record.id).toBe("E-001");
    expect(record.type).toBe("reset_event");
    expect(record.summary).toBe("Reset reason was BROWNOUT");
    expect(record.experimentId).toBe("exp_12345");
    expect(record.source).toBe("experiment");
    expect(record.provenance.origin).toBe("virtual_device");
    expect(record.provenance.capability).toBe("run_relay_stress_test");
  });

  it("distinguishes device evidence from human observations", () => {
    const deviceRecord: EvidenceRecord = {
      id: "E-001",
      type: "measurement",
      summary: "Minimum MCU supply during experiment: 2.72 V",
      createdAt: Date.now(),
      experimentId: "exp_001",
      sourceTool: "run_relay_stress_test",
      source: "device",
      data: { voltage_v: 2.72 },
      provenance: {
        origin: "virtual_device",
        experimentId: "exp_001",
        capability: "run_relay_stress_test",
      },
    };

    const humanRecord = createHumanObservation({
      id: "E-002",
      summary: "Relay VCC was connected to 3.3 V rail",
      data: { jumper_position: "3V3" },
      notes: "Visual inspection of jumper header J1",
    });

    expect(deviceRecord.source).toBe("device");
    expect(deviceRecord.provenance.origin).toBe("virtual_device");

    expect(humanRecord.source).toBe("human");
    expect(humanRecord.provenance.origin).toBe("human");
    expect(humanRecord.type).toBe("human_observation");
    expect(humanRecord.summary).toBe("Relay VCC was connected to 3.3 V rail");
  });
});

describe("Immutable EvidenceStore", () => {
  it("stores and retrieves evidence records in insertion order", () => {
    const store = new InMemoryEvidenceStore();

    const e1: EvidenceRecord = {
      id: "E-001",
      type: "measurement",
      summary: "Baseline supply: 3.31 V",
      createdAt: 1000,
      experimentId: "exp_1",
      source: "experiment",
      data: { voltage_v: 3.31 },
      provenance: { origin: "virtual_device", experimentId: "exp_1" },
    };

    const e2: EvidenceRecord = {
      id: "E-002",
      type: "reset_event",
      summary: "Reset reason: BROWNOUT",
      createdAt: 1050,
      experimentId: "exp_1",
      source: "experiment",
      data: { reason: "BROWNOUT" },
      provenance: { origin: "virtual_device", experimentId: "exp_1" },
    };

    const e3: EvidenceRecord = {
      id: "E-003",
      type: "human_observation",
      summary: "Relay power trace warm to touch",
      createdAt: 1100,
      source: "human",
      data: { tactile: "warm" },
      provenance: { origin: "human" },
    };

    store.add(e1);
    store.add(e2);
    store.add(e3);

    expect(store.count()).toBe(3);
    expect(store.get("E-001")?.summary).toBe("Baseline supply: 3.31 V");
    expect(store.get("E-002")?.summary).toBe("Reset reason: BROWNOUT");
    expect(store.get("E-003")?.summary).toBe("Relay power trace warm to touch");
    expect(store.get("E-999")).toBeUndefined();

    const all = store.getAll();
    expect(all.length).toBe(3);
    expect(all.map((e) => e.id)).toEqual(["E-001", "E-002", "E-003"]);

    const exp1Records = store.getByExperiment("exp_1");
    expect(exp1Records.length).toBe(2);
    expect(exp1Records.map((e) => e.id)).toEqual(["E-001", "E-002"]);
  });

  it("allocates monotonic sequential IDs when creating or adding without explicit ID", () => {
    const store = new InMemoryEvidenceStore();

    const record1 = store.createAndAdd({
      type: "measurement",
      summary: "Measurement 1",
      source: "device",
      data: { val: 1 },
      provenance: { origin: "virtual_device" },
    });

    const record2 = store.createAndAdd({
      type: "measurement",
      summary: "Measurement 2",
      source: "device",
      data: { val: 2 },
      provenance: { origin: "virtual_device" },
    });

    expect(record1.id).toBe("E-001");
    expect(record2.id).toBe("E-002");
    expect(store.nextEvidenceId()).toBe("E-003");
  });

  it("rejects duplicate evidence IDs to prevent overwriting canonical records", () => {
    const store = new InMemoryEvidenceStore();

    const e1: EvidenceRecord = {
      id: "E-001",
      type: "measurement",
      summary: "Measurement 1",
      createdAt: 1000,
      source: "device",
      data: { val: 1 },
      provenance: { origin: "virtual_device" },
    };

    store.add(e1);

    const duplicate: EvidenceRecord = {
      id: "E-001",
      type: "measurement",
      summary: "Mutated Measurement",
      createdAt: 2000,
      source: "device",
      data: { val: 999 },
      provenance: { origin: "virtual_device" },
    };

    expect(() => store.add(duplicate)).toThrow(/already exists/i);
    expect(store.get("E-001")?.summary).toBe("Measurement 1");
  });

  it("does not expose update, edit, or replace methods on public API", () => {
    const store = new InMemoryEvidenceStore() as unknown as Record<string, unknown>;
    expect(store.updateEvidence).toBeUndefined();
    expect(store.editEvidence).toBeUndefined();
    expect(store.replaceEvidence).toBeUndefined();
    expect(store.update).toBeUndefined();
    expect(store.delete).toBeUndefined();
  });

  it("enforces runtime immutability via deep freeze on stored and returned records", () => {
    const store = new InMemoryEvidenceStore();

    const dataObj = { nested: { voltage: 2.72 } };
    const provObj = { origin: "virtual_device" as const, details: { sim: true } };

    const originalRecord: EvidenceRecord = {
      id: "E-001",
      type: "measurement",
      summary: "Minimum supply: 2.72 V",
      createdAt: 1000,
      source: "device",
      data: dataObj,
      provenance: provObj,
    };

    const added = store.add(originalRecord);
    const retrieved = store.get("E-001")!;

    // Runtime mutation attempts on record properties should throw TypeError in strict mode
    expect(() => {
      // @ts-expect-error - testing runtime immutability
      retrieved.summary = "Tampered summary";
    }).toThrow();

    expect(() => {
      (retrieved.data as any).nested.voltage = 9.99;
    }).toThrow();
    expect(() => {
      // @ts-expect-error - testing runtime immutability
      retrieved.type = "human_observation";
    }).toThrow();

    // Verify canonical store copy was not altered
    const freshGet = store.get("E-001")!;
    expect(freshGet.summary).toBe("Minimum supply: 2.72 V");
    expect((freshGet.data as { nested: { voltage: number } }).nested.voltage).toBe(2.72);
  });

  it("notifies subscribers upon adding new evidence", () => {
    const store = new InMemoryEvidenceStore();
    const observed: EvidenceRecord[] = [];

    const unsubscribe = store.subscribe((record) => {
      observed.push(record);
    });

    store.createAndAdd({
      type: "measurement",
      summary: "Observed supply 3.3V",
      source: "device",
      data: { v: 3.3 },
      provenance: { origin: "virtual_device" },
    });

    expect(observed.length).toBe(1);
    expect(observed[0].id).toBe("E-001");

    unsubscribe();

    store.createAndAdd({
      type: "measurement",
      summary: "Observed supply 2.8V",
      source: "device",
      data: { v: 2.8 },
      provenance: { origin: "virtual_device" },
    });

    expect(observed.length).toBe(1);
    expect(store.count()).toBe(2);
  });
});
