import { describe, expect, it } from "bun:test";
import { InMemoryEvidenceStore } from "@/domain/evidence/store";
import { InMemoryHypothesisStore } from "@/domain/hypothesis/store";

describe("post-repair verification gate", () => {
  it("rejects confirmation when the claimed verification experiment has no successful retest evidence", () => {
    const evidence = new InMemoryEvidenceStore();
    const failed = evidence.createAndAdd({
      type: "test_result",
      summary: "Reset occurred during cycle 1 of requested 3 cycles",
      experimentId: "exp_fault",
      sourceTool: "run_relay_stress_test",
      source: "experiment",
      provenance: { origin: "virtual_device", experimentId: "exp_fault" },
      data: { requestedCycles: 3, completedCycles: 0, unexpectedResets: 1 },
    });
    const hypothesisStore = new InMemoryHypothesisStore(evidence);
    const hypothesis = hypothesisStore.create({
      title: "Shared-rail brownout",
      description: "Relay inrush collapses the MCU rail.",
      confidence: "MEDIUM",
      initialEvidenceLinks: [{ evidenceId: failed.id, relationship: "SUPPORTS" }],
    });
    hypothesisStore.updateConfidence({
      hypothesisId: hypothesis.id,
      confidence: "HIGH",
      evidenceIds: [failed.id],
      reason: "The failing stress test supports the suspected shared-rail fault.",
    });

    expect(() => hypothesisStore.confirm({
      hypothesisId: hypothesis.id,
      rationale: "The repair is claimed to be verified.",
      evidenceIds: [failed.id],
      verifiedExperimentId: "exp_missing_retest",
    })).toThrow(/successful post-intervention verification evidence/i);
  });
});
