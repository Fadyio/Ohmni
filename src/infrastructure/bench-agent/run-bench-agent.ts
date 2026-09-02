import { translateRegisteredTools } from "./tool-translation";
import type {
  AgentFunctionCall,
  AgentFunctionResult,
  BenchAgentRunResult,
  RunBenchAgentOptions,
} from "./types";

export const MAX_AGENT_STEPS = 12;

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

export async function runBenchAgent(
  options: RunBenchAgentOptions
): Promise<BenchAgentRunResult> {
  const {
    goal,
    modelContext,
    provider,
    requestApproval,
    onEvent,
    signal,
    maxSteps = MAX_AGENT_STEPS,
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
  let previousInteractionId: string | undefined;

  try {
    throwIfAborted(signal);

    while (true) {
      throwIfAborted(signal);
      const turnTools = await awaitWithAbort(modelContext.getTools(), signal);
      throwIfAborted(signal);
      const tools = translateRegisteredTools(turnTools);
      const turn = await awaitWithAbort(
        provider.turn(
          {
            input,
            tools,
            ...(previousInteractionId === undefined
              ? {}
              : { previousInteractionId }),
          },
          { signal }
        ),
        signal
      );
      throwIfAborted(signal);

      if (!Array.isArray(turn.functionCalls)) {
        throw new Error("Bench agent provider returned invalid function calls.");
      }

      if (turn.functionCalls.length === 0) {
        if (typeof turn.text !== "string") {
          throw new Error(
            "Bench agent provider returned neither function calls nor text."
          );
        }
        return { status: "completed", steps, text: turn.text };
      }

      const results: AgentFunctionResult[] = [];
      for (const call of turn.functionCalls) {
        if (steps >= stepLimit) {
          return { status: "step-limit", steps };
        }
        steps += 1;
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

        if (currentTool.annotations?.readOnlyHint !== true) {
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
      return { status: "stopped", steps };
    }
    return {
      status: "failed",
      steps,
      message: errorMessage(error, "Bench agent failed unexpectedly."),
    };
  }
}
