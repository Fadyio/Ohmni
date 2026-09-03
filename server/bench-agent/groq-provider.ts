import type {
  AgentFunctionCall,
  AgentFunctionResult,
  AgentToolDeclaration,
  AgentTranscriptItem,
  AgentTurnRequest,
  AgentTurnResult,
  BenchAgentProvider,
} from "../../src/infrastructure/bench-agent/types.ts";
import {
  BENCH_AGENT_SYSTEM_INSTRUCTION,
  sanitizeErrorMessage,
} from "./gemini-provider.ts";

export type {
  AgentFunctionCall,
  AgentFunctionResult,
  AgentToolDeclaration,
  AgentTranscriptItem,
  AgentTurnRequest,
  AgentTurnResult,
  BenchAgentProvider,
};
export { BENCH_AGENT_SYSTEM_INSTRUCTION, sanitizeErrorMessage };

export const DEFAULT_GROQ_MODEL = "openai/gpt-oss-120b";
export const GROQ_REQUEST_TIMEOUT_MS = 30_000;
export const GROQ_API_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";
export const MAX_COMPACTED_TOOL_RESULT_BYTES = 2_048;
export type FetchFunction = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response>;


export class GroqRateLimitError extends Error {
  public readonly retryAfterSeconds?: number;
  public constructor(message: string, retryAfterSeconds?: number) {
    super(message);
    this.name = "GroqRateLimitError";
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export interface GroqBenchAgentProviderOptions {
  readonly apiKey: string;
  readonly model?: string;
  readonly timeoutMs?: number;
  readonly fetchImpl?: FetchFunction;
  readonly systemInstruction?: string;
  readonly temperature?: number;
}

interface GroqToolCall {
  readonly id: string;
  readonly type: "function";
  readonly function: {
    readonly name: string;
    readonly arguments: string;
  };
}

interface GroqChoice {
  readonly index: number;
  readonly message: {
    readonly role: "assistant";
    readonly content?: string | null;
    readonly tool_calls?: readonly GroqToolCall[];
    readonly reasoning_content?: string | null;
  };
  readonly finish_reason?: string;
}

interface GroqChatCompletionResponse {
  readonly id?: string;
  readonly object?: string;
  readonly created?: number;
  readonly model?: string;
  readonly choices?: readonly GroqChoice[];
  readonly usage?: {
    readonly prompt_tokens?: number;
    readonly completion_tokens?: number;
    readonly total_tokens?: number;
  };
  readonly error?: {
    readonly message: string;
    readonly type?: string;
    readonly code?: string;
  };
}

/**
 * Strips internal chain-of-thought / reasoning tags so they are never returned to the UI.
 */
export function stripThinking(text: string): string {
  return text.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
}

/**
 * Compacts tool results in transcripts if they exceed size limits,
 * preserving vital semantic summaries while preventing token explosion.
 */
export function compactTranscriptItem(item: AgentTranscriptItem): AgentTranscriptItem {
  if (item.role !== "tool") {
    return item;
  }

  if (item.content.length <= MAX_COMPACTED_TOOL_RESULT_BYTES) {
    return item;
  }

  const head = item.content.slice(0, 1_000);
  const tail = item.content.slice(-500);
  const compacted = `${head}\n... [TRUNCATED FOR TOKEN CONTROL] ...\n${tail}`;

  return {
    ...item,
    content: compacted,
  };
}

/**
 * Compacts an entire transcript for bounded token consumption.
 */
export function compactTranscript(
  history: readonly AgentTranscriptItem[]
): AgentTranscriptItem[] {
  return history.map(compactTranscriptItem);
}

/**
 * Translates generic AgentToolDeclaration to Groq/OpenAI function format.
 */
export function translateToolsToGroq(
  tools: readonly AgentToolDeclaration[]
): Array<{
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}> {
  return tools.map((tool) => ({
    type: "function" as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    },
  }));
}

/**
 * Builds Groq chat completion messages array from request history or fallback input.
 */
export function buildGroqMessages(
  systemInstruction: string,
  request: AgentTurnRequest
): Array<Record<string, unknown>> {
  const messages: Array<Record<string, unknown>> = [
    { role: "system", content: systemInstruction },
  ];

  if (request.history && request.history.length > 0) {
    const compacted = compactTranscript(request.history);
    for (const item of compacted) {
      if (item.role === "user") {
        messages.push({ role: "user", content: item.content });
      } else if (item.role === "assistant") {
        const toolCalls =
          item.toolCalls && item.toolCalls.length > 0
            ? item.toolCalls.map((call) => ({
                id: call.id,
                type: "function" as const,
                function: {
                  name: call.name,
                  arguments: JSON.stringify(call.arguments),
                },
              }))
            : undefined;

        messages.push({
          role: "assistant",
          content: item.content ?? null,
          ...(toolCalls ? { tool_calls: toolCalls } : {}),
        });
      } else if (item.role === "tool") {
        messages.push({
          role: "tool",
          tool_call_id: item.callId,
          name: item.name,
          content: item.content,
        });
      }
    }
  } else {
    // Fallback if no history was provided
    if (typeof request.input === "string") {
      messages.push({ role: "user", content: request.input });
    } else if (Array.isArray(request.input)) {
      for (const res of request.input) {
        const text = res.result.map((r: { readonly text: string }) => r.text).join("\n");
        messages.push({
          role: "tool",
          tool_call_id: res.call_id,
          name: res.name,
          content: text,
        });
      }
    }
  }

  return messages;
}

/**
 * Parses Groq message tool calls into Ohmni AgentFunctionCall format with strict JSON parsing.
 */
export function parseGroqToolCalls(
  toolCalls: readonly GroqToolCall[] | undefined
): AgentFunctionCall[] {
  if (!toolCalls || toolCalls.length === 0) {
    return [];
  }

  const parsedCalls: AgentFunctionCall[] = [];
  for (const call of toolCalls) {
    if (
      !call ||
      typeof call !== "object" ||
      call.type !== "function" ||
      !call.function ||
      typeof call.function.name !== "string" ||
      call.function.name.trim() === "" ||
      typeof call.id !== "string" ||
      call.id.trim() === ""
    ) {
      throw new Error("Groq returned a malformed function call structure.");
    }

    let parsedArgs: unknown;
    try {
      parsedArgs = JSON.parse(call.function.arguments || "{}");
    } catch {
      throw new Error(
        `Groq returned unparseable JSON arguments for tool '${call.function.name}'.`
      );
    }

    if (
      parsedArgs === null ||
      typeof parsedArgs !== "object" ||
      Array.isArray(parsedArgs)
    ) {
      throw new Error(
        `Groq returned non-object arguments for tool '${call.function.name}'.`
      );
    }

    parsedCalls.push({
      id: call.id,
      name: call.function.name,
      arguments: parsedArgs as Record<string, unknown>,
    });
  }

  return parsedCalls;
}

function parseRetryAfter(headerValue: string | null): number | undefined {
  if (!headerValue) return undefined;
  const parsedInt = parseInt(headerValue, 10);
  if (!Number.isNaN(parsedInt) && parsedInt >= 0) {
    return parsedInt;
  }
  const parsedDate = Date.parse(headerValue);
  if (!Number.isNaN(parsedDate)) {
    const diffSec = Math.max(0, Math.ceil((parsedDate - Date.now()) / 1000));
    return diffSec;
  }
  return undefined;
}

export class GroqBenchAgentProvider implements BenchAgentProvider {
  private readonly apiKey: string;
  private readonly model: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: FetchFunction;
  private readonly systemInstruction: string;
  private readonly temperature: number;

