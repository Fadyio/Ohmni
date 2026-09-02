import { useCallback, useEffect, useRef, useState } from "react";
import {
  HttpBenchAgentProvider,
  fetchBenchAgentAvailability,
} from "@/infrastructure/bench-agent/http-provider";
import { runBenchAgent } from "@/infrastructure/bench-agent/run-bench-agent";
import type {
  AgentFunctionCall,
  BenchAgentEvent,
  BenchAgentRunResult,
} from "@/infrastructure/bench-agent/types";
import type { RegisteredTool } from "@/infrastructure/webmcp/types";

export type BenchAgentActivityStatus =
  | "requested"
  | "waiting-approval"
  | "completed"
  | "unavailable"
  | "denied"
  | "failed";

export interface BenchAgentActivity {
  readonly call: AgentFunctionCall;
  readonly status: BenchAgentActivityStatus;
  readonly result?: string;
  readonly message?: string;
  readonly durationMs?: number;
}

export type BenchAgentProviderStatus =
  | "unconfigured"
  | "configured"
  | "live"
  | "error";

interface BenchAgentStateBase {
  readonly goal: string;
  readonly runGoal?: string;
  readonly activity: readonly BenchAgentActivity[];
  readonly providerAvailable: boolean;
  readonly providerStatus: BenchAgentProviderStatus;
}
export type BenchAgentState =
  | (BenchAgentStateBase & {
      readonly status: "idle";
      readonly checkingAvailability: boolean;
    })
  | (BenchAgentStateBase & {
      readonly status: "investigating";
      readonly steps: number;
    })
  | (BenchAgentStateBase & {
      readonly status: "approval";
      readonly steps: number;
      readonly approval: {
        readonly call: AgentFunctionCall;
        readonly tool: RegisteredTool;
      };
    })
  | (BenchAgentStateBase & {
      readonly status: "completed";
      readonly steps: number;
      readonly assessment: string;
    })
  | (BenchAgentStateBase & {
      readonly status: "stopped";
      readonly steps: number;
    })
  | (BenchAgentStateBase & {
      readonly status: "unavailable";
      readonly message: string;
    })
  | (BenchAgentStateBase & {
      readonly status: "failed";
      readonly steps: number;
      readonly message: string;
      readonly requestId?: string;
    })
  | (BenchAgentStateBase & {
      readonly status: "step-limit";
      readonly steps: number;
    });

type ActiveBenchAgentState = Extract<
  BenchAgentState,
  { status: "investigating" | "approval" }
>;

export interface UseBenchAgentResult {
  readonly state: BenchAgentState;
  readonly setGoal: (goal: string) => void;
  readonly start: () => void;
  readonly sendObservation: (observation: string) => void;
  readonly stop: () => void;
  readonly approve: () => void;
  readonly deny: () => void;
}

interface PendingApproval {
  readonly runId: number;
  readonly resolve: (approved: boolean) => void;
}

const initialState: BenchAgentState = {
  status: "idle",
  checkingAvailability: true,
  goal: "",
  activity: [],
  providerAvailable: false,
  providerStatus: "unconfigured",
};

function updateActivity(
  activity: readonly BenchAgentActivity[],
  event: BenchAgentEvent,
): readonly BenchAgentActivity[] {
  if (event.type === "tool-requested") {
    return [...activity, { call: event.call, status: "requested" }];
  }

  const index = activity.findLastIndex((item) => item.call.id === event.call.id);
  if (index < 0) {
    return activity;
  }

  const current = activity[index];
  let updated: BenchAgentActivity;
  switch (event.type) {
    case "approval-requested":
      updated = { ...current, call: event.call, status: "waiting-approval" };
      break;
    case "tool-completed":
      updated = {
        ...current,
        call: event.call,
        status: "completed",
        result: event.result,
        durationMs: event.durationMs,
      };
      break;
    case "tool-unavailable":
      updated = {
        ...current,
        call: event.call,
        status: "unavailable",
        message: event.message,
      };
      break;
    case "tool-denied":
      updated = {
        ...current,
        call: event.call,
        status: "denied",
        message: event.message,
      };
      break;
    case "tool-failed":
      updated = {
        ...current,
        call: event.call,
        status: "failed",
        message: event.message,
        durationMs: event.durationMs,
      };
      break;
  }

  return activity.map((item, itemIndex) => (itemIndex === index ? updated : item));
}

