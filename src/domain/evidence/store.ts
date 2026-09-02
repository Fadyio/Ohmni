/**
 * Immutable Evidence Store.
 * Provides durable, tamper-proof in-memory storage for factual EvidenceRecords.
 *
 * Core Invariants:
 * 1. Evidence is IMMUTABLE — no updates, replacements, or edits are permitted.
 * 2. If new observations contradict prior facts, a new EvidenceRecord is appended.
 * 3. Records and nested payloads are deep-frozen to prevent presentation-layer corruption.
 * 4. Human-readable sequential IDs (E-001, E-002, ...) are monotonically assigned.
 * 5. Distinct provenance (device vs experiment vs human) is strictly preserved.
 */

import {
  formatEvidenceId,
  parseEvidenceIdSequence,
  type EvidenceProvenance,
  type EvidenceRecord,
  type EvidenceSource,
  type EvidenceType,
} from "./types";

/**
 * Deep-freezes an object tree recursively to prevent runtime mutation.
 */
function deepFreeze<T>(obj: T): Readonly<T> {
  if (obj === null || typeof obj !== "object") {
    return obj;
  }

  // Freeze properties first
  for (const key of Object.keys(obj as object)) {
    const val = (obj as Record<string, unknown>)[key];
    if (val !== null && typeof val === "object" && !Object.isFrozen(val)) {
      deepFreeze(val);
    }
  }

  return Object.freeze(obj);
}

/**
 * Deep-clones and deep-freezes a payload to ensure isolation.
 */
function cloneAndFreeze<T>(val: T): Readonly<T> {
  if (val === null || typeof val !== "object") {
    return val;
  }
  try {
    const cloned = structuredClone(val);
    return deepFreeze(cloned);
  } catch {
    return deepFreeze(val);
  }
}

export interface CreateEvidenceParams {
  readonly id?: string;
  readonly type: EvidenceType;
  readonly summary: string;
  readonly createdAt?: number;
  readonly experimentId?: string;
  readonly sourceTool?: string;
  readonly source: EvidenceSource;
  readonly data?: unknown;
  readonly provenance: EvidenceProvenance;
}

export interface CreateHumanObservationParams {
  readonly id?: string;
  readonly summary: string;
  readonly createdAt?: number;
  readonly data?: unknown;
  readonly notes?: string;
  readonly interventionPointId?: string;
}

export interface EvidenceStore {
  /**
   * Appends an immutable evidence record.
   * Throws if an evidence record with the same ID already exists.
   */
  add(record: EvidenceRecord): Readonly<EvidenceRecord>;

  /**
   * Helper to construct, validate, and append an evidence record.
   * Monotonically assigns the next E-xxx ID if none is specified.
   */
  createAndAdd(params: CreateEvidenceParams): Readonly<EvidenceRecord>;

  /**
   * Helper to construct, validate, and append a human observation.
   * Monotonically assigns the next E-xxx ID if none is specified.
   */
  addHumanObservation(params: CreateHumanObservationParams): Readonly<EvidenceRecord>;
  /**
   * Retrieves an evidence record by its compact identifier (e.g. "E-001").
   */
  get(id: string): Readonly<EvidenceRecord> | undefined;

  /**
   * Returns all recorded evidence records in chronological insertion order.
   */
  getAll(): readonly Readonly<EvidenceRecord>[];

  /**
   * Returns all evidence records correlated with a specific experiment ID.
   */
  getByExperiment(experimentId: string): readonly Readonly<EvidenceRecord>[];

  /**
   * Returns the count of recorded evidence records.
   */
  count(): number;

  /**
   * Computes the next monotonic sequence identifier.
   */
  nextEvidenceId(): string;

  /**
   * Subscribes a listener callback to new evidence arrivals.
   * Returns an unsubscribe function.
   */
  subscribe(listener: (record: Readonly<EvidenceRecord>) => void): () => void;

  /**
   * Resets the store for testing.
   */
  clear(): void;
}

