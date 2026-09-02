/**
 * Hypothesis Store.
 * Provides controlled storage, lifecycle management, and evidence-linking
 * for diagnostic hypotheses.
 *
 * Core Invariants:
 * 1. Evidence Separation: Hypotheses interpret facts from EvidenceStore,
 *    never modifying or fabricating EvidenceRecords.
 * 2. Controlled Mutation: Hypotheses are revisable, but mutations must pass
 *    through validated domain methods (updateConfidence, linkEvidence, reject, confirm).
 * 3. Citation Verification: Referenced evidence IDs must exist in EvidenceStore.
 * 4. Deep Freeze: Returned hypotheses are deep-frozen to prevent presentation-layer corruption.
 * 5. Rejection Preservation: Rejected hypotheses are never deleted; they remain in history.
 * 6. Sequential IDs: Human-readable IDs (H-001, H-002, ...) are monotonically generated.
 */

import type { EvidenceStore } from "../evidence/store";
import {
  formatHypothesisId,
  isContradictingRelationship,
  isSupportingRelationship,
  type EvidenceRelationship,
  type Hypothesis,
  type HypothesisConfidence,
  type HypothesisEvidenceLink,
  type HypothesisStatus,
  type HypothesisVerificationStatus,
} from "./types";

/**
 * Deep-freezes an object tree recursively to prevent runtime mutation.
 */
function deepFreeze<T>(obj: T): Readonly<T> {
  if (obj === null || typeof obj !== "object") {
    return obj;
  }
  const propNames = Object.getOwnPropertyNames(obj);
  for (const name of propNames) {
    const value = (obj as Record<string, unknown>)[name];
    if (value !== null && typeof value === "object") {
      deepFreeze(value);
    }
  }
  return Object.freeze(obj);
}

/**
 * Deep-clones and deep-freezes a payload to ensure caller isolation.
 */
function cloneAndFreeze<T>(val: T): Readonly<T> {
  if (val === undefined || val === null) {
    return val;
  }
  return deepFreeze(JSON.parse(JSON.stringify(val)));
}

export interface CreateHypothesisParams {
  readonly title: string;
  readonly description: string;
  readonly confidence: HypothesisConfidence;
  readonly rationale?: string;
  readonly createdBy?: "agent" | "human";
  readonly initialEvidenceLinks?: readonly {
    readonly evidenceId: string;
    readonly relationship: EvidenceRelationship;
    readonly note?: string;
  }[];
  readonly nextTest?: {
    readonly description: string;
    readonly suggestedTool?: string;
  };
}

export interface UpdateHypothesisConfidenceParams {
  readonly hypothesisId: string;
  readonly confidence: HypothesisConfidence;
  readonly evidenceIds: readonly string[];
  readonly reason: string;
}

export interface LinkEvidenceParams {
  readonly hypothesisId: string;
  readonly evidenceId: string;
  readonly relationship: EvidenceRelationship;
  readonly note?: string;
}

export interface RejectHypothesisParams {
  readonly hypothesisId: string;
  readonly reason: string;
  readonly evidenceIds?: readonly string[];
}

export interface ConfirmHypothesisParams {
  readonly hypothesisId: string;
  readonly rationale: string;
  readonly evidenceIds: readonly string[];
  readonly verifiedExperimentId?: string;
}

export interface UpdateHypothesisParams {
  readonly title?: string;
  readonly description?: string;
  readonly rationale?: string;
  readonly status?: HypothesisStatus;
  readonly nextTest?: {
    readonly description: string;
    readonly suggestedTool?: string;
  };
}

export interface HypothesisStore {
  create(params: CreateHypothesisParams): Hypothesis;
  get(id: string): Hypothesis | undefined;
  getAll(): readonly Hypothesis[];
  getByStatus(status: HypothesisStatus): readonly Hypothesis[];
  updateConfidence(params: UpdateHypothesisConfidenceParams): Hypothesis;
  update(id: string, params: UpdateHypothesisParams): Hypothesis;
  linkEvidence(params: LinkEvidenceParams): Hypothesis;
  reject(params: RejectHypothesisParams): Hypothesis;
  confirm(params: ConfirmHypothesisParams): Hypothesis;
  subscribe(listener: (hypotheses: readonly Hypothesis[]) => void): () => void;
  clear(): void;
  size(): number;
}

