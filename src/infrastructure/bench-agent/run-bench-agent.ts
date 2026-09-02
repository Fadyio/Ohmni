/**
 * Bench Agent Execution Loop.
 * Master Milestone 8 — Hardened Agent Loop & Idempotency.
 *
 * Implements:
 * 1. WebMCP Tool Discovery & ModelContext execution
 * 2. Idempotency: Deduplicates repeated call IDs
 * 3. Transient Provider Retries (bounded, exponential backoff)
 * 4. Human Approval Interlock for physical tools
 * 5. Deterministic Step Limiting & Safe Teardown
 */

import { requiresHumanApproval } from "@/domain/safety/tool-safety-policy";
import { translateRegisteredTools } from "./tool-translation";
import type {
  AgentFunctionCall,
  AgentFunctionResult,
  AgentTurnResult,
  BenchAgentProvider,
  BenchAgentRunResult,
  RunBenchAgentOptions,
} from "./types";

export const MAX_AGENT_STEPS = 12;
const MAX_PROVIDER_RETRIES = 2;

const ABORT_MESSAGE = "Bench agent run stopped.";

function isAbort(error: unknown, signal: AbortSignal | undefined): boolean {
  return signal?.aborted === true ||
    (error instanceof Error && error.name === "AbortError");
}

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim() !== "") {
    return error.message;
  }
  return fallback;
}

function isRetryableError(error: unknown): boolean {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    // Do NOT retry client errors or auth errors
    if (msg.includes("400") || msg.includes("401") || msg.includes("403") || msg.includes("invalid argument")) {
      return false;
    }
    // Retry rate limits (429), server errors (5xx), network timeouts
    if (
      msg.includes("429") ||
      msg.includes("500") ||
      msg.includes("502") ||
      msg.includes("503") ||
      msg.includes("504") ||
      msg.includes("timeout") ||
      msg.includes("network") ||
      msg.includes("fetch failed")
    ) {
      return true;
    }
  }
  return false;
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) {
    throw new DOMException(ABORT_MESSAGE, "AbortError");
  }
}

function functionResult(
  call: AgentFunctionCall,
  text: string,
  isError = false
): AgentFunctionResult {
  return {
    type: "function_result",
    name: call.name,
    call_id: call.id,
    result: [{ type: "text", text }],
    ...(isError ? { is_error: true } : {}),
  };
}

function errorFunctionResult(
  call: AgentFunctionCall,
  message: string
): AgentFunctionResult {
  return functionResult(call, JSON.stringify({ error: message }), true);
}

async function awaitWithAbort<T>(
  operation: Promise<T>,
  signal: AbortSignal | undefined
): Promise<T> {
  if (!signal) return operation;
  if (signal.aborted) {
    void operation.catch(() => undefined);
    throwIfAborted(signal);
  }

  return new Promise<T>((resolve, reject) => {
    const onAbort = () => {
      signal.removeEventListener("abort", onAbort);
      reject(new DOMException(ABORT_MESSAGE, "AbortError"));
    };

    signal.addEventListener("abort", onAbort, { once: true });
    operation.then(
      (value) => {
        signal.removeEventListener("abort", onAbort);
        resolve(value);
      },
      (error: unknown) => {
        signal.removeEventListener("abort", onAbort);
        reject(error);
      }
    );
  });
}

async function executeProviderTurnWithRetry(
  provider: BenchAgentProvider,
  request: Parameters<BenchAgentProvider["turn"]>[0],
  signal?: AbortSignal
): Promise<AgentTurnResult> {
  let attempts = 0;
  while (true) {
    throwIfAborted(signal);
    try {
      return await awaitWithAbort(provider.turn(request, { signal }), signal);
    } catch (error) {
      if (isAbort(error, signal)) throw error;
      if (attempts < MAX_PROVIDER_RETRIES && isRetryableError(error)) {
        attempts += 1;
        // Bounded exponential backoff: 50ms, 150ms
        const delayMs = attempts * 75;
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        continue;
      }
      throw error;
    }
  }
}

