/**
 * Unit & Integration tests for WebMCP Hypothesis Synthesis Tools (Milestone 6).
 */

import { describe, it, expect, beforeEach } from "bun:test";
import { InMemoryModelContext } from "@/infrastructure/webmcp/in-memory-model-context";
import { InMemoryEvidenceStore } from "@/domain/evidence/store";
import { InMemoryHypothesisStore } from "@/domain/hypothesis/store";
import {
  createHypothesisTools,
  registerHypothesisTools,
} from "@/infrastructure/webmcp/hypothesis-tools";
import type { RegisteredTool } from "@/infrastructure/webmcp/types";

describe("WebMCP Hypothesis Synthesis Tools (Milestone 6)", () => {
  let modelContext: InMemoryModelContext;
  let evidenceStore: InMemoryEvidenceStore;
  let hypothesisStore: InMemoryHypothesisStore;

  beforeEach(async () => {
    modelContext = new InMemoryModelContext();
    evidenceStore = new InMemoryEvidenceStore();
    hypothesisStore = new InMemoryHypothesisStore(evidenceStore);

    // Seed factual evidence records
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

    await registerHypothesisTools(modelContext, hypothesisStore);
  });

  describe("Tool Registration & Annotations", () => {
    it("registers all 9 hypothesis synthesis tools on document.modelContext", async () => {
      const tools = await modelContext.getTools();
      const names = tools.map((t) => t.name);

      expect(names).toContain("propose_hypothesis");
      expect(names).toContain("update_hypothesis");
      expect(names).toContain("link_evidence");
      expect(names).toContain("reject_hypothesis");
      expect(names).toContain("confirm_hypothesis");
      expect(names).toContain("record_conclusion");
      expect(names).toContain("request_human_intervention");
      expect(names).toContain("list_hypotheses");
      expect(names).toContain("get_hypothesis");
      expect(tools.length).toBe(9);
    });

    it("applies strict readOnlyHint annotations according to WebMCP standard", async () => {
      const tools = await modelContext.getTools();

      const listTool = tools.find((t) => t.name === "list_hypotheses");
      const getTool = tools.find((t) => t.name === "get_hypothesis");
      const proposeTool = tools.find((t) => t.name === "propose_hypothesis");
      const updateTool = tools.find((t) => t.name === "update_hypothesis");
      const linkTool = tools.find((t) => t.name === "link_evidence");
      const rejectTool = tools.find((t) => t.name === "reject_hypothesis");
      const confirmTool = tools.find((t) => t.name === "confirm_hypothesis");

      expect(listTool?.annotations?.readOnlyHint).toBe(true);
      expect(getTool?.annotations?.readOnlyHint).toBe(true);
      expect(proposeTool?.annotations?.readOnlyHint).toBe(false);
      expect(updateTool?.annotations?.readOnlyHint).toBe(false);
      expect(linkTool?.annotations?.readOnlyHint).toBe(false);
      expect(rejectTool?.annotations?.readOnlyHint).toBe(false);
      expect(confirmTool?.annotations?.readOnlyHint).toBe(false);
      expect(rejectTool?.annotations?.readOnlyHint).toBe(false);
    });

    it("verifies NO evidence creation/mutation tools are exposed", async () => {
      const tools = await modelContext.getTools();
      const names = tools.map((t) => t.name);

      expect(names).not.toContain("create_evidence");
      expect(names).not.toContain("edit_evidence");
      expect(names).not.toContain("delete_evidence");
      expect(names).not.toContain("modify_evidence");
    });
  });

  describe("propose_hypothesis", () => {
    it("successfully proposes a hypothesis with valid parameters", async () => {
      const tool = (await modelContext.getTools()).find((t) => t.name === "propose_hypothesis")!;
      const resultStr = await modelContext.executeTool(
        tool,
        JSON.stringify({
          title: "Relay-induced supply brownout",
          description: "Relay coil inrush current drags 3.3V rail below 2.80V reset threshold.",
          confidence: "MEDIUM",
          rationale: "Brownout reset observed during relay switching.",
        })
      );

      const parsed = JSON.parse(resultStr);
      expect(parsed.hypothesis).toBeDefined();
      expect(parsed.hypothesis.id).toBe("H-001");
      expect(parsed.hypothesis.title).toBe("Relay-induced supply brownout");
      expect(parsed.hypothesis.confidence).toBe("MEDIUM");
      expect(parsed.hypothesis.status).toBe("ACTIVE");
      expect(parsed.hypothesis.verificationStatus).toBe("NOT_VERIFIED");
    });

    it("rejects initial confidence of HIGH", async () => {
      const tool = (await modelContext.getTools()).find((t) => t.name === "propose_hypothesis")!;
      await expect(
        modelContext.executeTool(
          tool,
          JSON.stringify({
            title: "Premature high confidence",
            description: "Attempting to create high confidence without prior linking.",
            confidence: "HIGH",
          })
        )
      ).rejects.toThrow(/Initial hypothesis confidence must be UNTESTED, LOW, or MEDIUM/);
    });
  });

  describe("link_evidence", () => {
    it("links factual evidence to a hypothesis with SUPPORTS or STRONGLY_SUPPORTS", async () => {
      const proposeTool = (await modelContext.getTools()).find((t) => t.name === "propose_hypothesis")!;
      await modelContext.executeTool(
        proposeTool,
        JSON.stringify({
          title: "Relay-induced supply brownout",
          description: "Relay coil draws excessive current.",
          confidence: "LOW",
        })
      );

      const linkTool = (await modelContext.getTools()).find((t) => t.name === "link_evidence")!;
      const resultStr = await modelContext.executeTool(
        linkTool,
        JSON.stringify({
          hypothesis_id: "H-001",
          evidence_id: "E-001",
          relationship: "STRONGLY_SUPPORTS",
          note: "Microcontroller explicitly reported BROWNOUT reset.",
        })
      );

      const parsed = JSON.parse(resultStr);
      expect(parsed.hypothesis.evidenceLinks).toHaveLength(1);
      expect(parsed.hypothesis.evidenceLinks[0].evidenceId).toBe("E-001");
      expect(parsed.hypothesis.evidenceLinks[0].relationship).toBe("STRONGLY_SUPPORTS");
      expect(parsed.hypothesis.supportingEvidenceIds).toEqual(["E-001"]);
    });

    it("rejects linking nonexistent evidence ID", async () => {
      const proposeTool = (await modelContext.getTools()).find((t) => t.name === "propose_hypothesis")!;
      await modelContext.executeTool(
        proposeTool,
        JSON.stringify({
          title: "Relay-induced supply brownout",
          description: "Relay coil draws excessive current.",
          confidence: "LOW",
        })
      );

      const linkTool = (await modelContext.getTools()).find((t) => t.name === "link_evidence")!;
      await expect(
        modelContext.executeTool(
          linkTool,
          JSON.stringify({
            hypothesis_id: "H-001",
            evidence_id: "E-999",
            relationship: "SUPPORTS",
          })
        )
      ).rejects.toThrow(/EvidenceRecord "E-999" does not exist/);
    });
  });

  describe("update_hypothesis", () => {
    it("elevates confidence to HIGH with valid evidence citations and reason", async () => {
      const proposeTool = (await modelContext.getTools()).find((t) => t.name === "propose_hypothesis")!;
      await modelContext.executeTool(
        proposeTool,
        JSON.stringify({
          title: "Relay-induced supply brownout",
          description: "Relay coil draws excessive current.",
          confidence: "MEDIUM",
        })
      );

      const updateTool = (await modelContext.getTools()).find((t) => t.name === "update_hypothesis")!;
      const resultStr = await modelContext.executeTool(
        updateTool,
        JSON.stringify({
          hypothesis_id: "H-001",
          confidence: "HIGH",
          evidence_ids: ["E-001", "E-002"],
          reason: "Reset reason is BROWNOUT and rail dropped to 2.72V during relay cycle.",
        })
      );

      const parsed = JSON.parse(resultStr);
      expect(parsed.hypothesis.confidence).toBe("HIGH");
      expect(parsed.hypothesis.supportingEvidenceIds).toEqual(["E-001", "E-002"]);
      expect(parsed.hypothesis.rationale).toBe(
        "Reset reason is BROWNOUT and rail dropped to 2.72V during relay cycle."
      );
    });

    it("rejects confidence elevation to HIGH without evidence citations", async () => {
      const proposeTool = (await modelContext.getTools()).find((t) => t.name === "propose_hypothesis")!;
      await modelContext.executeTool(
        proposeTool,
        JSON.stringify({
          title: "Relay-induced supply brownout",
          description: "Relay coil draws excessive current.",
          confidence: "LOW",
        })
      );

      const updateTool = (await modelContext.getTools()).find((t) => t.name === "update_hypothesis")!;
      await expect(
        modelContext.executeTool(
          updateTool,
          JSON.stringify({
            hypothesis_id: "H-001",
            confidence: "HIGH",
            evidence_ids: [],
            reason: "Pure intuition without evidence.",
          })
        )
      ).rejects.toThrow(/Updating hypothesis .* confidence requires citing at least one valid evidence record ID/);
    });
  });

  describe("reject_hypothesis", () => {
    it("marks a hypothesis as REJECTED with contradicting evidence citations", async () => {
      const proposeTool = (await modelContext.getTools()).find((t) => t.name === "propose_hypothesis")!;
      await modelContext.executeTool(
        proposeTool,
        JSON.stringify({
          title: "Memory exhaustion",
          description: "Heap exhaustion causes out of memory crash.",
          confidence: "LOW",
        })
      );

      const rejectTool = (await modelContext.getTools()).find((t) => t.name === "reject_hypothesis")!;
      const resultStr = await modelContext.executeTool(
        rejectTool,
        JSON.stringify({
          hypothesis_id: "H-001",
          reason: "Free heap remained steady at 142.5 kB throughout the entire test.",
          evidence_ids: ["E-003"],
        })
      );

      const parsed = JSON.parse(resultStr);
      expect(parsed.hypothesis.status).toBe("REJECTED");
      expect(parsed.hypothesis.contradictingEvidenceIds).toContain("E-003");
      expect(parsed.hypothesis.rejectionReason).toBe(
        "Free heap remained steady at 142.5 kB throughout the entire test."
      );
    });
  });

  describe("list_hypotheses and get_hypothesis", () => {
    it("lists all hypotheses and filters by status", async () => {
      const proposeTool = (await modelContext.getTools()).find((t) => t.name === "propose_hypothesis")!;
      await modelContext.executeTool(
        proposeTool,
        JSON.stringify({
          title: "Brownout hypothesis",
          description: "Relay brownout.",
          confidence: "MEDIUM",
        })
      );
      await modelContext.executeTool(
        proposeTool,
        JSON.stringify({
          title: "Memory leak hypothesis",
          description: "Heap exhausted.",
          confidence: "LOW",
        })
      );

      const rejectTool = (await modelContext.getTools()).find((t) => t.name === "reject_hypothesis")!;
      await modelContext.executeTool(
        rejectTool,
        JSON.stringify({
          hypothesis_id: "H-002",
          reason: "Heap is fine.",
        })
      );

      const listTool = (await modelContext.getTools()).find((t) => t.name === "list_hypotheses")!;
      const allStr = await modelContext.executeTool(listTool, "{}");
      const allParsed = JSON.parse(allStr);
      expect(allParsed.count).toBe(2);

      const activeStr = await modelContext.executeTool(listTool, JSON.stringify({ status: "ACTIVE" }));
      const activeParsed = JSON.parse(activeStr);
      expect(activeParsed.count).toBe(1);
      expect(activeParsed.hypotheses[0].id).toBe("H-001");

      const rejectedStr = await modelContext.executeTool(listTool, JSON.stringify({ status: "REJECTED" }));
      const rejectedParsed = JSON.parse(rejectedStr);
      expect(rejectedParsed.count).toBe(1);
      expect(rejectedParsed.hypotheses[0].id).toBe("H-002");
    });

    it("gets full details of a specific hypothesis by ID", async () => {
      const proposeTool = (await modelContext.getTools()).find((t) => t.name === "propose_hypothesis")!;
      await modelContext.executeTool(
        proposeTool,
        JSON.stringify({
          title: "Brownout hypothesis",
          description: "Relay brownout.",
          confidence: "MEDIUM",
        })
      );

      const getTool = (await modelContext.getTools()).find((t) => t.name === "get_hypothesis")!;
      const getStr = await modelContext.executeTool(getTool, JSON.stringify({ hypothesis_id: "H-001" }));
      const parsed = JSON.parse(getStr);

      expect(parsed.id).toBe("H-001");
      expect(parsed.title).toBe("Brownout hypothesis");
      expect(parsed.confidence).toBe("MEDIUM");
    });
  });
});