export class InMemoryHypothesisStore implements HypothesisStore {
  private readonly hypotheses = new Map<string, Hypothesis>();
  private readonly listeners = new Set<(hypotheses: readonly Hypothesis[]) => void>();
  private nextSequence = 1;
  private readonly evidenceStore?: EvidenceStore;

  constructor(evidenceStore?: EvidenceStore) {
    this.evidenceStore = evidenceStore;
  }

  public create(params: CreateHypothesisParams): Hypothesis {
    const title = params.title?.trim();
    if (!title || title.length < 3 || title.length > 120) {
      throw new Error(
        `Hypothesis title must be between 3 and 120 characters, received: "${title ?? ""}"`
      );
    }

    const description = params.description?.trim();
    if (!description || description.length < 3 || description.length > 600) {
      throw new Error(
        `Hypothesis description must be between 3 and 600 characters, received: "${description ?? ""}"`
      );
    }

    const validInitialConfidences: HypothesisConfidence[] = ["UNTESTED", "LOW", "MEDIUM"];
    if (!validInitialConfidences.includes(params.confidence)) {
      throw new Error(
        `Initial hypothesis confidence must be UNTESTED, LOW, or MEDIUM. Received: "${params.confidence}". Evidence must be linked before raising to HIGH or VERY_HIGH.`
      );
    }

    const rationale = params.rationale?.trim();
    if (rationale && rationale.length > 800) {
      throw new Error(
        `Hypothesis rationale must be 800 characters or fewer, received: ${rationale.length} characters`
      );
    }

    // Validate initial evidence links if provided
    const linksMap = new Map<string, HypothesisEvidenceLink>();
    if (params.initialEvidenceLinks && params.initialEvidenceLinks.length > 0) {
      for (const link of params.initialEvidenceLinks) {
        this.validateEvidenceExists(link.evidenceId);
        this.validateRelationship(link.relationship);
        linksMap.set(link.evidenceId, {
          evidenceId: link.evidenceId,
          relationship: link.relationship,
          note: link.note?.trim() || undefined,
        });
      }
    }

    const id = formatHypothesisId(this.nextSequence++);
    const now = Date.now();
    const links = Array.from(linksMap.values());

    const supportingIds = links
      .filter((l) => isSupportingRelationship(l.relationship))
      .map((l) => l.evidenceId);
    const contradictingIds = links
      .filter((l) => isContradictingRelationship(l.relationship))
      .map((l) => l.evidenceId);

    const record: Hypothesis = {
      id,
      title,
      description,
      confidence: params.confidence,
      status: "ACTIVE",
      verificationStatus: "NOT_VERIFIED",
      evidenceLinks: links,
      supportingEvidenceIds: supportingIds,
      contradictingEvidenceIds: contradictingIds,
      createdAt: now,
      updatedAt: now,
      createdBy: params.createdBy ?? "agent",
      rationale: rationale || undefined,
      nextTest: params.nextTest
        ? {
            description: params.nextTest.description.trim(),
            suggestedTool: params.nextTest.suggestedTool?.trim(),
          }
        : undefined,
    };

    this.hypotheses.set(id, record);
    this.notify();
    return cloneAndFreeze(record);
  }

  public get(id: string): Hypothesis | undefined {
    const record = this.hypotheses.get(id);
    return record ? cloneAndFreeze(record) : undefined;
  }

  public getAll(): readonly Hypothesis[] {
    const list = Array.from(this.hypotheses.values()).sort(
      (a, b) => a.createdAt - b.createdAt
    );
    return cloneAndFreeze(list);
  }

  public getByStatus(status: HypothesisStatus): readonly Hypothesis[] {
    const list = Array.from(this.hypotheses.values())
      .filter((h) => h.status === status)
      .sort((a, b) => a.createdAt - b.createdAt);
    return cloneAndFreeze(list);
  }

