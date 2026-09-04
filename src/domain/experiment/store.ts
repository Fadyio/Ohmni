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
  subscribe?(listener: (records: readonly ExperimentRecord[]) => void): () => void;
}

export class InMemoryExperimentStore implements ExperimentStore {
  private readonly records: Map<string, ExperimentRecord> = new Map();
  private readonly orderedIds: string[] = [];
  private readonly listeners: Set<(records: readonly ExperimentRecord[]) => void> = new Set();

  public save(record: ExperimentRecord): void {
    const { id } = record.metadata;
    if (!this.records.has(id)) {
      this.orderedIds.push(id);
    }
    this.records.set(id, record);
    this.notify();
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
    this.notify();
  }

  public count(): number {
    return this.records.size;
  }

  public subscribe(listener: (records: readonly ExperimentRecord[]) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    const records = this.getExperiments();
    for (const listener of this.listeners) {
      try {
        listener(records);
      } catch (err) {
        console.error("Error in ExperimentStore listener:", err);
      }
    }
  }
}
