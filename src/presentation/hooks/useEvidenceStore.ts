/**
 * React hook to subscribe to and observe immutable EvidenceStore records.
 * Provides reactive updates whenever new factual evidence is recorded.
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import type { EvidenceRecord } from "@/domain/evidence/types";
import type { EvidenceStore } from "@/domain/evidence/store";

export interface UseEvidenceStoreResult {
  readonly records: readonly EvidenceRecord[];
  readonly count: number;
  readonly getByExperiment: (experimentId: string) => readonly EvidenceRecord[];
  readonly getById: (id: string) => EvidenceRecord | undefined;
}

export function useEvidenceStore(store?: EvidenceStore): UseEvidenceStoreResult {
  const resolvedStore = useMemo(() => {
    return (
      store ??
      (typeof window !== "undefined" ? (window as unknown as { __evidenceStore?: EvidenceStore }).__evidenceStore : undefined)
    );
  }, [store]);

  const [records, setRecords] = useState<readonly EvidenceRecord[]>(() => {
    return resolvedStore ? resolvedStore.getAll() : [];
  });

  useEffect(() => {
    if (!resolvedStore) {
      setRecords([]);
      return;
    }

    // Initialize with current store contents
    setRecords(resolvedStore.getAll());

    // Subscribe to new arrivals
    const unsubscribe = resolvedStore.subscribe(() => {
      setRecords(resolvedStore.getAll());
    });

    return () => {
      unsubscribe();
    };
  }, [resolvedStore]);

  const getByExperiment = useCallback(
    (experimentId: string) => {
      if (!resolvedStore) return [];
      return resolvedStore.getByExperiment(experimentId);
    },
    [resolvedStore]
  );

  const getById = useCallback(
    (id: string) => {
      if (!resolvedStore) return undefined;
      return resolvedStore.get(id);
    },
    [resolvedStore]
  );

  return {
    records,
    count: records.length,
    getByExperiment,
    getById,
  };
}