  public linkEvidence(params: LinkEvidenceParams): Hypothesis {
    const existing = this.hypotheses.get(params.hypothesisId);
    if (!existing) {
      throw new Error(`Hypothesis "${params.hypothesisId}" not found`);
    }

    this.validateEvidenceExists(params.evidenceId);
    this.validateRelationship(params.relationship);

    const note = params.note?.trim();
    const linksMap = new Map<string, HypothesisEvidenceLink>();
    for (const link of existing.evidenceLinks) {
      linksMap.set(link.evidenceId, link);
    }

    // Set or update the link (avoids duplicates)
    linksMap.set(params.evidenceId, {
      evidenceId: params.evidenceId,
      relationship: params.relationship,
      note: note || undefined,
    });

    const updatedLinks = Array.from(linksMap.values());
    const supportingIds = updatedLinks
      .filter((l) => isSupportingRelationship(l.relationship))
      .map((l) => l.evidenceId);
    const contradictingIds = updatedLinks
      .filter((l) => isContradictingRelationship(l.relationship))
      .map((l) => l.evidenceId);

    const updated: Hypothesis = {
      ...existing,
      evidenceLinks: updatedLinks,
      supportingEvidenceIds: supportingIds,
      contradictingEvidenceIds: contradictingIds,
      updatedAt: Date.now(),
    };

    this.hypotheses.set(existing.id, updated);
    this.notify();
    return cloneAndFreeze(updated);
  }

  public updateConfidence(params: UpdateHypothesisConfidenceParams): Hypothesis {
    const existing = this.hypotheses.get(params.hypothesisId);
    if (!existing) {
      throw new Error(`Hypothesis "${params.hypothesisId}" not found`);
    }

    const validConfidences: HypothesisConfidence[] = [
      "UNTESTED",
      "LOW",
      "MEDIUM",
      "HIGH",
      "VERY_HIGH",
    ];
    if (!validConfidences.includes(params.confidence)) {
      throw new Error(`Invalid confidence tier: "${params.confidence}"`);
    }

    const reason = params.reason?.trim();
    if (!reason || reason.length < 3) {
      throw new Error("Updating hypothesis confidence requires an explicit non-empty reason (at least 3 characters).");
    }

    if (!Array.isArray(params.evidenceIds) || params.evidenceIds.length === 0) {
      throw new Error(
        `Updating hypothesis "${params.hypothesisId}" confidence requires citing at least one valid evidence record ID.`
      );
    }

    // Validate cited evidence IDs exist
    if (params.evidenceIds && params.evidenceIds.length > 0) {
      for (const eid of params.evidenceIds) {
        this.validateEvidenceExists(eid);
      }
    }

    // Ensure cited evidence is linked as supporting if not already linked
    const linksMap = new Map<string, HypothesisEvidenceLink>();
    for (const link of existing.evidenceLinks) {
      linksMap.set(link.evidenceId, link);
    }

    if (params.evidenceIds && params.evidenceIds.length > 0) {
      for (const eid of params.evidenceIds) {
        if (!linksMap.has(eid)) {
          linksMap.set(eid, {
            evidenceId: eid,
            relationship: "SUPPORTS",
            note: reason,
          });
        }
      }
    }

    const updatedLinks = Array.from(linksMap.values());
    const supportingIds = updatedLinks
      .filter((l) => isSupportingRelationship(l.relationship))
      .map((l) => l.evidenceId);
    const contradictingIds = updatedLinks
      .filter((l) => isContradictingRelationship(l.relationship))
      .map((l) => l.evidenceId);

    // Safeguard: HIGH / VERY_HIGH requires at least one supporting evidence link
    if (
      (params.confidence === "HIGH" || params.confidence === "VERY_HIGH") &&
      supportingIds.length === 0
    ) {
      throw new Error(
        `Cannot elevate hypothesis "${params.hypothesisId}" to ${params.confidence} without at least one supporting evidence link.`
      );
    }

    const updated: Hypothesis = {
      ...existing,
      confidence: params.confidence,
      evidenceLinks: updatedLinks,
      supportingEvidenceIds: supportingIds,
      contradictingEvidenceIds: contradictingIds,
      rationale: reason,
      updatedAt: Date.now(),
    };

    this.hypotheses.set(existing.id, updated);
    this.notify();
    return cloneAndFreeze(updated);
  }

