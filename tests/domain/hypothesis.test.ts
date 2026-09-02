/**
 * Unit tests for Hypothesis Domain Model & Hypothesis Store (Milestone 6).
 */

import { describe, it, expect, beforeEach } from "bun:test";
import {
  InMemoryHypothesisStore,
  formatHypothesisId,
  parseHypothesisIdSequence,
  type Hypothesis,
} from "@/domain/hypothesis";
import { InMemoryEvidenceStore } from "@/domain/evidence/store";

describe("Hypothesis Domain Model & Store (Milestone 6)", () => {
  let evidenceStore: InMemoryEvidenceStore;
  let hypothesisStore: InMemoryHypothesisStore;

  beforeEach(() => {
    evidenceStore = new InMemoryEvidenceStore();
    hypothesisStore = new InMemoryHypothesisStore(evidenceStore);

    // Seed some factual evidence records
    evidenceStore.createAndAdd({
      type: "reset_event",
      summary: "Microcontroller reported BROWNOUT reset on power rail.",
      source: "device",
      data: { resetReason: "BROWNOUT", cycle: 1 },
      provenance: { origin: "virtual_device", toolName: "read_reset_history" },
    });

    evidenceStore.createAndAdd({
      type: "measurement",
      summary: "Supply rail dipped to minimum 2.72V during relay actuation.",
      source: "experiment",
      data: { minVoltage: 2.72, nominalVoltage: 3.3, vDrop: 0.58 },
      provenance: { origin: "virtual_device", toolName: "run_relay_stress_test" },
    });

    evidenceStore.createAndAdd({
      type: "measurement",
      summary: "Heap memory remained stable at 142.5 kB free.",
      source: "experiment",
      data: { freeHeapBytes: 142500, minFreeHeapBytes: 141200 },
      provenance: { origin: "virtual_device", toolName: "read_device_info" },
    });
  });

  describe("Slice 6A — ID Formatting & Domain Types", () => {
    it("formats sequential hypothesis IDs correctly", () => {
      expect(formatHypothesisId(1)).toBe("H-001");
      expect(formatHypothesisId(2)).toBe("H-002");
      expect(formatHypothesisId(99)).toBe("H-099");
      expect(formatHypothesisId(100)).toBe("H-100");
    });

    it("parses valid hypothesis IDs", () => {
      expect(parseHypothesisIdSequence("H-001")).toBe(1);
      expect(parseHypothesisIdSequence("H-042")).toBe(42);
      expect(parseHypothesisIdSequence("H-1000")).toBe(1000);
      expect(parseHypothesisIdSequence("E-001")).toBeNull();
      expect(parseHypothesisIdSequence("invalid")).toBeNull();
    });

    it("creates a hypothesis with UNTESTED, LOW, or MEDIUM initial confidence", () => {
      const h1 = hypothesisStore.create({
        title: "Relay-induced supply brownout",
        description: "Relay coil current draw causes 3.3V supply rail to collapse below 2.80V reset threshold.",
        confidence: "MEDIUM",
        rationale: "Initial voltage drop observed on power rail.",
        createdBy: "agent",
      });

      expect(h1.id).toBe("H-001");
      expect(h1.title).toBe("Relay-induced supply brownout");
      expect(h1.confidence).toBe("MEDIUM");
      expect(h1.status).toBe("ACTIVE");
      expect(h1.verificationStatus).toBe("NOT_VERIFIED");
      expect(h1.createdBy).toBe("agent");
      expect(h1.createdAt).toBeGreaterThan(0);
      expect(h1.updatedAt).toBeGreaterThan(0);
      expect(h1.evidenceLinks).toHaveLength(0);
      expect(h1.supportingEvidenceIds).toHaveLength(0);
      expect(h1.contradictingEvidenceIds).toHaveLength(0);
    });

    it("rejects initial confidence of HIGH or VERY_HIGH without prior evidence integration", () => {
      expect(() => {
        hypothesisStore.create({
          title: "Premature high confidence",
          description: "Hypothesis created with premature high confidence.",
          confidence: "HIGH",
        });
      }).toThrow(/Initial hypothesis confidence must be UNTESTED, LOW, or MEDIUM/);

      expect(() => {
        hypothesisStore.create({
          title: "Premature very high confidence",
          description: "Hypothesis created with premature very high confidence.",
          confidence: "VERY_HIGH",
        });
      }).toThrow(/Initial hypothesis confidence must be UNTESTED, LOW, or MEDIUM/);
    });

    it("validates title and description constraints", () => {
      expect(() => {
        hypothesisStore.create({
          title: "ab",
          description: "Valid description longer than 3 chars",
          confidence: "LOW",
        });
      }).toThrow(/Hypothesis title must be between 3 and 120 characters/);

      expect(() => {
        hypothesisStore.create({
          title: "Valid Title",
          description: "ab",
          confidence: "LOW",
        });
      }).toThrow(/Hypothesis description must be between 3 and 600 characters/);
    });
  });

  describe("Slice 6B & 6C — Store, Retrieval & Evidence Linking", () => {
    it("allows linking valid evidence records with relationships", () => {
      const h = hypothesisStore.create({
        title: "Relay-induced supply brownout",
        description: "Relay activation induces voltage drop causing brownout reset.",
        confidence: "LOW",
      });

      const updated1 = hypothesisStore.linkEvidence({
        hypothesisId: h.id,
        evidenceId: "E-001",
        relationship: "STRONGLY_SUPPORTS",
        note: "Device reported BROWNOUT reset cause during relay actuation.",
      });

      expect(updated1.evidenceLinks).toHaveLength(1);
      expect(updated1.evidenceLinks[0].evidenceId).toBe("E-001");
      expect(updated1.evidenceLinks[0].relationship).toBe("STRONGLY_SUPPORTS");
      expect(updated1.supportingEvidenceIds).toEqual(["E-001"]);
      expect(updated1.contradictingEvidenceIds).toEqual([]);

      const updated2 = hypothesisStore.linkEvidence({
        hypothesisId: h.id,
        evidenceId: "E-002",
        relationship: "SUPPORTS",
        note: "Measured rail dipped to 2.72V.",
      });

      expect(updated2.evidenceLinks).toHaveLength(2);
      expect(updated2.supportingEvidenceIds).toEqual(["E-001", "E-002"]);
    });

    it("rejects linking nonexistent evidence ID", () => {
      const h = hypothesisStore.create({
        title: "Relay-induced supply brownout",
        description: "Relay activation induces voltage drop causing brownout reset.",
        confidence: "LOW",
      });

      expect(() => {
        hypothesisStore.linkEvidence({
          hypothesisId: h.id,
          evidenceId: "E-999",
          relationship: "SUPPORTS",
        });
      }).toThrow(/EvidenceRecord "E-999" does not exist in EvidenceStore/);
    });

    it("deduplicates evidence links and updates relationship when relinked", () => {
      const h = hypothesisStore.create({
        title: "Relay-induced supply brownout",
        description: "Relay activation induces voltage drop causing brownout reset.",
        confidence: "LOW",
      });

      hypothesisStore.linkEvidence({
        hypothesisId: h.id,
        evidenceId: "E-001",
        relationship: "SUPPORTS",
        note: "Initial support note",
      });

      const updated = hypothesisStore.linkEvidence({
        hypothesisId: h.id,
        evidenceId: "E-001",
        relationship: "STRONGLY_SUPPORTS",
        note: "Upgraded to strong support",
      });

      expect(updated.evidenceLinks).toHaveLength(1);
      expect(updated.evidenceLinks[0].relationship).toBe("STRONGLY_SUPPORTS");
      expect(updated.evidenceLinks[0].note).toBe("Upgraded to strong support");
    });

    it("CRITICAL: EvidenceStore records remain completely unchanged and immutable", () => {
      const e1Before = evidenceStore.get("E-001");
      expect(e1Before).toBeDefined();

      const h = hypothesisStore.create({
        title: "Relay-induced supply brownout",
        description: "Relay activation induces voltage drop causing brownout reset.",
        confidence: "LOW",
      });

      hypothesisStore.linkEvidence({
        hypothesisId: h.id,
        evidenceId: "E-001",
        relationship: "STRONGLY_SUPPORTS",
      });

      const e1After = evidenceStore.get("E-001");
      expect(e1After).toEqual(e1Before);

      // Verify deep-freeze: attempting to mutate throws
      expect(() => {
        // @ts-expect-error - testing immutability
        e1After.summary = "Mutated summary";
      }).toThrow();
    });

    it("deep-freezes returned Hypothesis objects to prevent presentation corruption", () => {
      const h = hypothesisStore.create({
        title: "Test Hypothesis",
        description: "Testing immutability of hypothesis objects.",
        confidence: "LOW",
      });

      expect(() => {
        // @ts-expect-error - testing immutability
        h.title = "Direct mutation";
      }).toThrow();
    });
  });

  describe("Slice 6D — Confidence Update Rules", () => {
    it("allows elevating confidence to HIGH with explicit supporting evidence citations and reason", () => {
      const h = hypothesisStore.create({
        title: "Relay-induced supply brownout",
        description: "Relay activation induces voltage drop causing brownout reset.",
        confidence: "MEDIUM",
      });

      const updated = hypothesisStore.updateConfidence({
        hypothesisId: h.id,
        confidence: "HIGH",
        evidenceIds: ["E-001", "E-002"],
        reason: "Reset reason is BROWNOUT and rail dipped to 2.72V below the 2.80V threshold.",
      });

      expect(updated.confidence).toBe("HIGH");
      expect(updated.supportingEvidenceIds).toContain("E-001");
      expect(updated.supportingEvidenceIds).toContain("E-002");
      expect(updated.rationale).toBe(
        "Reset reason is BROWNOUT and rail dipped to 2.72V below the 2.80V threshold."
      );
    });

    it("rejects elevating confidence to HIGH without evidence citations", () => {
      const h = hypothesisStore.create({
        title: "Relay-induced supply brownout",
        description: "Relay activation induces voltage drop causing brownout reset.",
        confidence: "MEDIUM",
      });

      expect(() => {
        hypothesisStore.updateConfidence({
          hypothesisId: h.id,
          confidence: "HIGH",
          evidenceIds: [],
          reason: "I just think it is high.",
        });
      }).toThrow(/Updating hypothesis .* confidence requires citing at least one valid evidence record ID/);
    });

    it("rejects updating confidence with empty reason", () => {
      const h = hypothesisStore.create({
        title: "Relay-induced supply brownout",
        description: "Relay activation induces voltage drop causing brownout reset.",
        confidence: "LOW",
      });

      expect(() => {
        hypothesisStore.updateConfidence({
          hypothesisId: h.id,
          confidence: "MEDIUM",
          evidenceIds: ["E-001"],
          reason: "  ",
        });
      }).toThrow(/Updating hypothesis confidence requires an explicit non-empty reason/);
    });

    it("rejects updating confidence with nonexistent evidence ID", () => {
      const h = hypothesisStore.create({
        title: "Relay-induced supply brownout",
        description: "Relay activation induces voltage drop causing brownout reset.",
        confidence: "LOW",
      });

      expect(() => {
        hypothesisStore.updateConfidence({
          hypothesisId: h.id,
          confidence: "HIGH",
          evidenceIds: ["E-999"],
          reason: "Referencing nonexistent evidence.",
        });
      }).toThrow(/EvidenceRecord "E-999" does not exist in EvidenceStore/);
    });
  });

  describe("Slice 6E — Rejection", () => {
    it("rejects a hypothesis and marks cited evidence as CONTRADICTS", () => {
      const h = hypothesisStore.create({
        title: "Memory exhaustion",
        description: "Heap fragmentation or memory leak causes device crash.",
        confidence: "LOW",
      });

      const rejected = hypothesisStore.reject({
        hypothesisId: h.id,
        reason: "Free heap remained completely stable at 142.5 kB throughout the stress test.",
        evidenceIds: ["E-003"],
      });

      expect(rejected.status).toBe("REJECTED");
      expect(rejected.rejectionReason).toBe(
        "Free heap remained completely stable at 142.5 kB throughout the stress test."
      );
      expect(rejected.contradictingEvidenceIds).toContain("E-003");
      expect(rejected.evidenceLinks.find((l) => l.evidenceId === "E-003")?.relationship).toBe(
        "CONTRADICTS"
      );
    });

    it("retains rejected hypotheses in history (never deleted)", () => {
      const h = hypothesisStore.create({
        title: "I2C Bus Lockup",
        description: "SDA held low by peripheral.",
        confidence: "LOW",
      });

      hypothesisStore.reject({
        hypothesisId: h.id,
        reason: "I2C bus scan completed with ACK on expected addresses.",
      });

      expect(hypothesisStore.size()).toBe(1);
      const all = hypothesisStore.getAll();
      expect(all).toHaveLength(1);
      expect(all[0].id).toBe(h.id);
      expect(all[0].status).toBe("REJECTED");

      const byStatus = hypothesisStore.getByStatus("REJECTED");
      expect(byStatus).toHaveLength(1);
      expect(byStatus[0].id).toBe(h.id);
    });
  });

  describe("Slice 6F — Confirmation Safeguard", () => {
    it("rejects confirmation if confidence is not VERY_HIGH", () => {
      const h = hypothesisStore.create({
        title: "Relay-induced supply brownout",
        description: "Relay coil current draw causes 3.3V supply rail to collapse.",
        confidence: "MEDIUM",
      });

      expect(() => {
        hypothesisStore.confirm({
          hypothesisId: h.id,
          rationale: "We observed the brownout.",
          evidenceIds: ["E-001"],
          verifiedExperimentId: "exp-123",
        });
      }).toThrow(/must have confidence VERY_HIGH before confirmation/);
    });

    it("rejects confirmation without a physical/virtual verification experiment", () => {
      const h = hypothesisStore.create({
        title: "Relay-induced supply brownout",
        description: "Relay coil current draw causes 3.3V supply rail to collapse.",
        confidence: "MEDIUM",
      });

      hypothesisStore.updateConfidence({
        hypothesisId: h.id,
        confidence: "VERY_HIGH",
        evidenceIds: ["E-001", "E-002"],
        reason: "Definitive evidence of brownout reset and 2.72V rail sag.",
      });

      expect(() => {
        hypothesisStore.confirm({
          hypothesisId: h.id,
          rationale: "Definitive proof confirmed.",
          evidenceIds: ["E-001", "E-002"],
          // No verifiedExperimentId provided
        });
      }).toThrow(/Cannot confirm hypothesis .* without a completed physical\/virtual verification experiment/);
    });

    it("keeps normal hypotheses as NOT_VERIFIED for Milestone 6", () => {
      const h = hypothesisStore.create({
        title: "Relay-induced supply brownout",
        description: "Relay coil current draw causes 3.3V supply rail to collapse.",
        confidence: "MEDIUM",
      });

      hypothesisStore.updateConfidence({
        hypothesisId: h.id,
        confidence: "HIGH",
        evidenceIds: ["E-001", "E-002"],
        reason: "Evidence confirms brownout reset occurs during relay cycle.",
      });

      const current = hypothesisStore.get(h.id);
      expect(current?.verificationStatus).toBe("NOT_VERIFIED");
    });
  });

  describe("Subscriptions & Reactivity", () => {
    it("notifies subscribers when hypotheses are created, linked, updated, or rejected", () => {
      let callCount = 0;
      let lastList: readonly Hypothesis[] = [];

      const unsubscribe = hypothesisStore.subscribe((list) => {
        callCount++;
        lastList = list;
      });

      // Initial call on subscribe
      expect(callCount).toBe(1);
      expect(lastList).toHaveLength(0);

      const h = hypothesisStore.create({
        title: "Test Hypothesis",
        description: "Testing subscriptions.",
        confidence: "LOW",
      });

      expect(callCount).toBe(2);
      expect(lastList).toHaveLength(1);
      expect(lastList[0].id).toBe(h.id);

      hypothesisStore.linkEvidence({
        hypothesisId: h.id,
        evidenceId: "E-001",
        relationship: "SUPPORTS",
      });

      expect(callCount).toBe(3);
      expect(lastList[0].supportingEvidenceIds).toEqual(["E-001"]);

      unsubscribe();

      hypothesisStore.create({
        title: "Second Hypothesis",
        description: "Should not trigger unsubscribed listener.",
        confidence: "LOW",
      });

      expect(callCount).toBe(3);
    });
  });
});