function resultState(
  current: BenchAgentState,
  result: BenchAgentRunResult,
): BenchAgentState {
  const isSuccess = result.status === "completed" || result.status === "stopped" || result.status === "step-limit";
  const nextProviderStatus: BenchAgentProviderStatus =
    result.status === "failed" ? "error" : isSuccess && result.steps > 0 ? "live" : current.providerStatus;

  const common = {
    goal: current.goal,
    runGoal: current.runGoal,
    activity: current.activity,
    providerAvailable: true,
    providerStatus: nextProviderStatus,
    steps: result.steps,
  };

  switch (result.status) {
    case "completed":
      return { ...common, status: "completed", assessment: result.text };
    case "stopped":
      return { ...common, status: "stopped" };
    case "step-limit":
      return { ...common, status: "step-limit" };
    case "failed":
      return {
        ...common,
        status: "failed",
        message: result.message,
        requestId: result.requestId,
      };
  }
}

function isActive(state: BenchAgentState): state is ActiveBenchAgentState {
  return state.status === "investigating" || state.status === "approval";
}

function stepCount(activity: readonly BenchAgentActivity[]): number {
  return activity.length;
}

export function useBenchAgent(isConnected: boolean): UseBenchAgentResult {
  const [provider] = useState(() => new HttpBenchAgentProvider());
  const [state, setReactState] = useState<BenchAgentState>(initialState);
  const stateRef = useRef<BenchAgentState>(initialState);
  const mountedRef = useRef(true);
  const controllerRef = useRef<AbortController | null>(null);
  const pendingApprovalRef = useRef<PendingApproval | null>(null);
  const nextRunIdRef = useRef(0);
  const activeRunIdRef = useRef(0);
  const lastInteractionIdRef = useRef<string | undefined>(undefined);
  const commit = useCallback((next: BenchAgentState) => {
    stateRef.current = next;
    if (mountedRef.current) {
      setReactState(next);
    }
  }, []);

  useEffect(() => {
    let current = true;

    void fetchBenchAgentAvailability()
      .then((availability) => {
        if (!current || !mountedRef.current) return;
        const previous = stateRef.current;
        if (availability.available) {
          commit({
            status: "idle",
            checkingAvailability: false,
            goal: previous.goal,
            activity: [],
            providerAvailable: true,
            providerStatus: previous.providerStatus === "live" ? "live" : "configured",
          });
          return;
        }
        commit({
          status: "unavailable",
          goal: previous.goal,
          activity: [],
          providerAvailable: false,
          providerStatus: "unconfigured",
          message: "Gemini API key is not configured.",
        });
      })
      .catch((error: unknown) => {
        if (!current || !mountedRef.current) return;
        const previous = stateRef.current;
        const requestId = typeof (error as { requestId?: unknown })?.requestId === "string" ? (error as { requestId: string }).requestId : undefined;
        commit({
          status: "failed",
          goal: previous.goal,
          activity: [],
          providerAvailable: false,
          providerStatus: "error",
          steps: 0,
          requestId,
          message: error instanceof Error ? error.message : "Unable to check Bench Agent availability.",
        });
      });

    return () => {
      current = false;
    };
  }, [commit]);

  const setGoal = useCallback(
    (goal: string) => {
      commit({ ...stateRef.current, goal });
    },
    [commit],
  );

  const settleApproval = useCallback(
    (approved: boolean) => {
      const pending = pendingApprovalRef.current;
      if (!pending || pending.runId !== activeRunIdRef.current) return;
      pendingApprovalRef.current = null;
      const current = stateRef.current;
      if (current.status === "approval") {
        commit({
          status: "investigating",
          goal: current.goal,
          runGoal: current.runGoal,
          activity: current.activity,
          providerAvailable: true,
          providerStatus: current.providerStatus,
          steps: current.steps,
        });
      }
      pending.resolve(approved);
    },
    [commit],
  );

  const stop = useCallback(() => {
    const current = stateRef.current;
    if (!isActive(current)) return;

    const pending = pendingApprovalRef.current;
    pendingApprovalRef.current = null;
    controllerRef.current?.abort();
    pending?.resolve(false);

    commit({
      status: "stopped",
      goal: current.goal,
      runGoal: current.runGoal,
      activity: current.activity,
      providerAvailable: true,
      providerStatus: current.providerStatus,
      steps: stepCount(current.activity),
    });
  }, [commit]);

  const start = useCallback(() => {
    const previous = stateRef.current;
    const goal = previous.goal.trim();
    const modelContext = document.modelContext;
    if (!goal || !previous.providerAvailable || isActive(previous)) return;

    if (!modelContext) {
      commit({
        status: "failed",
        goal: previous.goal,
        activity: [],
        providerAvailable: true,
        providerStatus: previous.providerStatus,
        steps: 0,
        message: "WebMCP model context is unavailable.",
      });
      return;
    }
    const runId = ++nextRunIdRef.current;
    activeRunIdRef.current = runId;
    const controller = new AbortController();
    controllerRef.current = controller;
    pendingApprovalRef.current = null;

    commit({
      status: "investigating",
      goal: previous.goal,
      runGoal: goal,
      activity: [],
      providerAvailable: true,
      providerStatus: previous.providerStatus === "live" ? "live" : "configured",
      steps: 0,
    });
    const onEvent = (event: BenchAgentEvent) => {
      if (activeRunIdRef.current !== runId) return;
      const current = stateRef.current;
      if (!isActive(current)) return;
      const activity = updateActivity(current.activity, event);
      if (event.type === "approval-requested") {
        commit({
          status: "approval",
          goal: current.goal,
          runGoal: current.runGoal,
          activity,
          providerAvailable: true,
          providerStatus: "live",
          steps: stepCount(activity),
          approval: { call: event.call, tool: event.tool },
        });
        return;
      }
      commit({ ...current, activity, providerStatus: "live", steps: stepCount(activity) });
    };
    void runBenchAgent({
      goal,
      modelContext,
      provider,
      signal: controller.signal,
      onEvent,
      requestApproval: ({ call, tool }) => {
        if (activeRunIdRef.current !== runId || controller.signal.aborted) {
          return Promise.resolve(false);
        }

        return new Promise<boolean>((resolve) => {
          const previousPending = pendingApprovalRef.current;
          pendingApprovalRef.current = { runId, resolve };
          previousPending?.resolve(false);

          const current = stateRef.current;
          commit({
            status: "approval",
            goal: current.goal,
            runGoal: current.runGoal,
            activity: current.activity,
            providerAvailable: true,
            providerStatus: "live",
            steps: stepCount(current.activity),
            approval: { call, tool },
          });
        });
      },
    })
      .then((result) => {
        if (activeRunIdRef.current !== runId) return;
        activeRunIdRef.current = 0;
        controllerRef.current = null;
        pendingApprovalRef.current = null;
        if (result.interactionId) {
          lastInteractionIdRef.current = result.interactionId;
        }
        commit(resultState(stateRef.current, result));
      })
      .catch((error: unknown) => {
        if (activeRunIdRef.current !== runId) return;
        activeRunIdRef.current = 0;
        controllerRef.current = null;
        pendingApprovalRef.current = null;
        const current = stateRef.current;
        if (controller.signal.aborted) {
          commit({
            status: "stopped",
            goal: current.goal,
            runGoal: current.runGoal,
            activity: current.activity,
            providerAvailable: true,
            providerStatus: current.providerStatus,
            steps: stepCount(current.activity),
          });
          return;
        }
        const reqId = typeof (error as { requestId?: unknown })?.requestId === "string" ? (error as { requestId: string }).requestId : undefined;
        commit({
          status: "failed",
          goal: current.goal,
          runGoal: current.runGoal,
          activity: current.activity,
          providerAvailable: true,
          providerStatus: "error",
          steps: stepCount(current.activity),
          requestId: reqId,
          message: error instanceof Error ? error.message : "Bench Agent failed.",
        });
      });
  }, [commit, provider]);

  const sendObservation = useCallback(
    (observation: string) => {
      const trimmed = observation.trim();
      const previous = stateRef.current;
      const modelContext = document.modelContext;
      if (!trimmed || !previous.providerAvailable || isActive(previous)) return;

      if (!modelContext) {
        commit({
          status: "failed",
          goal: previous.goal,
          activity: previous.activity,
          providerAvailable: true,
          providerStatus: previous.providerStatus,
          steps: stepCount(previous.activity),
          message: "WebMCP model context is unavailable.",
        });
        return;
      }
      const runId = ++nextRunIdRef.current;
      activeRunIdRef.current = runId;
      const controller = new AbortController();
      controllerRef.current = controller;
      pendingApprovalRef.current = null;

      commit({
        status: "investigating",
        goal: previous.goal,
        runGoal: trimmed,
        activity: previous.activity,
        providerAvailable: true,
        providerStatus: previous.providerStatus === "live" ? "live" : "configured",
        steps: stepCount(previous.activity),
      });
      const onEvent = (event: BenchAgentEvent) => {
        if (activeRunIdRef.current !== runId) return;
        const current = stateRef.current;
        if (!isActive(current)) return;
        const activity = updateActivity(current.activity, event);
        if (event.type === "approval-requested") {
          commit({
            status: "approval",
            goal: current.goal,
            runGoal: current.runGoal,
            activity,
            providerAvailable: true,
            providerStatus: "live",
            steps: stepCount(activity),
            approval: { call: event.call, tool: event.tool },
          });
          return;
        }
        commit({ ...current, activity, providerStatus: "live", steps: stepCount(activity) });
      };

      void runBenchAgent({
        goal: trimmed,
        previousInteractionId: lastInteractionIdRef.current,
        modelContext,
        provider,
        signal: controller.signal,
        onEvent,
        requestApproval: ({ call, tool }) => {
          if (activeRunIdRef.current !== runId || controller.signal.aborted) {
            return Promise.resolve(false);
          }

          return new Promise<boolean>((resolve) => {
            const previousPending = pendingApprovalRef.current;
            pendingApprovalRef.current = { runId, resolve };
            previousPending?.resolve(false);

            const current = stateRef.current;
            commit({
              status: "approval",
              goal: current.goal,
              runGoal: current.runGoal,
              activity: current.activity,
              providerAvailable: true,
              providerStatus: "live",
              steps: stepCount(current.activity),
              approval: { call, tool },
            });
          });
        },
      })
        .then((result) => {
          if (activeRunIdRef.current !== runId) return;
          activeRunIdRef.current = 0;
          controllerRef.current = null;
          pendingApprovalRef.current = null;
          if (result.interactionId) {
            lastInteractionIdRef.current = result.interactionId;
          }
          commit(resultState(stateRef.current, result));
        })
        .catch((error: unknown) => {
          if (activeRunIdRef.current !== runId) return;
          activeRunIdRef.current = 0;
          controllerRef.current = null;
          pendingApprovalRef.current = null;
          const current = stateRef.current;
          if (controller.signal.aborted) {
            commit({
              status: "stopped",
              goal: current.goal,
              runGoal: current.runGoal,
              activity: current.activity,
              providerAvailable: true,
              providerStatus: current.providerStatus,
              steps: stepCount(current.activity),
            });
            return;
          }
          const reqId = typeof (error as { requestId?: unknown })?.requestId === "string" ? (error as { requestId: string }).requestId : undefined;
          commit({
            status: "failed",
            goal: current.goal,
            runGoal: current.runGoal,
            activity: current.activity,
            providerAvailable: true,
            providerStatus: "error",
            steps: stepCount(current.activity),
            requestId: reqId,
            message: error instanceof Error ? error.message : "Bench Agent failed.",
          });
        });
    },
    [commit, provider],
  );

  useEffect(() => {
    if (!isConnected && isActive(stateRef.current)) {
      stop();
    }
  }, [isConnected, stop]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      activeRunIdRef.current = 0;
      controllerRef.current?.abort();
      controllerRef.current = null;
      const pending = pendingApprovalRef.current;
      pendingApprovalRef.current = null;
      pending?.resolve(false);
    };
  }, []);

  return {
    state,
    setGoal,
    start,
    sendObservation,
    stop,
    approve: () => settleApproval(true),
    deny: () => settleApproval(false),
  };
}