export async function runBenchAgent(
  options: RunBenchAgentOptions
): Promise<BenchAgentRunResult> {
  const {
    goal,
    modelContext,
    provider,
    requestApproval,
    onEvent = () => undefined,
    signal,
    maxSteps = MAX_AGENT_STEPS,
    previousInteractionId: initialInteractionId,
  } = options;
  const requestedStepLimit = Number.isFinite(maxSteps)
    ? Math.floor(maxSteps)
    : MAX_AGENT_STEPS;
  const stepLimit = Math.max(
    0,
    Math.min(MAX_AGENT_STEPS, requestedStepLimit)
  );

  let steps = 0;
  let input: string | readonly AgentFunctionResult[] = goal;
  let previousInteractionId: string | undefined = initialInteractionId;
  let lastInteractionId: string | undefined = initialInteractionId;

  // Idempotency cache: maps call.id -> executed result string
  const executedCallResults = new Map<string, string>();

  try {
    throwIfAborted(signal);

    while (true) {
      throwIfAborted(signal);
      const turnTools = await awaitWithAbort(modelContext.getTools(), signal);
      throwIfAborted(signal);
      const tools = translateRegisteredTools(turnTools);

      const turn = await executeProviderTurnWithRetry(
        provider,
        {
          input,
          tools,
          ...(previousInteractionId === undefined
            ? {}
            : { previousInteractionId }),
        },
        signal
      );
      lastInteractionId = turn.interactionId;

      if (!Array.isArray(turn.functionCalls)) {
        throw new Error("Bench agent provider returned invalid function calls.");
      }

      if (turn.functionCalls.length === 0) {
        if (typeof turn.text !== "string") {
          throw new Error(
            "Bench agent provider returned neither function calls nor text."
          );
        }
        return { status: "completed", steps, text: turn.text, interactionId: turn.interactionId };
      }

      const results: AgentFunctionResult[] = [];
      for (const call of turn.functionCalls) {
        if (steps >= stepLimit) {
          return { status: "step-limit", steps, interactionId: lastInteractionId };
        }
        steps += 1;

        // Idempotency Protection: If provider repeated a call ID, return previous result
        if (executedCallResults.has(call.id)) {
          const cachedResult = executedCallResults.get(call.id)!;
          results.push(functionResult(call, cachedResult));
          continue;
        }

        onEvent({ type: "tool-requested", call });
        throwIfAborted(signal);

        const discoveredTools = await awaitWithAbort(
          modelContext.getTools(),
          signal
        );
        throwIfAborted(signal);
        let currentTool = discoveredTools.find((tool) => tool.name === call.name);
        if (!currentTool) {
          const message = `Tool '${call.name}' is unavailable.`;
          onEvent({ type: "tool-unavailable", call, message });
          results.push(errorFunctionResult(call, message));
          continue;
        }

        if (requiresHumanApproval(currentTool.name, currentTool.annotations)) {
          onEvent({ type: "approval-requested", call, tool: currentTool });
          const approved = await awaitWithAbort(
            requestApproval({ call, tool: currentTool }),
            signal
          );
          throwIfAborted(signal);
          if (!approved) {
            const message = `Execution of tool '${call.name}' was denied.`;
            onEvent({ type: "tool-denied", call, message });
            results.push(errorFunctionResult(call, message));
            continue;
          }

          const refreshedTools = await awaitWithAbort(
            modelContext.getTools(),
            signal
          );
          throwIfAborted(signal);
          currentTool = refreshedTools.find((tool) => tool.name === call.name);
          if (!currentTool) {
            const message = `Tool '${call.name}' is unavailable.`;
            onEvent({ type: "tool-unavailable", call, message });
            results.push(errorFunctionResult(call, message));
            continue;
          }
        }

        let serializedArguments: string | undefined;
        try {
          serializedArguments = JSON.stringify(call.arguments);
          if (serializedArguments === undefined) {
            throw new Error(
              `Arguments for tool '${call.name}' could not be serialized.`
            );
          }
        } catch (error) {
          const message = errorMessage(
            error,
            `Arguments for tool '${call.name}' could not be serialized.`
          );
          onEvent({ type: "tool-failed", call, message, durationMs: 0 });
          results.push(errorFunctionResult(call, message));
          continue;
        }

        const startedAt = Date.now();
        try {
          const result = await awaitWithAbort(
            modelContext.executeTool(
              currentTool,
              serializedArguments,
              { signal }
            ),
            signal
          );
          if (typeof result !== "string") {
            throw new Error(`Tool '${call.name}' returned an invalid result.`);
          }
          const durationMs = Math.max(0, Date.now() - startedAt);
          onEvent({ type: "tool-completed", call, result, durationMs });

          // Record in idempotency cache
          executedCallResults.set(call.id, result);
          results.push(functionResult(call, result));
        } catch (error) {
          if (isAbort(error, signal)) throw error;
          const durationMs = Math.max(0, Date.now() - startedAt);
          const message = errorMessage(
            error,
            `Tool '${call.name}' failed unexpectedly.`
          );
          onEvent({ type: "tool-failed", call, message, durationMs });
          results.push(errorFunctionResult(call, message));
        }
      }

      previousInteractionId = turn.interactionId;
      input = results;
    }
  } catch (error) {
    if (isAbort(error, signal)) {
      return { status: "stopped", steps, interactionId: lastInteractionId };
    }
    const requestId =
      typeof (error as { requestId?: unknown })?.requestId === "string"
        ? (error as { requestId: string }).requestId
        : undefined;
    return {
      status: "failed",
      steps,
      message: errorMessage(error, "Bench agent failed unexpectedly."),
      requestId,
      interactionId: lastInteractionId,
    };
  }
}