  public constructor(options: GroqBenchAgentProviderOptions) {
    const apiKey = options.apiKey?.trim();
    if (!apiKey) {
      throw new Error("Groq API key must not be empty.");
    }

    this.apiKey = apiKey;
    this.model = options.model?.trim() || DEFAULT_GROQ_MODEL;
    this.timeoutMs = options.timeoutMs ?? GROQ_REQUEST_TIMEOUT_MS;
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch;
    this.systemInstruction =
      options.systemInstruction ?? BENCH_AGENT_SYSTEM_INSTRUCTION;
    this.temperature = options.temperature ?? 0.2;
  }

  public async turn(
    request: AgentTurnRequest,
    options?: { signal?: AbortSignal }
  ): Promise<AgentTurnResult> {
    const messages = buildGroqMessages(this.systemInstruction, request);
    const tools =
      request.tools.length > 0 ? translateToolsToGroq(request.tools) : undefined;

    const requestBody: Record<string, unknown> = {
      model: this.model,
      messages,
      temperature: this.temperature,
    };

    if (tools) {
      requestBody.tools = tools;
      requestBody.tool_choice = "auto";
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    const combinedSignal = options?.signal
      ? AbortSignal.any([options.signal, controller.signal])
      : controller.signal;

    let response: Response;
    try {
      response = await this.fetchImpl(GROQ_API_ENDPOINT, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
        signal: combinedSignal,
      });
    } catch (err: unknown) {
      clearTimeout(timeout);
      if (options?.signal?.aborted) {
        throw new Error("Bench agent request aborted.");
      }
      if (controller.signal.aborted) {
        throw new Error(`Groq request timed out after ${this.timeoutMs}ms.`);
      }
      throw new Error(sanitizeErrorMessage(err));
    } finally {
      clearTimeout(timeout);
    }

    if (response.status === 429) {
      const retryAfter = parseRetryAfter(response.headers.get("retry-after"));
      let errorMessage = "The free Groq allocation is temporarily rate limited.";
      try {
        const errorJson = (await response.json()) as GroqChatCompletionResponse;
        if (errorJson.error?.message) {
          errorMessage = errorJson.error.message;
        }
      } catch {
        // use default message
      }
      throw new GroqRateLimitError(errorMessage, retryAfter);
    }

    let data: GroqChatCompletionResponse;
    try {
      data = (await response.json()) as GroqChatCompletionResponse;
    } catch (err) {
      throw new Error(`Groq returned invalid JSON response: ${sanitizeErrorMessage(err)}`);
    }

    if (!response.ok) {
      const msg = data.error?.message || `Groq request failed with status ${response.status}.`;
      throw new Error(sanitizeErrorMessage(msg));
    }

    const choice = data.choices?.[0];
    if (!choice || !choice.message) {
      throw new Error("Groq response did not contain any completion choices.");
    }

    const rawContent = choice.message.content;
    const cleanContent = typeof rawContent === "string" ? stripThinking(rawContent) : undefined;
    const functionCalls = parseGroqToolCalls(choice.message.tool_calls);

    return {
      interactionId: data.id || `groq-${Date.now()}`,
      functionCalls,
      text: cleanContent && cleanContent.length > 0 ? cleanContent : undefined,
    };
  }

