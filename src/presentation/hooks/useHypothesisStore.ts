/**
 * React hook to subscribe to and observe HypothesisStore records.
 * Provides reactive updates whenever hypotheses are proposed, updated, linked, or rejected.
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import type { Hypothesis, HypothesisStatus } from "@/domain/hypothesis/types";
import type { HypothesisStore } from "@/domain/hypothesis/store";

export interface UseHypothesisStoreResult {
  readonly hypotheses: readonly Hypothesis[];
  readonly activeHypotheses: readonly Hypothesis[];
  readonly rejectedHypotheses: readonly Hypothesis[];
  readonly count: number;
  readonly activeCount: number;
  readonly getById: (id: string) => Hypothesis | undefined;
  readonly getByStatus: (status: HypothesisStatus) => readonly Hypothesis[];
}

export function useHypothesisStore(store?: HypothesisStore): UseHypothesisStoreResult {
  const resolvedStore = useMemo(() => {
    return (
      store ??
      (typeof window !== "undefined"
        ? (window as unknown as { __hypothesisStore?: HypothesisStore }).__hypothesisStore
        : undefined)
    );
  }, [store]);

  const [hypotheses, setHypotheses] = useState<readonly Hypothesis[]>(() => {
    return resolvedStore ? resolvedStore.getAll() : [];
  });

  useEffect(() => {
    if (!resolvedStore) {
      setHypotheses([]);
      return;
    }

    // Initialize with current store contents
    setHypotheses(resolvedStore.getAll());

    // Subscribe to store updates
    const unsubscribe = resolvedStore.subscribe((updatedList) => {
      setHypotheses(updatedList);
    });

    return () => {
      unsubscribe();
    };
  }, [resolvedStore]);

  const activeHypotheses = useMemo(() => {
    return hypotheses.filter((h) => h.status === "ACTIVE");
  }, [hypotheses]);

  const rejectedHypotheses = useMemo(() => {
    return hypotheses.filter((h) => h.status === "REJECTED");
  }, [hypotheses]);

  const getById = useCallback(
    (id: string) => {
      if (!resolvedStore) return undefined;
      return resolvedStore.get(id);
    },
    [resolvedStore]
  );

  const getByStatus = useCallback(
    (status: HypothesisStatus) => {
      if (!resolvedStore) return [];
      return resolvedStore.getByStatus(status);
    },
    [resolvedStore]
  );

  return {
    hypotheses,
    activeHypotheses,
    rejectedHypotheses,
    count: hypotheses.length,
    activeCount: activeHypotheses.length,
    getById,
    getByStatus,
  };
}
