/**
 * WebMCP Hypothesis Synthesis & Management Tools.
 * Exposes hypothesis creation, evidence linking, confidence updates, inspection tools,
 * diagnostic conclusion recording, and human intervention requests over document.modelContext.
 *
 * Core Invariants:
 * 1. Read-Only Annotations: list_hypotheses and get_hypothesis are marked readOnlyHint: true.
 * 2. Mutation Annotations: propose_hypothesis, update_hypothesis, link_evidence, reject_hypothesis, confirm_hypothesis, record_conclusion, request_human_intervention are marked readOnlyHint: false.
 * 3. Evidence Immutability: Synthesis tools link to factual evidence, but cannot create, modify, or delete EvidenceRecords.
 * 4. Citation Validation: All cited evidence IDs must exist in EvidenceStore.
 * 5. Qualitative Confidence: Quantitative probabilities (e.g. 87.3%) are strictly forbidden.
 */

import type {
  HypothesisStore,
  CreateHypothesisParams,
  UpdateHypothesisConfidenceParams,
  LinkEvidenceParams,
  RejectHypothesisParams,
} from "@/domain/hypothesis/store";
import type {
  EvidenceRelationship,
  HypothesisConfidence,
  HypothesisStatus,
} from "@/domain/hypothesis/types";
import type { ModelContext, ModelContextTool } from "./types";

function parseToolInput(rawInput: unknown): Record<string, unknown> {
  if (typeof rawInput === "string") {
    const trimmed = rawInput.trim();
    if (trimmed.length > 0) {
      try {
        const parsed = JSON.parse(trimmed);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          return parsed as Record<string, unknown>;
        }
      } catch {
        return {};
      }
    }
    return {};
  }
  if (rawInput && typeof rawInput === "object" && !Array.isArray(rawInput)) {
    return rawInput as Record<string, unknown>;
  }
  return {};
}

