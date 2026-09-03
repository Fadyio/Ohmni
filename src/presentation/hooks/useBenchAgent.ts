import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import {
  HttpBenchAgentProvider,
  fetchBenchAgentAvailability,
} from "@/infrastructure/bench-agent/http-provider";
import { DeterministicBenchAgentProvider } from "@/infrastructure/bench-agent/deterministic-provider";
import { runBenchAgent } from "@/infrastructure/bench-agent/run-bench-agent";
import type {
  AgentFunctionCall,
  AgentMode,
  AgentTranscriptItem,
  BenchAgentEvent,
  BenchAgentProvider,
  BenchAgentRunResult,
} from "@/infrastructure/bench-agent/types";
import type { RegisteredTool } from "@/infrastructure/webmcp/types";
export type BenchAgentActivityStatus =
  | "requested"
  | "waiting-approval"
  | "running"
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

export interface ToolReceipt {
  readonly toolName: string;
  readonly status: BenchAgentActivityStatus;
  readonly argumentsText: string;
  readonly resultText?: string;
  readonly evidenceIds: readonly string[];
  readonly experimentId?: string;
  readonly stateChanges: readonly string[];
}

const SECRET_KEY = /(?:api[_-]?key|authorization|password|secret|token)/i;

function redactSecrets(value: unknown, key = ""): unknown {
  if (SECRET_KEY.test(key)) return "[REDACTED]";
  if (Array.isArray(value)) return value.map((item) => redactSecrets(item));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([entryKey, entryValue]) => [
        entryKey,
        redactSecrets(entryValue, entryKey),
      ]),
    );
  }
  return value;
}

export function buildToolReceipt(activity: BenchAgentActivity): ToolReceipt {
  let parsedResult: Record<string, unknown> | undefined;
  if (activity.result) {
    try {
      const parsed = JSON.parse(activity.result) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        parsedResult = parsed as Record<string, unknown>;
      }
    } catch {
      // Keep non-JSON tool output visible as the raw factual result.
    }
  }

  const evidenceIds = Array.isArray(parsedResult?.evidence_ids)
    ? parsedResult.evidence_ids.filter((id): id is string => typeof id === "string")
    : activity.result?.match(/\bE-\d{3,}\b/g) ?? [];
  const experimentId =
    typeof parsedResult?.experiment_id === "string"
      ? parsedResult.experiment_id
      : activity.result?.match(/\bexp[_-][a-zA-Z0-9_-]+\b/)?.[0];
  const stateChanges: string[] = [];
  if (typeof parsedResult?.resetOccurred === "boolean") {
    stateChanges.push(`Brownout reset: ${parsedResult.resetOccurred ? "detected" : "not detected"}`);
  }
  const supply = parsedResult?.supply_voltage;
  if (supply && typeof supply === "object") {
    const minimum = (supply as Record<string, unknown>).minimum_v;
    if (typeof minimum === "number") stateChanges.push(`Minimum rail voltage: ${minimum.toFixed(2)} V`);
  }

  return {
    toolName: activity.call.name,
    status: activity.status,
    argumentsText: JSON.stringify(redactSecrets(activity.call.arguments), null, 2),
    resultText: activity.result ?? activity.message,
    evidenceIds: [...new Set(evidenceIds)],
    experimentId,
    stateChanges,
  };
}

export type BenchAgentProviderStatus =
  | "unconfigured"
  | "configured"
  | "live"
  | "error"
  | "demo";
interface BenchAgentStateBase {
  readonly agentMode?: AgentMode;
  readonly liveProvider?: string;
  readonly liveModel?: string;
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
  readonly agentMode: AgentMode;
  readonly providerLabel: string;
  readonly setAgentMode: (mode: AgentMode) => void;
  readonly setGoal: (goal: string) => void;
  readonly start: () => void;
  readonly sendObservation: (observation: string) => void;
  readonly stop: () => void;
  readonly approve: () => void;
  readonly deny: () => void;
  readonly retryAvailability: () => void;
  readonly reset: () => void;
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
    case "tool-started":
      updated = { ...current, call: event.call, status: "running" };
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
  const isDemo = current.agentMode === "demo";
  const nextProviderStatus: BenchAgentProviderStatus =
    isDemo
      ? "demo"
      : result.status === "failed"
      ? "error"
      : isSuccess && result.steps > 0
      ? "live"
      : current.providerStatus;