  public async canary(options?: { signal?: AbortSignal }): Promise<{
    readonly ok: boolean;
    readonly message: string;
    readonly model: string;
  }> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    const combinedSignal = options?.signal
      ? AbortSignal.any([options.signal, controller.signal])
      : controller.signal;

    try {
      const response = await this.fetchImpl(GROQ_API_ENDPOINT, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: this.model,
          messages: [{ role: "user", content: "Reply exactly OK." }],
          temperature: 0.0,
          max_tokens: 128,
        }),
        signal: combinedSignal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        return {
          ok: false,
          message: `Canary HTTP ${response.status}: ${sanitizeErrorMessage(errorText)}`,
          model: this.model,
        };
      }

      const data = (await response.json()) as GroqChatCompletionResponse;
      const choiceMsg = data.choices?.[0]?.message;
      const rawContent = choiceMsg?.content?.trim();
      const reasoning = (choiceMsg as any)?.reasoning || (choiceMsg as any)?.reasoning_content || "";
      const content = stripThinking(rawContent || "");
      const finalMsg = content || rawContent || reasoning;
      if (!finalMsg) {
        return {
          ok: false,
          message: "Canary returned empty response from Groq.",
          model: this.model,
        };
      }

      return {
        ok: true,
        message: finalMsg,
        model: this.model,
      };
    } catch (err: unknown) {
      return {
        ok: false,
        message: sanitizeErrorMessage(err),
        model: this.model,
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}