export class InMemoryEvidenceStore implements EvidenceStore {
  private readonly records: Map<string, Readonly<EvidenceRecord>> = new Map();
  private readonly orderedIds: string[] = [];
  private readonly listeners: Set<(record: Readonly<EvidenceRecord>) => void> = new Set();
  private maxSequence = 0;

  public add(record: EvidenceRecord): Readonly<EvidenceRecord> {
    if (!record.id || typeof record.id !== "string") {
      throw new Error("Evidence record must possess a non-empty string identifier");
    }

    if (this.records.has(record.id)) {
      throw new Error(`Evidence record with ID ${record.id} already exists. Evidence is immutable and cannot be rewritten.`);
    }

    // Update sequence tracker if matching standard E-xxx format
    const seq = parseEvidenceIdSequence(record.id);
    if (seq !== null && seq > this.maxSequence) {
      this.maxSequence = seq;
    }

    // Deep freeze defensively
    const frozenRecord: Readonly<EvidenceRecord> = deepFreeze({
      id: record.id,
      type: record.type,
      summary: record.summary,
      createdAt: record.createdAt ?? Date.now(),
      experimentId: record.experimentId,
      sourceTool: record.sourceTool,
      source: record.source,
      data: cloneAndFreeze(record.data),
      provenance: cloneAndFreeze(record.provenance),
    });

    this.records.set(frozenRecord.id, frozenRecord);
    this.orderedIds.push(frozenRecord.id);

    // Notify active subscribers
    for (const listener of this.listeners) {
      try {
        listener(frozenRecord);
      } catch (err) {
        console.error("[EvidenceStore] Listener error:", err);
      }
    }

    return frozenRecord;
  }

  public createAndAdd(params: CreateEvidenceParams): Readonly<EvidenceRecord> {
    const id = params.id ?? this.nextEvidenceId();
    const record: EvidenceRecord = {
      id,
      type: params.type,
      summary: params.summary,
      createdAt: params.createdAt ?? Date.now(),
      experimentId: params.experimentId,
      sourceTool: params.sourceTool,
      source: params.source,
      data: params.data ?? null,
      provenance: params.provenance,
    };
    return this.add(record);
  }
  public addHumanObservation(params: CreateHumanObservationParams): Readonly<EvidenceRecord> {
    const id = params.id ?? this.nextEvidenceId();
    const record = createHumanObservation({ ...params, id });
    return this.add(record);
  }

  public get(id: string): Readonly<EvidenceRecord> | undefined {
    return this.records.get(id);
  }

  public getAll(): readonly Readonly<EvidenceRecord>[] {
    return this.orderedIds.map((id) => this.records.get(id)!);
  }

  public getByExperiment(experimentId: string): readonly Readonly<EvidenceRecord>[] {
    return this.orderedIds
      .map((id) => this.records.get(id)!)
      .filter((rec) => rec.experimentId === experimentId);
  }

  public count(): number {
    return this.records.size;
  }

  public nextEvidenceId(): string {
    return formatEvidenceId(this.maxSequence + 1);
  }

  public subscribe(listener: (record: Readonly<EvidenceRecord>) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public clear(): void {
    this.records.clear();
    this.orderedIds.length = 0;
    this.maxSequence = 0;
  }
}

/**
 * Helper to construct a validated human physical observation EvidenceRecord.
 * Explicitly tags source as "human" and origin as "human" to ensure strict
 * distinction from instrument measurements.
 */
export function createHumanObservation(params: CreateHumanObservationParams): EvidenceRecord {
  const provenance: EvidenceProvenance = {
    origin: "human",
    interventionPointId: params.interventionPointId,
    notes: params.notes,
  };

  return {
    id: params.id ?? "E-001",
    type: "human_observation",
    summary: params.summary,
    createdAt: params.createdAt ?? Date.now(),
    source: "human",
    data: params.data ?? { notes: params.notes },
    provenance,
  };
}
