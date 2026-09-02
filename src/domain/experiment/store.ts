/**
 * In-memory storage for ExperimentRecords.
 * Provides local durability for experiment history, trace playback,
 * and correlation lookup.
 */

import type { ExperimentRecord } from "./types";

export interface ExperimentStore {
  save(record: ExperimentRecord): void;
  getExperiment(id: string): ExperimentRecord | undefined;
  getExperiments(): readonly ExperimentRecord[];
  latest(): ExperimentRecord | undefined;
  clear(): void;
  count(): number;
}

export class InMemoryExperimentStore implements ExperimentStore {
  private readonly records: Map<string, ExperimentRecord> = new Map();
  private readonly orderedIds: string[] = [];

  public save(record: ExperimentRecord): void {
    const { id } = record.metadata;
    if (!this.records.has(id)) {
      this.orderedIds.push(id);
    }
    this.records.set(id, record);
  }

  public getExperiment(id: string): ExperimentRecord | undefined {
    return this.records.get(id);
  }

  public getExperiments(): readonly ExperimentRecord[] {
    return this.orderedIds.map((id) => this.records.get(id)!);
  }

  public latest(): ExperimentRecord | undefined {
    if (this.orderedIds.length === 0) {
      return undefined;
    }
    const lastId = this.orderedIds[this.orderedIds.length - 1];
    return this.records.get(lastId);
  }

  public clear(): void {
    this.records.clear();
    this.orderedIds.length = 0;
  }

  public count(): number {
    return this.records.size;
  }
}
