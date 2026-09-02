import { describe, expect, it } from "bun:test";
import type { ExperimentRecord, ExperimentSummary } from "../../src/domain/experiment/types";
import { EvidenceExtractor } from "../../src/domain/evidence/extractor";
import { InMemoryEvidenceStore } from "../../src/domain/evidence/store";

describe("EvidenceExtractor", () => {
  it("extracts factual evidence from a brownout relay stress test record", () => {
    const experimentId = "exp_brownout_001";
    const startTime = 1000;
    const completedTime = 1050;

    const summary: ExperimentSummary = {
      experiment_id: experimentId,
      status: "completed",
      test: "run_relay_stress_test",
      requested_cycles: 3,
      completed_cycles: 0,
      cycle_of_reset: 1,
      unexpected_resets: 1,
      reset_reasons: { BROWNOUT: 1 },
      supply_voltage: {
        baseline_v: 3.31,
        minimum_v: 2.72,
        drop_v: 0.59,
      },
    };

    const record: ExperimentRecord = {
      metadata: {
        id: experimentId,
        capability: "run_relay_stress_test",
        startedAt: startTime,
        completedAt: completedTime,
        status: "completed",
        parameters: { cycles: 3, interval_ms: 100 },
      },
      events: [
        {
          experimentId,
          timestamp: 1005,
          event: {
            type: "relay_state",
            state: "closed",
            pin: 21,
            timestamp: 1005,
          },
        },
        {
          experimentId,
          timestamp: 1030,
          event: {
            type: "reset",
            reason: "BROWNOUT",
            timestamp: 1030,
          },
        },
      ],
      traces: {
        rail_voltage: {
          channel: "rail_voltage",
          unit: "V",
          samples: [
            { tMs: 0, value: 3.31 },
            { tMs: 10, value: 3.20 },
            { tMs: 25, value: 2.72 },
            { tMs: 30, value: 3.30 },
          ],
        },
      },
      summary,
    };

    const store = new InMemoryEvidenceStore();
    const extractor = new EvidenceExtractor();

    const extracted = extractor.extractAndStore(record, store);

    expect(extracted.length).toBeGreaterThanOrEqual(4);

    const summaries = extracted.map((e) => e.summary);
    const types = extracted.map((e) => e.type);

    // 1. Reset event fact
    expect(types).toContain("reset_event");
    const resetEvidence = extracted.find((e) => e.type === "reset_event");
    expect(resetEvidence?.summary).toContain("BROWNOUT");
    expect(resetEvidence?.summary).toMatch(/reset reason:\s*BROWNOUT/i);

    // 2. Minimum voltage measurement fact
    const minVEvidence = extracted.find(
      (e) => e.type === "measurement" && e.summary.toLowerCase().includes("minimum")
    );
    expect(minVEvidence).toBeDefined();
    expect(minVEvidence?.summary).toContain("2.72 V");

    // 3. Voltage drop measurement fact
    const dropEvidence = extracted.find(
      (e) => e.type === "measurement" && e.summary.toLowerCase().includes("drop")
    );
    expect(dropEvidence).toBeDefined();
    expect(dropEvidence?.summary).toContain("0.59 V");

    // 4. Test termination & cycle precision fact
    const testResultEvidence = extracted.find(
      (e) => e.type === "test_result" && e.summary.toLowerCase().includes("cycle")
    );
    expect(testResultEvidence).toBeDefined();
    expect(testResultEvidence?.summary).toContain("cycle 1");
    expect(testResultEvidence?.summary).toContain("3");

    // 5. Sequence timing fact (Relay activated before reset)
    const timingEvidence = extracted.find((e) =>
      e.summary.toLowerCase().includes("relay") && e.summary.toLowerCase().includes("before")
    );
    expect(timingEvidence).toBeDefined();

    // Verify all records have correlation and provenance
    for (const item of extracted) {
      expect(item.experimentId).toBe(experimentId);
      expect(item.sourceTool).toBe("run_relay_stress_test");
      expect(item.provenance.experimentId).toBe(experimentId);
      expect(item.provenance.origin).toBe("virtual_device");
    }
  });

  it("strictly prohibits diagnostic interpretations or hypothesis synthesis", () => {
    const experimentId = "exp_interpret_check";
    const record: ExperimentRecord = {
      metadata: {
        id: experimentId,
        capability: "run_relay_stress_test",
        startedAt: 1000,
        completedAt: 1050,
        status: "completed",
        parameters: {},
      },
      events: [
        {
          experimentId,
          timestamp: 1030,
          event: { type: "reset", reason: "BROWNOUT", timestamp: 1030 },
        },
      ],
      traces: {},
      summary: {
        experiment_id: experimentId,
        status: "completed",
        test: "run_relay_stress_test",
        unexpected_resets: 1,
        reset_reasons: { BROWNOUT: 1 },
        supply_voltage: {
          baseline_v: 3.3,
          minimum_v: 2.72,
          drop_v: 0.58,
        },
      },
    };

    const store = new InMemoryEvidenceStore();
    const extractor = new EvidenceExtractor();
    const extracted = extractor.extractAndStore(record, store);

    const forbiddenPhrases = [
      "caused",
      "root cause",
      "bad jumper",
      "wrong wiring",
      "move jumper",
      "power instability",
      "therefore",
      "faulty",
      "hypothesis",
      "confidence",
      "recommend",
      "fix",
    ];

    for (const item of extracted) {
      const lower = item.summary.toLowerCase();
      for (const phrase of forbiddenPhrases) {
        expect(lower).not.toContain(phrase);
      }
    }
  });

  it("protects factual precision: reports exact cycle counts and never manufactures false failure counts", () => {
    const experimentId = "exp_precision_001";
    const record: ExperimentRecord = {
      metadata: {
        id: experimentId,
        capability: "run_relay_stress_test",
        startedAt: 1000,
        completedAt: 1030,
        status: "completed",
        parameters: { cycles: 5 },
      },
      events: [],
      traces: {},
      summary: {
        experiment_id: experimentId,
        status: "completed",
        test: "run_relay_stress_test",
        requested_cycles: 5,
        completed_cycles: 0,
        cycle_of_reset: 1,
        unexpected_resets: 1,
        reset_reasons: { BROWNOUT: 1 },
      },
    };

    const store = new InMemoryEvidenceStore();
    const extractor = new EvidenceExtractor();
    const extracted = extractor.extractAndStore(record, store);

    const cycleEvidence = extracted.find((e) => e.type === "test_result");
    expect(cycleEvidence).toBeDefined();

    // MUST NOT claim "5/5 failed" or "5 failures"
    expect(cycleEvidence?.summary).not.toContain("5/5");
    expect(cycleEvidence?.summary).not.toContain("5 failures");
    expect(cycleEvidence?.summary).not.toContain("5 tests failed");

    // MUST accurately state reset occurred during cycle 1 (requested 5, completed 0)
    expect(cycleEvidence?.summary).toMatch(/cycle 1/i);
    expect(cycleEvidence?.summary).toMatch(/5/);
  });

  it("extracts factual evidence from aborted experiments", () => {
    const experimentId = "exp_aborted_001";
    const record: ExperimentRecord = {
      metadata: {
        id: experimentId,
        capability: "run_relay_stress_test",
        startedAt: 1000,
        completedAt: 1412,
        status: "aborted",
        parameters: { cycles: 10 },
      },
      events: [],
      traces: {
        rail_voltage: {
          channel: "rail_voltage",
          unit: "V",
          samples: [
            { tMs: 0, value: 3.3 },
            { tMs: 100, value: 3.15 },
            { tMs: 400, value: 3.09 },
          ],
        },
      },
      summary: {
        experiment_id: experimentId,
        status: "aborted",
        test: "run_relay_stress_test",
        supply_voltage: {
          baseline_v: 3.3,
          minimum_v: 3.09,
          drop_v: 0.21,
        },
      },
    };

    const store = new InMemoryEvidenceStore();
    const extractor = new EvidenceExtractor();
    const extracted = extractor.extractAndStore(record, store);

    expect(extracted.length).toBeGreaterThanOrEqual(2);

    const abortEvidence = extracted.find((e) => e.summary.toLowerCase().includes("aborted"));
    expect(abortEvidence).toBeDefined();
    expect(abortEvidence?.type).toBe("test_result");
    expect(abortEvidence?.summary).toContain("aborted");
    expect(abortEvidence?.summary).toContain("412 ms");

    const minVEvidence = extracted.find((e) => e.summary.includes("3.09 V"));
    expect(minVEvidence).toBeDefined();
    expect(minVEvidence?.type).toBe("measurement");

    // All records should reflect aborted status in provenance/data
    for (const item of extracted) {
      expect(item.provenance.experimentStatus).toBe("aborted");
    }
  });

  it("extracts factual evidence from nominal non-reset experiments", () => {
    const experimentId = "exp_nominal_001";
    const record: ExperimentRecord = {
      metadata: {
        id: experimentId,
        capability: "run_relay_stress_test",
        startedAt: 1000,
        completedAt: 1500,
        status: "completed",
        parameters: { cycles: 3 },
      },
      events: [],
      traces: {
        rail_voltage: {
          channel: "rail_voltage",
          unit: "V",
          samples: [
            { tMs: 0, value: 3.32 },
            { tMs: 500, value: 3.28 },
          ],
        },
      },
      summary: {
        experiment_id: experimentId,
        status: "completed",
        test: "run_relay_stress_test",
        requested_cycles: 3,
        completed_cycles: 3,
        unexpected_resets: 0,
        supply_voltage: {
          baseline_v: 3.32,
          minimum_v: 3.28,
          drop_v: 0.04,
        },
      },
    };

    const store = new InMemoryEvidenceStore();
    const extractor = new EvidenceExtractor();
    const extracted = extractor.extractAndStore(record, store);

    const testSummary = extracted.find((e) => e.type === "test_result");
    expect(testSummary).toBeDefined();
    expect(testSummary?.summary).toContain("3 of 3 requested cycles completed");

    const minV = extracted.find((e) => e.summary.includes("3.28 V"));
    expect(minV).toBeDefined();
  });
});