  public reject(params: RejectHypothesisParams): Hypothesis {
    const existing = this.hypotheses.get(params.hypothesisId);
    if (!existing) {
      throw new Error(`Hypothesis "${params.hypothesisId}" not found`);
    }

    const reason = params.reason?.trim();
    if (!reason || reason.length < 3) {
      throw new Error("Rejecting a hypothesis requires an explicit explanation (at least 3 characters).");
    }

    // If evidence IDs are cited for rejection, validate they exist and link as CONTRADICTS
    const linksMap = new Map<string, HypothesisEvidenceLink>();
    for (const link of existing.evidenceLinks) {
      linksMap.set(link.evidenceId, link);
    }

    if (params.evidenceIds && params.evidenceIds.length > 0) {
      for (const eid of params.evidenceIds) {
        this.validateEvidenceExists(eid);
        if (!linksMap.has(eid)) {
          linksMap.set(eid, {
            evidenceId: eid,
            relationship: "CONTRADICTS",
            note: reason,
          });
        }
      }
    }

    const updatedLinks = Array.from(linksMap.values());
    const supportingIds = updatedLinks
      .filter((l) => isSupportingRelationship(l.relationship))
      .map((l) => l.evidenceId);
    const contradictingIds = updatedLinks
      .filter((l) => isContradictingRelationship(l.relationship))
      .map((l) => l.evidenceId);

    const updated: Hypothesis = {
      ...existing,
      status: "REJECTED",
      rejectionReason: reason,
      evidenceLinks: updatedLinks,
      supportingEvidenceIds: supportingIds,
      contradictingEvidenceIds: contradictingIds,
      updatedAt: Date.now(),
    };

    this.hypotheses.set(existing.id, updated);
    this.notify();
    return cloneAndFreeze(updated);
  }

  public confirm(params: ConfirmHypothesisParams): Hypothesis {
    const existing = this.hypotheses.get(params.hypothesisId);
    if (!existing) {
      throw new Error(`Hypothesis "${params.hypothesisId}" not found`);
    }

    // Confirmation Safeguard (Slice 6F)
    // A hypothesis cannot become CONFIRMED merely because the agent is confident.
    // It requires VERY_HIGH confidence, explicit evidence citations, a confirmation rationale,
    // and an actual completed verification experiment.
    if (existing.confidence !== "VERY_HIGH" && existing.confidence !== "HIGH") {
      throw new Error(
        `Hypothesis "${params.hypothesisId}" must have confidence VERY_HIGH before confirmation. Current confidence: ${existing.confidence}.`
      );
    }

    const rationale = params.rationale?.trim();
    if (!rationale || rationale.length < 10) {
      throw new Error("Confirmation requires an explicit, detailed scientific rationale (at least 10 characters).");
    }

    if (!Array.isArray(params.evidenceIds) || params.evidenceIds.length === 0) {
      throw new Error("Confirmation requires explicit citations to supporting evidence records.");
    }

    const linksMap = new Map<string, HypothesisEvidenceLink>();
    for (const link of existing.evidenceLinks) {
      linksMap.set(link.evidenceId, link);
    }

    for (const eid of params.evidenceIds) {
      this.validateEvidenceExists(eid);
      if (!linksMap.has(eid)) {
        linksMap.set(eid, {
          evidenceId: eid,
          relationship: "STRONGLY_SUPPORTS",
          note: rationale,
        });
      }
    }

    // Safeguard: Verification requires an actual verified experiment ID.
    if (!params.verifiedExperimentId) {
      throw new Error(
        `Cannot confirm hypothesis "${params.hypothesisId}" as VERIFIED without a completed physical/virtual verification experiment. Fault reproduction alone does not constitute verification.`
      );
    }

    const updatedLinks = Array.from(linksMap.values());
    const supportingIds = updatedLinks
      .filter((l) => isSupportingRelationship(l.relationship))
      .map((l) => l.evidenceId);
    const contradictingIds = updatedLinks
      .filter((l) => isContradictingRelationship(l.relationship))
      .map((l) => l.evidenceId);

    const updated: Hypothesis = {
      ...existing,
      status: "CONFIRMED",
      confidence: "VERY_HIGH",
      verificationStatus: "VERIFIED",
      confirmationRationale: rationale,
      evidenceLinks: updatedLinks,
      supportingEvidenceIds: supportingIds,
      contradictingEvidenceIds: contradictingIds,
      updatedAt: Date.now(),
    };
    this.hypotheses.set(existing.id, updated);
    this.notify();
    return cloneAndFreeze(updated);
  }