  const common = {
    agentMode: current.agentMode,
    liveProvider: current.liveProvider,
    liveModel: current.liveModel,
    goal: current.goal,
    runGoal: current.runGoal,
    activity: current.activity,
    providerAvailable: isDemo ? true : result.status !== "failed",
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

export function useBenchAgent(
  isConnected: boolean,
  initialMode?: AgentMode
): UseBenchAgentResult {
  const resolvedInitialMode: AgentMode =
    initialMode ??
    (typeof window !== "undefined"
      ? (() => {
          const p = new URLSearchParams(window.location.search).get("agent");
          if (p === "demo") return "demo";
          return "groq";
        })()
      : "groq");

  const [agentMode, setAgentModeState] = useState<AgentMode>(resolvedInitialMode);
  const agentModeRef = useRef<AgentMode>(resolvedInitialMode);
  agentModeRef.current = agentMode;

  const httpProvider = useMemo(() => new HttpBenchAgentProvider(), []);
  const demoProvider = useMemo(() => new DeterministicBenchAgentProvider(), []);
  const activeProvider: BenchAgentProvider = agentMode === "demo" ? demoProvider : httpProvider;

  const [state, setReactState] = useState<BenchAgentState>(() => ({
    ...initialState,
    agentMode: resolvedInitialMode,
    checkingAvailability: resolvedInitialMode !== "demo",
    providerAvailable: resolvedInitialMode === "demo",
    providerStatus: resolvedInitialMode === "demo" ? "demo" : "unconfigured",
  }));
  const stateRef = useRef<BenchAgentState>(state);
  const mountedRef = useRef(true);
  const controllerRef = useRef<AbortController | null>(null);
  const pendingApprovalRef = useRef<PendingApproval | null>(null);
  const nextRunIdRef = useRef(0);
  const activeRunIdRef = useRef(0);
  const lastInteractionIdRef = useRef<string | undefined>(undefined);
  const transcriptRef = useRef<AgentTranscriptItem[]>([]);

  const commit = useCallback((next: BenchAgentState) => {
    stateRef.current = next;
    if (mountedRef.current) {
      setReactState(next);
    }
  }, []);

  const checkAvailability = useCallback(async () => {
    if (agentModeRef.current === "demo") {
      commit({
        status: "idle",
        checkingAvailability: false,
        agentMode: "demo",
        goal: stateRef.current.goal,
        activity: stateRef.current.activity,
        providerAvailable: true,
        providerStatus: "demo",
      });
      return;
    }

    try {
      const availability = await fetchBenchAgentAvailability();
      if (!mountedRef.current) return;
      const previous = stateRef.current;
      const detectedProvider = (availability.provider || "groq") as "groq" | "demo";
      const detectedModel = availability.model;
      if (availability.available) {
        commit({
          status: "idle",
          checkingAvailability: false,
          agentMode: previous.agentMode ?? detectedProvider,
          liveProvider: detectedProvider,
          liveModel: detectedModel,
          goal: previous.goal,
          activity: [],
          providerAvailable: true,
          providerStatus: previous.providerStatus === "live" ? "live" : "configured",
        });
        return;
      }
      commit({
        status: "unavailable",
        agentMode: previous.agentMode ?? (detectedProvider === "demo" ? "demo" : "groq"),
        liveProvider: detectedProvider,
        liveModel: detectedModel,
        goal: previous.goal,
        activity: [],
        providerAvailable: false,
        providerStatus: "error",
        message: "Groq API quota is currently unavailable or unconfigured on server.",
      });
    } catch (error: unknown) {
      if (!mountedRef.current) return;
      const previous = stateRef.current;
      const requestId =
        typeof (error as { requestId?: unknown })?.requestId === "string"
          ? (error as { requestId: string }).requestId
          : undefined;
        const fallbackProvider = "groq";
        commit({
          status: "failed",
          agentMode: previous.agentMode ?? fallbackProvider,
          liveProvider: previous.liveProvider ?? fallbackProvider,
          liveModel: previous.liveModel,
        goal: previous.goal,
        activity: [],
        providerAvailable: false,
        providerStatus: "error",
        steps: 0,
        requestId,
        message:
          error instanceof Error && error.message.trim().length > 0
            ? error.message
            : "Live AI quota is currently unavailable.",
      });
    }
  }, [commit]);

  useEffect(() => {
    if (agentMode !== "demo") {
      void checkAvailability();
    } else {
      commit({
        status: "idle",
        checkingAvailability: false,
        agentMode: "demo",
        goal: stateRef.current.goal,
        activity: [],
        providerAvailable: true,
        providerStatus: "demo",
      });
    }
  }, [agentMode, checkAvailability, commit]);

  const setAgentMode = useCallback(
    (mode: AgentMode) => {
      if (controllerRef.current) {
        controllerRef.current.abort();
        controllerRef.current = null;
      }
      pendingApprovalRef.current = null;
      lastInteractionIdRef.current = undefined;
      demoProvider.reset();
      setAgentModeState(mode);
      agentModeRef.current = mode;

      if (mode === "demo") {
        commit({
          status: "idle",
          checkingAvailability: false,
          agentMode: "demo",
          goal: stateRef.current.goal,
          activity: [],
          providerAvailable: true,
          providerStatus: "demo",
        });
      } else {
        commit({
          status: "idle",
          checkingAvailability: true,
          agentMode: mode,
          liveProvider: mode,
          goal: stateRef.current.goal,
          activity: [],
          providerAvailable: false,
          providerStatus: "unconfigured",
        });
        void checkAvailability();
      }
    },
    [commit, checkAvailability, demoProvider]
  );

  const reset = useCallback(() => {
    if (controllerRef.current) {
      controllerRef.current.abort();
      controllerRef.current = null;
    }
    pendingApprovalRef.current = null;
    lastInteractionIdRef.current = undefined;
    demoProvider.reset();
    const currentMode = agentModeRef.current;
    commit({
      status: "idle",
      checkingAvailability: currentMode !== "demo",
      agentMode: currentMode,
      liveProvider: stateRef.current.liveProvider,
      liveModel: stateRef.current.liveModel,
      goal: "",
      activity: [],
      providerAvailable: currentMode === "demo" ? true : stateRef.current.providerAvailable,
      providerStatus: currentMode === "demo" ? "demo" : stateRef.current.providerStatus,
    });
  }, [commit, demoProvider]);

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
        const approvedCall = current.approval.call;
        const nextActivity = current.activity.some((a) => a.call.id === approvedCall.id)
          ? current.activity.map((a) =>
              a.call.id === approvedCall.id ? { ...a, status: "requested" as const } : a
            )
          : [...current.activity, { call: approvedCall, status: "requested" as const }];

        commit({
          status: "investigating",
          agentMode: current.agentMode,
          goal: current.goal,
          runGoal: current.runGoal,
          activity: nextActivity,
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
    const goal =
      previous.goal.trim() ||
      "The controller restarts when the fan turns on. Investigate the cause using the available instruments.";
    const modelContext = window.__agentModelContext ?? document.modelContext;
    if (!goal || !previous.providerAvailable || isActive(previous)) return;

    const isDemo = agentModeRef.current === "demo";

    if (!modelContext) {
      commit({
        status: "failed",
        agentMode: previous.agentMode,
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
      agentMode: previous.agentMode,
      goal,
      runGoal: goal,
      activity: [],
      providerAvailable: true,
      providerStatus: isDemo ? "demo" : previous.providerStatus === "live" ? "live" : "configured",
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
          agentMode: current.agentMode,
          goal: current.goal,
          runGoal: current.runGoal,
          activity,
          providerAvailable: true,
          providerStatus: isDemo ? "demo" : "live",
          steps: stepCount(activity),
          approval: { call: event.call, tool: event.tool },
        });
        return;
      }
      commit({
        ...current,
        status: "investigating",
        activity,
        agentMode: current.agentMode,
        providerStatus: isDemo ? "demo" : "live",
        steps: stepCount(activity),
      });
    };

    transcriptRef.current = [{ role: "user", content: goal }];

    void runBenchAgent({
      goal,
      modelContext,
      provider: agentModeRef.current === "demo" ? demoProvider : httpProvider,
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
            agentMode: current.agentMode,
            goal: current.goal,
            runGoal: current.runGoal,
            activity: current.activity,
            providerAvailable: true,
            providerStatus: isDemo ? "demo" : "live",
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
        if (result.history) {
          transcriptRef.current = [...result.history];
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
            agentMode: current.agentMode,
            goal: current.goal,
            runGoal: current.runGoal,
            activity: current.activity,
            providerAvailable: true,
            providerStatus: current.providerStatus,
            steps: stepCount(current.activity),
          });
          return;
        }
        const reqId =
          typeof (error as { requestId?: unknown })?.requestId === "string"
            ? (error as { requestId: string }).requestId
            : undefined;
        commit({
          status: "failed",
          agentMode: stateRef.current.agentMode,
          goal: current.goal,
          runGoal: current.runGoal,
          activity: current.activity,
          // A failed turn does not mean the configured provider disappeared.
          // Keep recovery actions and human-observation continuations enabled.
          providerAvailable: true,
          providerStatus: isDemo ? "demo" : "error",
          steps: stepCount(current.activity),
          requestId: reqId,
          message: error instanceof Error ? error.message : "Bench Agent failed.",
        });
      });
  }, [activeProvider, commit]);

  const sendObservation = useCallback(
    (observation: string) => {
      const trimmed = observation.trim();
      const previous = stateRef.current;
      const modelContext = window.__agentModelContext ?? document.modelContext;
      if (!trimmed || !previous.providerAvailable) return;

      // A human-confirmed intervention supersedes any trailing diagnostic turn.
      // Abort it before starting the self-contained verification phase.
      if (isActive(previous)) {
        controllerRef.current?.abort();
        controllerRef.current = null;
        const pending = pendingApprovalRef.current;
        pendingApprovalRef.current = null;
        pending?.resolve(false);
      }

      const isDemo = agentModeRef.current === "demo";

      if (!modelContext) {
        commit({
          status: "failed",
          agentMode: previous.agentMode,
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
        agentMode: previous.agentMode,
        goal: previous.goal,
        runGoal: trimmed,
        activity: previous.activity,
        providerAvailable: true,
        providerStatus: isDemo ? "demo" : previous.providerStatus === "live" ? "live" : "configured",
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
            agentMode: current.agentMode,
            goal: current.goal,
            runGoal: current.runGoal,
            activity,
            providerAvailable: true,
            providerStatus: isDemo ? "demo" : "live",
            steps: stepCount(activity),
            approval: { call: event.call, tool: event.tool },
          });
          return;
        }
        commit({
          ...current,
          status: "investigating",
          activity,
          agentMode: current.agentMode,
          providerStatus: isDemo ? "demo" : "live",
          steps: stepCount(activity),
        });
      };

      // Human intervention starts a self-contained verification phase. The
      // observation names the target hypothesis, so prior diagnostic turns do
      // not need to be resent through the provider's short token window.
      const continuationHistory: AgentTranscriptItem[] = [
        { role: "user" as const, content: trimmed },
      ];
      transcriptRef.current = continuationHistory;

      void runBenchAgent({
        goal: trimmed,
        initialHistory: continuationHistory,
        modelContext,
        provider: agentModeRef.current === "demo" ? demoProvider : httpProvider,
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
              agentMode: current.agentMode,
              goal: current.goal,
              runGoal: current.runGoal,
              activity: current.activity,
              providerAvailable: true,
              providerStatus: isDemo ? "demo" : "live",
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
          if (result.history) {
            transcriptRef.current = [...result.history];
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
              agentMode: current.agentMode,
              goal: current.goal,
              runGoal: current.runGoal,
              activity: current.activity,
              providerAvailable: true,
              providerStatus: current.providerStatus,
              steps: stepCount(current.activity),
            });
            return;
          }
          const reqId =
            typeof (error as { requestId?: unknown })?.requestId === "string"
              ? (error as { requestId: string }).requestId
              : undefined;
          commit({
            status: "failed",
            agentMode: stateRef.current.agentMode,
            goal: current.goal,
            runGoal: current.runGoal,
            activity: current.activity,
            // Preserve retryability after transient live-provider failures.
            providerAvailable: true,
            providerStatus: isDemo ? "demo" : "error",
            steps: stepCount(current.activity),
            requestId: reqId,
            message: error instanceof Error ? error.message : "Bench Agent failed.",
          });
        });
    },
    [activeProvider, commit]
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

  const providerLabel = useMemo(() => {
    if (agentMode === "demo") return "DEMO AGENT";
    const p = state.liveProvider ?? "groq";
    return p.toUpperCase();
  }, [agentMode, state.liveProvider]);
  return {
    state,
    agentMode,
    providerLabel,
    setAgentMode,
    setGoal,
    start,
    sendObservation,
    stop,
    approve: () => settleApproval(true),
    deny: () => settleApproval(false),
    retryAvailability: checkAvailability,
    reset,
  };
}