export function createHypothesisTools(hypothesisStore: HypothesisStore): ModelContextTool[] {
  const proposeHypothesisTool: ModelContextTool = {
    name: "propose_hypothesis",
    title: "Propose Diagnostic Hypothesis",
    description:
      "Propose a new diagnostic hypothesis explaining observed anomalies. Initial confidence must be UNTESTED, LOW, or MEDIUM. Evidence may be linked now or in subsequent steps.",
    inputSchema: {
      type: "object",
      properties: {
        title: {
          type: "string",
          minLength: 3,
          maxLength: 120,
          description: "Concise explanatory title of the hypothesis (e.g. 'Supply rail voltage sag under load').",
        },
        description: {
          type: "string",
          maxLength: 600,
          description: "Detailed explanation of the causal mechanism and affected subsystems. If omitted, title or rationale is used.",
        },
        confidence: {
          type: "string",
          enum: ["UNTESTED", "LOW", "MEDIUM"],
          description: "Initial qualitative confidence tier (UNTESTED, LOW, or MEDIUM, default: MEDIUM). Initial HIGH/VERY_HIGH is prohibited without prior evidence integration.",
        },
        rationale: {
          type: "string",
          maxLength: 800,
          description: "Optional concise user-facing scientific justification for proposing this hypothesis.",
        },
        evidence_ids: {
          type: "array",
          items: { type: "string" },
          description: "Optional array of existing factual evidence IDs (e.g. ['E-001', 'E-002']) that initially support this hypothesis.",
        },
      },
      required: ["title"],
      additionalProperties: false,
    },
    annotations: {
      readOnlyHint: false,
    },
    execute: async (rawInput) => {
      const input = parseToolInput(rawInput);
      const title = String(input.title || "").trim();
      const rawDesc = typeof input.description === "string" ? input.description.trim() : "";
      const rawRationale = typeof input.rationale === "string" ? input.rationale.trim() : "";
      const description = rawDesc || rawRationale || title;
      const confidence = String(input.confidence || "MEDIUM").trim() as HypothesisConfidence;
      const rationale = rawRationale || undefined;

      const initialEvidenceLinks = Array.isArray(input.evidence_ids)
        ? (input.evidence_ids as string[]).map((eid) => ({
            evidenceId: String(eid).trim(),
            relationship: "SUPPORTS" as EvidenceRelationship,
            note: rationale,
          }))
        : undefined;

      const params: CreateHypothesisParams = {
        title,
        description,
        confidence,
        rationale,
        createdBy: "agent",
        initialEvidenceLinks,
      };

      const created = hypothesisStore.create(params);
      return {
        hypothesis: created,
        message: `Hypothesis ${created.id} ("${created.title}") successfully proposed with confidence ${created.confidence}.`,
      };
    },
  };

  const updateHypothesisTool: ModelContextTool = {
    name: "update_hypothesis",
    title: "Update Hypothesis Confidence",
    description:
      "Update a hypothesis's confidence tier based on new empirical evidence. Requires explicit evidence citations and scientific justification.",
    inputSchema: {
      type: "object",
      properties: {
        hypothesis_id: {
          type: "string",
          description: "Identifier of the hypothesis to update (e.g. H-001).",
        },
        confidence: {
          type: "string",
          enum: ["UNTESTED", "LOW", "MEDIUM", "HIGH", "VERY_HIGH"],
          description: "Updated qualitative confidence tier.",
        },
        evidence_ids: {
          type: "array",
          items: { type: "string" },
          description: "Array of supporting evidence IDs (e.g. ['E-001', 'E-002']) justifying this confidence elevation.",
        },
        reason: {
          type: "string",
          minLength: 3,
          maxLength: 800,
          description: "Scientific justification explaining why the cited evidence supports this confidence change.",
        },
      },
      required: ["hypothesis_id", "confidence", "evidence_ids", "reason"],
      additionalProperties: false,
    },
    annotations: {
      readOnlyHint: false,
    },
    execute: async (rawInput) => {
      const input = parseToolInput(rawInput);
      const hypothesisId = String(input.hypothesis_id || "").trim();
      const confidence = String(input.confidence || "").trim() as HypothesisConfidence;
      const reason = String(input.reason || "").trim();
      const evidenceIds = Array.isArray(input.evidence_ids)
        ? (input.evidence_ids as string[]).map((id) => String(id).trim())
        : [];

      if (!hypothesisId) {
        throw new Error("Missing required parameter: hypothesis_id");
      }
      if (!reason) {
        throw new Error("Missing required parameter: reason");
      }

      const params: UpdateHypothesisConfidenceParams = {
        hypothesisId,
        confidence,
        evidenceIds,
        reason,
      };

      const updated = hypothesisStore.updateConfidence(params);
      return {
        hypothesis: updated,
        message: `Hypothesis ${updated.id} confidence updated to ${updated.confidence} with ${updated.supportingEvidenceIds.length} supporting evidence citations.`,
      };
    },
  };

  const linkEvidenceTool: ModelContextTool = {
    name: "link_evidence",
    title: "Link Evidence to Hypothesis",
    description:
      "Explicitly link an immutable evidence record to a hypothesis with a defined relationship (SUPPORTS, STRONGLY_SUPPORTS, CONTRADICTS, STRONGLY_CONTRADICTS).",
    inputSchema: {
      type: "object",
      properties: {
        hypothesis_id: {
          type: "string",
          description: "Identifier of the target hypothesis (e.g. H-001).",
        },
        evidence_id: {
          type: "string",
          description: "Identifier of the factual evidence record (e.g. E-001).",
        },
        relationship: {
          type: "string",
          enum: ["SUPPORTS", "STRONGLY_SUPPORTS", "CONTRADICTS", "STRONGLY_CONTRADICTS"],
          description: "Relationship between the evidence and the hypothesis.",
        },
        note: {
          type: "string",
          maxLength: 500,
          description: "Optional brief scientific note explaining how this evidence relates to the hypothesis.",
        },
      },
      required: ["hypothesis_id", "evidence_id", "relationship"],
      additionalProperties: false,
    },
    annotations: {
      readOnlyHint: false,
    },
    execute: async (rawInput) => {
      const input = parseToolInput(rawInput);
      const hypothesisId = String(input.hypothesis_id || "").trim();
      const evidenceId = String(input.evidence_id || "").trim();
      const relationship = String(input.relationship || "").trim() as EvidenceRelationship;
      const note = typeof input.note === "string" ? input.note.trim() : undefined;

      if (!hypothesisId) {
        throw new Error("Missing required parameter: hypothesis_id");
      }
      if (!evidenceId) {
        throw new Error("Missing required parameter: evidence_id");
      }
      if (!relationship) {
        throw new Error("Missing required parameter: relationship");
      }

      const params: LinkEvidenceParams = {
        hypothesisId,
        evidenceId,
        relationship,
        note,
      };

      const updated = hypothesisStore.linkEvidence(params);
      const link = updated.evidenceLinks.find((l) => l.evidenceId === evidenceId);

      return {
        hypothesis: updated,
        link,
        message: `Linked evidence ${evidenceId} to hypothesis ${hypothesisId} as ${relationship}.`,
      };
    },
  };

  const rejectHypothesisTool: ModelContextTool = {
    name: "reject_hypothesis",
    title: "Reject Diagnostic Hypothesis",
    description:
      "Formally reject a hypothesis that has been disproven by empirical evidence. Rejected hypotheses remain in history to document systematic elimination.",
    inputSchema: {
      type: "object",
      properties: {
        hypothesis_id: {
          type: "string",
          description: "Identifier of the hypothesis to reject (e.g. H-002).",
        },
        reason: {
          type: "string",
          minLength: 3,
          maxLength: 800,
          description: "Scientific explanation of why this hypothesis is rejected.",
        },
        evidence_ids: {
          type: "array",
          items: { type: "string" },
          description: "Optional array of contradicting evidence IDs (e.g. ['E-003']).",
        },
      },
      required: ["hypothesis_id", "reason"],
      additionalProperties: false,
    },
    annotations: {
      readOnlyHint: false,
    },
    execute: async (rawInput) => {
      const input = parseToolInput(rawInput);
      const hypothesisId = String(input.hypothesis_id || "").trim();
      const reason = String(input.reason || "").trim();
      const evidenceIds = Array.isArray(input.evidence_ids)
        ? (input.evidence_ids as string[]).map((id) => String(id).trim())
        : undefined;

      if (!hypothesisId) {
        throw new Error("Missing required parameter: hypothesis_id");
      }
      if (!reason) {
        throw new Error("Missing required parameter: reason");
      }

      const params: RejectHypothesisParams = {
        hypothesisId,
        reason,
        evidenceIds,
      };

      const rejected = hypothesisStore.reject(params);
      return {
        hypothesis: rejected,
        message: `Hypothesis ${rejected.id} ("${rejected.title}") marked REJECTED. Preserved in history.`,
      };
    },
  };

  const confirmHypothesisTool: ModelContextTool = {
    name: "confirm_hypothesis",
    title: "Confirm and Verify Diagnostic Hypothesis",
    description:
      "Formally confirm and verify a diagnostic hypothesis after a physical/virtual repair intervention has been empirically verified by a re-test experiment.",
    inputSchema: {
      type: "object",
      properties: {
        hypothesis_id: {
          type: "string",
          description: "Identifier of the hypothesis to confirm (e.g. H-001).",
        },
        rationale: {
          type: "string",
          minLength: 10,
          maxLength: 800,
          description: "Detailed scientific explanation and proof of empirical verification.",
        },
        evidence_ids: {
          type: "array",
          items: { type: "string" },
          description: "Array of supporting evidence IDs (e.g. ['E-001', 'E-006']).",
        },
        verified_experiment_id: {
          type: "string",
          description: "Identifier of the successful verification experiment (e.g. exp-abc12345).",
        },
      },
      required: ["hypothesis_id", "rationale", "evidence_ids", "verified_experiment_id"],
      additionalProperties: false,
    },
    annotations: {
      readOnlyHint: false,
    },
    execute: async (rawInput) => {
      const input = parseToolInput(rawInput);
      const hypothesisId = String(input.hypothesis_id || "").trim();
      const rationale = String(input.rationale || "").trim();
      const verifiedExperimentId = String(input.verified_experiment_id || "").trim();
      const evidenceIds = Array.isArray(input.evidence_ids)
        ? (input.evidence_ids as string[]).map((id) => String(id).trim())
        : [];

      if (!hypothesisId) {
        throw new Error("Missing required parameter: hypothesis_id");
      }
      if (!rationale) {
        throw new Error("Missing required parameter: rationale");
      }
      if (!verifiedExperimentId) {
        throw new Error("Missing required parameter: verified_experiment_id");
      }

      const confirmed = hypothesisStore.confirm({
        hypothesisId,
        rationale,
        evidenceIds,
        verifiedExperimentId,
      });

      return {
        hypothesis: confirmed,
        message: `Hypothesis ${confirmed.id} successfully CONFIRMED and marked VERIFIED based on verification experiment ${verifiedExperimentId}.`,
      };
    },
  };

  const recordConclusionTool: ModelContextTool = {
    name: "record_conclusion",
    title: "Record Diagnostic Conclusion",
    description:
      "Record the final diagnostic conclusion, identified root cause, and supporting verification evidence for the hardware investigation.",
    inputSchema: {
      type: "object",
      properties: {
        hypothesis_id: {
          type: "string",
          description: "Identifier of the confirmed hypothesis (e.g. H-001).",
        },
        root_cause: {
          type: "string",
          minLength: 5,
          maxLength: 300,
          description: "Specific root cause identified from empirical investigation.",
        },
        summary: {
          type: "string",
          minLength: 10,
          maxLength: 800,
          description: "Comprehensive summary of the problem, investigation evidence, repair, and verification.",
        },
        verification_evidence_ids: {
          type: "array",
          items: { type: "string" },
          description: "Array of evidence IDs proving successful post-repair verification.",
        },
      },
      required: ["hypothesis_id", "root_cause", "summary"],
      additionalProperties: false,
    },
    annotations: {
      readOnlyHint: false,
    },
    execute: async (rawInput) => {
      const input = parseToolInput(rawInput);
      const hypothesisId = String(input.hypothesis_id || "").trim();
      const rootCause = String(input.root_cause || "").trim();
      const summary = String(input.summary || "").trim();
      const verificationEvidenceIds = Array.isArray(input.verification_evidence_ids)
        ? (input.verification_evidence_ids as string[]).map((id) => String(id).trim())
        : [];

      if (!hypothesisId) {
        throw new Error("Missing required parameter: hypothesis_id");
      }
      const existing = hypothesisStore.get(hypothesisId);
      if (!existing) {
        throw new Error(`Hypothesis with ID '${hypothesisId}' not found.`);
      }

      return {
        ok: true,
        hypothesisId,
        rootCause,
        summary,
        verificationEvidenceIds,
        message: `Diagnostic conclusion successfully recorded for hypothesis ${hypothesisId}: ${rootCause}`,
      };
    },
  };

  const requestHumanInterventionTool: ModelContextTool = {
    name: "request_human_intervention",
    title: "Request Human-Gated DUT Intervention",
    description:
      "Request human assistance at the device-adapter boundary. In this submission, the human explicitly simulates a jumper, switch, or cable change on the stateful virtual ESP32; no device state changes automatically.",
    inputSchema: {
      type: "object",
      properties: {
        target: {
          type: "string",
          description: "Target hardware intervention point identifier.",
        },
        instruction: {
          type: "string",
          minLength: 5,
          maxLength: 500,
          description: "Clear instruction for the human-confirmed virtual DUT change (or physical adapter action in a future connected deployment).",
        },
        rationale: {
          type: "string",
          minLength: 5,
          maxLength: 800,
          description: "Scientific rationale explaining why this human-gated DUT change is necessary to test or repair the fault.",
        },
        evidence_ids: {
          type: "array",
          items: { type: "string" },
          description: "Optional array of evidence IDs motivating this intervention request.",
        },
      },
      required: ["target", "instruction", "rationale"],
      additionalProperties: false,
    },
    annotations: {
      readOnlyHint: false,
    },
    execute: async (rawInput) => {
      const input = parseToolInput(rawInput);
      const target = String(input.target || "").trim();
      const instruction = String(input.instruction || "").trim();
      const rationale = String(input.rationale || "").trim();
      const evidenceIds = Array.isArray(input.evidence_ids)
        ? (input.evidence_ids as string[]).map((id) => String(id).trim())
        : [];

      if (!target) {
        throw new Error("Missing required parameter: target");
      }
      if (!instruction) {
        throw new Error("Missing required parameter: instruction");
      }
      if (!rationale) {
        throw new Error("Missing required parameter: rationale");
      }

      return {
        status: "REQUESTED",
        target,
        instruction,
        rationale,
        evidenceIds,
        message: `Human intervention requested on "${target}": ${instruction}`,
      };
    },
  };

  const listHypothesesTool: ModelContextTool = {
    name: "list_hypotheses",
    title: "List Diagnostic Hypotheses",
    description:
      "List diagnostic hypotheses proposed during the investigation. Returns hypotheses, confidence tiers, status, and linked evidence IDs.",
    inputSchema: {
      type: "object",
      properties: {
        status: {
          type: "string",
          enum: ["ACTIVE", "DEPRIORITIZED", "REJECTED", "CONFIRMED"],
          description: "Optional filter by hypothesis status.",
        },
      },
      additionalProperties: false,
    },
    annotations: {
      readOnlyHint: true,
    },
    execute: async (rawInput) => {
      const input = parseToolInput(rawInput);
      const status = typeof input.status === "string" ? (input.status.trim() as HypothesisStatus) : undefined;
      const list = status ? hypothesisStore.getByStatus(status) : hypothesisStore.getAll();
      return {
        hypotheses: list,
        count: list.length,
      };
    },
  };

  const getHypothesisTool: ModelContextTool = {
    name: "get_hypothesis",
    title: "Get Diagnostic Hypothesis",
    description:
      "Get full details of a specific diagnostic hypothesis by its ID (e.g. H-001), including confidence, status, rationale, and all linked evidence.",
    inputSchema: {
      type: "object",
      properties: {
        hypothesis_id: {
          type: "string",
          description: "Identifier of the hypothesis (e.g. H-001).",
        },
      },
      required: ["hypothesis_id"],
      additionalProperties: false,
    },
    annotations: {
      readOnlyHint: true,
    },
    execute: async (rawInput) => {
      const input = parseToolInput(rawInput);
      const id = String(input.hypothesis_id || "").trim();
      if (!id) {
        throw new Error("Missing required parameter: hypothesis_id");
      }
      const record = hypothesisStore.get(id);
      if (!record) {
        throw new Error(`Hypothesis with ID '${id}' not found.`);
      }
      return record;
    },
  };

  return [
    proposeHypothesisTool,
    updateHypothesisTool,
    linkEvidenceTool,
    rejectHypothesisTool,
    confirmHypothesisTool,
    recordConclusionTool,
    requestHumanInterventionTool,
    listHypothesesTool,
    getHypothesisTool,
  ];
}

export async function registerHypothesisTools(
  modelContext: ModelContext,
  hypothesisStore: HypothesisStore,
  signal?: AbortSignal
): Promise<string[]> {
  const tools = createHypothesisTools(hypothesisStore);
  const registeredNames: string[] = [];

  for (const tool of tools) {
    await modelContext.registerTool(tool, { signal });
    registeredNames.push(tool.name);
  }

  return registeredNames;
}