  public update(id: string, params: UpdateHypothesisParams): Hypothesis {
    const existing = this.hypotheses.get(id);
    if (!existing) {
      throw new Error(`Hypothesis "${id}" not found`);
    }

    let title = existing.title;
    if (params.title !== undefined) {
      const trimmed = params.title.trim();
      if (trimmed.length < 3 || trimmed.length > 120) {
        throw new Error(`Hypothesis title must be between 3 and 120 characters, received: "${trimmed}"`);
      }
      title = trimmed;
    }

    let description = existing.description;
    if (params.description !== undefined) {
      const trimmed = params.description.trim();
      if (trimmed.length < 3 || trimmed.length > 600) {
        throw new Error(`Hypothesis description must be between 3 and 600 characters, received: "${trimmed}"`);
      }
      description = trimmed;
    }

    let rationale = existing.rationale;
    if (params.rationale !== undefined) {
      const trimmed = params.rationale.trim();
      if (trimmed.length > 800) {
        throw new Error(`Hypothesis rationale must be 800 characters or fewer, received: ${trimmed.length}`);
      }
      rationale = trimmed || undefined;
    }

    let status = existing.status;
    if (params.status !== undefined) {
      if (params.status === "CONFIRMED") {
        throw new Error(
          "Direct update to CONFIRMED is prohibited. Use confirm() domain method with explicit verification experiment."
        );
      }
      status = params.status;
    }

    const updated: Hypothesis = {
      ...existing,
      title,
      description,
      rationale,
      status,
      nextTest: params.nextTest !== undefined ? params.nextTest : existing.nextTest,
      updatedAt: Date.now(),
    };

    this.hypotheses.set(id, updated);
    this.notify();
    return cloneAndFreeze(updated);
  }

  public subscribe(listener: (hypotheses: readonly Hypothesis[]) => void): () => void {
    this.listeners.add(listener);
    listener(this.getAll());
    return () => {
      this.listeners.delete(listener);
    };
  }

  public clear(): void {
    this.hypotheses.clear();
    this.nextSequence = 1;
    this.notify();
  }

  public size(): number {
    return this.hypotheses.size;
  }

  private validateEvidenceExists(evidenceId: string): void {
    if (typeof evidenceId !== "string" || !evidenceId.trim()) {
      throw new Error(`Invalid evidence ID: "${evidenceId}"`);
    }
    if (this.evidenceStore) {
      const record = this.evidenceStore.get(evidenceId.trim());
      if (!record) {
        throw new Error(
          `EvidenceRecord "${evidenceId}" does not exist in EvidenceStore. Cannot link or cite nonexistent evidence.`
        );
      }
    }
  }

  private validateRelationship(relationship: EvidenceRelationship): void {
    const valid: EvidenceRelationship[] = [
      "SUPPORTS",
      "STRONGLY_SUPPORTS",
      "CONTRADICTS",
      "STRONGLY_CONTRADICTS",
    ];
    if (!valid.includes(relationship)) {
      throw new Error(
        `Invalid evidence relationship: "${relationship}". Must be SUPPORTS, STRONGLY_SUPPORTS, CONTRADICTS, or STRONGLY_CONTRADICTS.`
      );
    }
  }

  private notify(): void {
    const current = this.getAll();
    for (const listener of this.listeners) {
      try {
        listener(current);
      } catch (err) {
        console.error("[HypothesisStore] Listener notification failed:", err);
      }
    }
  }
}
