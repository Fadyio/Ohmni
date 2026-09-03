/**
 * WebMCP Evidence Tools.
 * Exposes read-only inspection tools (list_evidence, get_evidence) over document.modelContext.
 *
 * Invariants:
 * 1. Read-only: Annotated with readOnlyHint: true.
 * 2. Non-forgeable: NO creation, mutation, or deletion tools are exposed to WebMCP.
 * 3. Exact factual retrieval: Returns canonical frozen EvidenceRecords from EvidenceStore.
 */

import type { EvidenceStore } from "@/domain/evidence/store";
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

export function createEvidenceTools(evidenceStore: EvidenceStore): ModelContextTool[] {
  const listEvidenceTool: ModelContextTool = {
    name: "list_evidence",
    title: "List Evidence Records",
    description:
      "List immutable factual observations recorded by Ohmni from diagnostic experiments and human observations. Evidence records are measurements and observed events, not diagnostic conclusions.",
    inputSchema: {
      type: "object",
      properties: {
        experiment_id: {
          type: "string",
          description: "Optional filter by correlated experiment ID (e.g. exp_...)",
        },
        type: {
          type: "string",
          description:
            "Optional filter by evidence type (measurement, reset_event, test_result, configuration, device_state, human_observation)",
        },
      },
      additionalProperties: false,
    },
    annotations: {
      readOnlyHint: true,
    },
    execute: async (rawInput) => {
      const input = parseToolInput(rawInput);
      let records = evidenceStore.getAll();
      if (typeof input.experiment_id === "string" && input.experiment_id.trim().length > 0) {
        records = evidenceStore.getByExperiment(input.experiment_id.trim());
      }
      if (typeof input.type === "string" && input.type.trim().length > 0) {
        records = records.filter((r) => r.type === input.type);
      }
      return records;
    },
  };

  const getEvidenceTool: ModelContextTool = {
    name: "get_evidence",
    title: "Get Evidence Record",
    description:
      "Get a specific immutable evidence record by its identifier (e.g. E-001). Returns full factual payload, timestamps, and provenance.",
    inputSchema: {
      type: "object",
      properties: {
        evidence_id: {
          type: "string",
          description: "Compact identifier of the evidence record (e.g. E-001)",
        },
      },
      required: ["evidence_id"],
      additionalProperties: false,
    },
    annotations: {
      readOnlyHint: true,
    },
    execute: async (rawInput) => {
      const input = parseToolInput(rawInput);
      const id = String(input.evidence_id || "").trim();
      if (!id) {
        throw new Error("Missing required parameter: evidence_id");
      }
      const record = evidenceStore.get(id);
      if (!record) {
        throw new Error(`Evidence record with ID '${id}' not found.`);
      }
      return record;
    },
  };

  return [listEvidenceTool, getEvidenceTool];
}

export async function registerEvidenceTools(
  modelContext: ModelContext,
  evidenceStore: EvidenceStore,
  signal?: AbortSignal
): Promise<string[]> {
  const tools = createEvidenceTools(evidenceStore);
  const registeredNames: string[] = [];

  for (const tool of tools) {
    await modelContext.registerTool(tool, { signal });
    registeredNames.push(tool.name);
  }

  return registeredNames;
}
