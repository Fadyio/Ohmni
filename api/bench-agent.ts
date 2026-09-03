import type { IncomingMessage, ServerResponse } from "node:http";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { GoogleGenAI } from "@google/genai";

// ============================================================================
// Types
// ============================================================================

export interface AgentToolDeclaration {
  readonly type: "function";
  readonly name: string;
  readonly description: string;
  readonly parameters: Record<string, unknown>;
}

export interface AgentFunctionCall {
  readonly id: string;
  readonly name: string;
  readonly arguments: Record<string, unknown>;
}

export interface AgentFunctionResult {
  readonly type: "function_result";
  readonly name: string;
  readonly call_id: string;
  readonly result: readonly [{ readonly type: "text"; readonly text: string }];
  readonly is_error?: boolean;
}
export type AgentTranscriptItem =
  | {
      readonly role: "user";
      readonly content: string;
    }
  | {
      readonly role: "assistant";
      readonly content?: string;
      readonly toolCalls?: readonly AgentFunctionCall[];
    }
  | {
      readonly role: "tool";
      readonly callId: string;
      readonly name: string;
      readonly content: string;
      readonly isError?: boolean;
    };


export interface AgentTurnRequest {
  readonly input: string | readonly AgentFunctionResult[];
  readonly tools: readonly AgentToolDeclaration[];
  readonly history?: readonly AgentTranscriptItem[];
  readonly previousInteractionId?: string;
}

export interface AgentTurnResult {
  readonly interactionId?: string;
  readonly functionCalls: readonly AgentFunctionCall[];
  readonly text?: string;
  readonly requestId?: string;
}

export interface BenchAgentProvider {
  turn(
    request: AgentTurnRequest,
    options?: { signal?: AbortSignal },
  ): Promise<AgentTurnResult>;
  canary?(options?: { signal?: AbortSignal }): Promise<{
    readonly ok: boolean;
    readonly message: string;
    readonly model: string;
  }>;
}

interface InteractionResponse {
  readonly id: string;
  readonly steps?: readonly Record<string, unknown>[];
  readonly output_text?: string;
}

interface InteractionsClient {
  create(
    request: Record<string, unknown>,
    options?: { timeout_ms?: number; signal?: AbortSignal | null },
  ): Promise<InteractionResponse>;
}

// ============================================================================
// Constants & Sanitization
// ============================================================================

export const DEFAULT_GEMINI_MODEL = "gemini-3.7-flash";
export const DEFAULT_GROQ_MODEL = "openai/gpt-oss-120b";
export const GEMINI_REQUEST_TIMEOUT_MS = 30_000;
export const GROQ_REQUEST_TIMEOUT_MS = 30_000;
export const GROQ_API_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";
export const MAX_REQUEST_BODY_BYTES = 128 * 1024;
export const MAX_TOOLS = 64;
export const MAX_TOOL_DESCRIPTION_BYTES = 2 * 1024;
export const MAX_TOOL_SCHEMA_BYTES = 16 * 1024;
export const MAX_TRANSCRIPT_ITEMS = 128;
export const MAX_TRANSCRIPT_CONTENT_BYTES = 64 * 1024;
export const MAX_COMPACTED_TOOL_RESULT_BYTES = 2_048;
export const MAX_REQUESTS_PER_SESSION = 24;
export const SESSION_RATE_WINDOW_MS = 60_000;
export const BENCH_AGENT_SESSION_HEADER = "x-bench-agent-session";
const MAX_SESSION_ID_BYTES = 256;
const MAX_TRACKED_SESSIONS = 1_024;
const JSON_HEADERS = { "content-type": "application/json; charset=utf-8" };
const encoder = new TextEncoder();

export const BENCH_AGENT_SYSTEM_INSTRUCTION = `You are Ohmni's diagnostic bench agent.
Your mission is to find hardware faults, test hypotheses, and verify repairs on the connected board using the provided WebMCP diagnostic instruments.

Core Diagnostic Invariants:
1. Always start by inspecting the board state and reset history to ground initial observations.
2. Form clear, falsifiable hypotheses citing concrete telemetry evidence (e.g. supply rail voltage drops below threshold).
3. Always ask for human approval before running high-current stress experiments that actuate physical relays or coils.
4. When human repair or intervention is reported, independently retest with the same stress experiment to empirically confirm whether the fault is resolved.
5. Ground every conclusion in direct physical measurements.

Prefer the smallest informative next experiment.`;

export function sanitizeErrorMessage(error: unknown): string {
  if (!error) return "Unknown error";
  let message = error instanceof Error ? error.message : String(error);
  // Redact Google & Groq API keys
  message = message
    .replace(/AIza[0-9A-Za-z-_]{35}/g, "[REDACTED_API_KEY]")
    .replace(/gsk_[0-9A-Za-z_-]{20,}/g, "[REDACTED_API_KEY]");
  // Redact auth headers and secrets
  message = message.replace(/(?:api[_-]?key|secret|token|password|bearer)[=:\s]+["']?([^\s"',;]+)/gi, (match) => {
    return match.replace(/([=:\s]+["']?)(.+)/, "$1[REDACTED]");
  });
  if (message.includes('"message":')) {
    try {
      const match = message.match(/"message"\s*:\s*"([^"]+)"/);
      if (match && match[1]) {
        return match[1];
      }
    } catch {
      // ignore
    }
  }
  return message;
}

function publicFunctionCalls(
  steps: readonly Record<string, unknown>[] | undefined,
): AgentFunctionCall[] {
  if (!Array.isArray(steps)) {
    return [];
  }

  const calls: AgentFunctionCall[] = [];
  for (const step of steps) {
    if (
      step.type === "function_call" &&
      typeof step.id === "string" &&
      step.id.length > 0 &&
      typeof step.name === "string" &&
      typeof step.arguments === "object" &&
      step.arguments !== null &&
      !Array.isArray(step.arguments)
    ) {
      const argumentsObject = step.arguments as Record<string, unknown>;
      calls.push({
        id: step.id,
        name: step.name,
        arguments: argumentsObject,
      });
    }
  }
  return calls;
}

// ============================================================================
// Gemini Provider
// ============================================================================

export class GeminiBenchAgentProvider implements BenchAgentProvider {
  private readonly model: string;
  private readonly interactions: InteractionsClient;

  constructor(options: { apiKey: string; model?: string; interactions?: InteractionsClient }) {
    this.model = options.model ?? DEFAULT_GEMINI_MODEL;
    this.interactions =
      options.interactions ??
      (new GoogleGenAI({ apiKey: options.apiKey })
        .interactions as unknown as InteractionsClient);
  }

  async turn(
    request: AgentTurnRequest,
    options: { signal?: AbortSignal } = {},
  ): Promise<AgentTurnResult> {
    const interactionRequest: Record<string, unknown> = {
      model: this.model,
      input: request.input,
      system_instruction: BENCH_AGENT_SYSTEM_INSTRUCTION,
      tools: request.tools,
      generation_config: { thinking_level: "medium" },
      store: true,
    };
    if (request.previousInteractionId !== undefined) {
      interactionRequest.previous_interaction_id =
        request.previousInteractionId;
    }

    const interaction = await this.interactions.create(interactionRequest, {
      timeout_ms: GEMINI_REQUEST_TIMEOUT_MS,
      signal: options.signal,
    });

    const result: AgentTurnResult = {
      interactionId: interaction.id,
      functionCalls: publicFunctionCalls(interaction.steps),
      ...(typeof interaction.output_text === "string"
        ? { text: interaction.output_text }
        : {}),
    };
    return result;
  }

  async canary(
    options: { signal?: AbortSignal } = {},
  ): Promise<{ readonly ok: boolean; readonly message: string; readonly model: string }> {
    const interactionRequest: Record<string, unknown> = {
      model: this.model,
      input: "Reply with exactly OK.",
      store: false,
    };

    const interaction = await this.interactions.create(interactionRequest, {
      timeout_ms: 10_000,
      signal: options.signal,
    });

    const text = (typeof interaction.output_text === "string" ? interaction.output_text : "").trim();
    return {
      ok: true,
      message: text || "OK",
      model: this.model,
    };
  }
}
// ============================================================================
// Groq Provider
// ============================================================================

export class GroqRateLimitError extends Error {
  public readonly retryAfterSeconds?: number;
  public constructor(message: string, retryAfterSeconds?: number) {
    super(message);
    this.name = "GroqRateLimitError";
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export type FetchFunction = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response>;

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

export function stripThinking(text: string): string {
  return text.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
}

export function compactTranscriptItem(item: AgentTranscriptItem): AgentTranscriptItem {
  if (item.role !== "tool") {
    return item;
  }
  if (item.content.length <= MAX_COMPACTED_TOOL_RESULT_BYTES) {
    return item;
  }
  const head = item.content.slice(0, 1_000);
  const tail = item.content.slice(-500);
  return {
    ...item,
    content: `${head}\n... [TRUNCATED FOR TOKEN CONTROL] ...\n${tail}`,
  };
}

export function compactTranscript(history: readonly AgentTranscriptItem[]): AgentTranscriptItem[] {
  return history.map(compactTranscriptItem);
}

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
    if (parsedArgs === null || typeof parsedArgs !== "object" || Array.isArray(parsedArgs)) {
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
    return Math.max(0, Math.ceil((parsedDate - Date.now()) / 1000));
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
    this.systemInstruction = options.systemInstruction ?? BENCH_AGENT_SYSTEM_INSTRUCTION;
    this.temperature = options.temperature ?? 0.2;
  }

  public async turn(
    request: AgentTurnRequest,
    options?: { signal?: AbortSignal }
  ): Promise<AgentTurnResult> {
    const messages = buildGroqMessages(this.systemInstruction, request);
    const tools = request.tools.length > 0 ? translateToolsToGroq(request.tools) : undefined;
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
        // use default
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
          max_tokens: 16,
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
      const content = data.choices?.[0]?.message?.content?.trim();
      if (!content) {
        return {
          ok: false,
          message: "Canary returned empty response from Groq.",
          model: this.model,
        };
      }

      return {
        ok: true,
        message: content,
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

// ============================================================================
// Handler Parsing & Construction
// ============================================================================

function jsonResponse(
  body: unknown,
  status = 200,
  headers: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...JSON_HEADERS, ...headers },
  });
}

function hasExactKeys(
  value: Record<string, unknown>,
  required: readonly string[],
  optional: readonly string[] = [],
): boolean {
  const keys = Object.keys(value);
  return (
    required.every((key) => Object.hasOwn(value, key)) &&
    keys.every((key) => required.includes(key) || optional.includes(key))
  );
}

function parseFunctionResult(value: unknown): AgentFunctionResult | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return undefined;
  }
  const candidate = value as Record<string, unknown>;
  if (
    !hasExactKeys(
      candidate,
      ["type", "name", "call_id", "result"],
      ["is_error"],
    ) ||
    candidate.type !== "function_result" ||
    typeof candidate.name !== "string" ||
    candidate.name.length === 0 ||
    typeof candidate.call_id !== "string" ||
    candidate.call_id.length === 0 ||
    (candidate.is_error !== undefined &&
      typeof candidate.is_error !== "boolean") ||
    !Array.isArray(candidate.result) ||
    candidate.result.length !== 1
  ) {
    return undefined;
  }

  const first = candidate.result[0];
  if (typeof first !== "object" || first === null || Array.isArray(first)) {
    return undefined;
  }
  const content = first as Record<string, unknown>;
  if (
    !hasExactKeys(content, ["type", "text"]) ||
    content.type !== "text" ||
    typeof content.text !== "string"
  ) {
    return undefined;
  }

  return {
    type: "function_result",
    name: candidate.name,
    call_id: candidate.call_id,
    result: [{ type: "text", text: content.text }],
    ...(typeof candidate.is_error === "boolean"
      ? { is_error: candidate.is_error }
      : {}),
  };
}

function parseTool(value: unknown): AgentToolDeclaration | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return undefined;
  }
  const candidate = value as Record<string, unknown>;
  if (
    !hasExactKeys(candidate, ["type", "name", "description", "parameters"]) ||
    candidate.type !== "function" ||
    typeof candidate.name !== "string" ||
    candidate.name.length === 0 ||
    typeof candidate.description !== "string" ||
    encoder.encode(candidate.description).byteLength > MAX_TOOL_DESCRIPTION_BYTES ||
    typeof candidate.parameters !== "object" ||
    candidate.parameters === null ||
    Array.isArray(candidate.parameters)
  ) {
    return undefined;
  }

  let serializedParameters: string;
  try {
    serializedParameters = JSON.stringify(candidate.parameters);
  } catch {
    return undefined;
  }
  if (encoder.encode(serializedParameters).byteLength > MAX_TOOL_SCHEMA_BYTES) {
    return undefined;
  }

  return {
    type: "function",
    name: candidate.name,
    description: candidate.description,
    parameters: candidate.parameters as Record<string, unknown>,
  };
}
function parseFunctionCall(value: unknown): AgentFunctionCall | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return undefined;
  }
  const candidate = value as Record<string, unknown>;
  if (
    !hasExactKeys(candidate, ["id", "name", "arguments"]) ||
    typeof candidate.id !== "string" ||
    candidate.id.length === 0 ||
    typeof candidate.name !== "string" ||
    candidate.name.length === 0 ||
    typeof candidate.arguments !== "object" ||
    candidate.arguments === null ||
    Array.isArray(candidate.arguments)
  ) {
    return undefined;
  }
  return {
    id: candidate.id,
    name: candidate.name,
    arguments: candidate.arguments as Record<string, unknown>,
  };
}

function parseTranscriptItem(value: unknown): AgentTranscriptItem | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return undefined;
  }
  const candidate = value as Record<string, unknown>;
  if (candidate.role === "user") {
    if (
      !hasExactKeys(candidate, ["role", "content"]) ||
      typeof candidate.content !== "string" ||
      encoder.encode(candidate.content).byteLength > MAX_TRANSCRIPT_CONTENT_BYTES
    ) {
      return undefined;
    }
    return { role: "user", content: candidate.content };
  }
  if (candidate.role === "assistant") {
    if (
      !hasExactKeys(candidate, ["role"], ["content", "toolCalls"]) ||
      (candidate.content !== undefined && typeof candidate.content !== "string") ||
      (candidate.toolCalls !== undefined && !Array.isArray(candidate.toolCalls))
    ) {
      return undefined;
    }
    let toolCalls: AgentFunctionCall[] | undefined = undefined;
    if (Array.isArray(candidate.toolCalls)) {
      toolCalls = [];
      for (const call of candidate.toolCalls) {
        const parsedCall = parseFunctionCall(call);
        if (parsedCall === undefined) {
          return undefined;
        }
        toolCalls.push(parsedCall);
      }
    }
    if (candidate.content === undefined && toolCalls === undefined) {
      return undefined;
    }
    return {
      role: "assistant",
      ...(candidate.content !== undefined ? { content: candidate.content as string } : {}),
      ...(toolCalls !== undefined ? { toolCalls } : {}),
    };
  }
  if (candidate.role === "tool") {
    if (
      !hasExactKeys(candidate, ["role", "callId", "name", "content"], ["isError"]) ||
      typeof candidate.callId !== "string" ||
      candidate.callId.length === 0 ||
      typeof candidate.name !== "string" ||
      candidate.name.length === 0 ||
      typeof candidate.content !== "string" ||
      encoder.encode(candidate.content).byteLength > MAX_TRANSCRIPT_CONTENT_BYTES ||
      (candidate.isError !== undefined && typeof candidate.isError !== "boolean")
    ) {
      return undefined;
    }
    return {
      role: "tool",
      callId: candidate.callId,
      name: candidate.name,
      content: candidate.content,
      ...(candidate.isError !== undefined ? { isError: candidate.isError } : {}),
    };
  }
  return undefined;
}

function parseHistory(value: unknown): AgentTranscriptItem[] | undefined {
  if (!Array.isArray(value) || value.length > MAX_TRANSCRIPT_ITEMS) {
    return undefined;
  }
  const history: AgentTranscriptItem[] = [];
  for (const item of value) {
    const parsed = parseTranscriptItem(item);
    if (parsed === undefined) {
      return undefined;
    }
    history.push(parsed);
  }
  return history;
}

function parseTurnRequest(value: unknown): AgentTurnRequest | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return undefined;
  }
  const candidate = value as Record<string, unknown>;
  if (
    !hasExactKeys(candidate, ["input", "tools"], ["previousInteractionId", "history"]) ||
    !Array.isArray(candidate.tools) ||
    candidate.tools.length > MAX_TOOLS ||
    (candidate.previousInteractionId !== undefined &&
      (typeof candidate.previousInteractionId !== "string" ||
        candidate.previousInteractionId.length === 0)) ||
    (candidate.history !== undefined && !Array.isArray(candidate.history))
  ) {
    return undefined;
  }

  const tools: AgentToolDeclaration[] = [];
  for (const value of candidate.tools) {
    const tool = parseTool(value);
    if (tool === undefined) {
      return undefined;
    }
    tools.push(tool);
  }

  let input: AgentTurnRequest["input"];
  if (typeof candidate.input === "string") {
    input = candidate.input;
  } else if (Array.isArray(candidate.input)) {
    const results: AgentFunctionResult[] = [];
    for (const value of candidate.input) {
      const result = parseFunctionResult(value);
      if (result === undefined) {
        return undefined;
      }
      results.push(result);
    }
    input = results;
  } else {
    return undefined;
  }

  let history: AgentTranscriptItem[] | undefined = undefined;
  if (candidate.history !== undefined) {
    history = parseHistory(candidate.history);
    if (history === undefined) {
      return undefined;
    }
  }

  return {
    input,
    tools,
    ...(history !== undefined ? { history } : {}),
    ...(typeof candidate.previousInteractionId === "string"
      ? { previousInteractionId: candidate.previousInteractionId }
      : {}),
  };
}

async function readJsonBody(request: Request): Promise<
  | { readonly kind: "ok"; readonly value: unknown }
  | { readonly kind: "invalid" }
  | { readonly kind: "too-large" }
> {
  const contentLength = request.headers.get("content-length");
  if (contentLength !== null) {
    const declaredLength = Number(contentLength);
    if (Number.isFinite(declaredLength) && declaredLength > MAX_REQUEST_BODY_BYTES) {
      return { kind: "too-large" };
    }
  }

  const bytes = await request.arrayBuffer();
  if (bytes.byteLength > MAX_REQUEST_BODY_BYTES) {
    return { kind: "too-large" };
  }

  try {
    return {
      kind: "ok",
      value: JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)),
    };
  } catch {
    return { kind: "invalid" };
  }
}

export const SESSION_COOKIE_NAME = "ohmni_session";
export const DEFAULT_SESSION_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export function verifyPassword(entered: string, correct: string): boolean {
  if (typeof entered !== "string" || typeof correct !== "string") return false;
  const enteredHash = createHash("sha256").update(entered).digest();
  const correctHash = createHash("sha256").update(correct).digest();
  return timingSafeEqual(enteredHash, correctHash);
}

export function createSessionToken(secret: string, timestamp: number = Date.now()): string {
  const effectiveSecret = secret.trim() || "ohmni-default-auth-secret-fallback";
  const payload = String(timestamp);
  const signature = createHmac("sha256", effectiveSecret).update(payload).digest("hex");
  return `${payload}.${signature}`;
}

export function verifySessionToken(token: string | undefined | null, secret: string, maxAgeMs = DEFAULT_SESSION_MAX_AGE_MS, now = Date.now()): boolean {
  if (!token || typeof token !== "string") return false;
  const parts = token.split(".");
  if (parts.length !== 2) return false;
  const [timestampStr, providedSignature] = parts;
  const timestamp = Number(timestampStr);
  if (!Number.isFinite(timestamp) || timestamp <= 0) return false;
  if (now - timestamp > maxAgeMs || timestamp > now + 60_000) return false;
  const effectiveSecret = secret.trim() || "ohmni-default-auth-secret-fallback";
  const expectedSignature = createHmac("sha256", effectiveSecret).update(timestampStr).digest("hex");
  try {
    const providedBuf = Buffer.from(providedSignature, "hex");
    const expectedBuf = Buffer.from(expectedSignature, "hex");
    if (providedBuf.length !== expectedBuf.length) return false;
    return timingSafeEqual(providedBuf, expectedBuf);
  } catch {
    return false;
  }
}

export function extractCookie(cookieHeader: string | null | undefined, cookieName: string): string | undefined {
  if (!cookieHeader) return undefined;
  const cookies = cookieHeader.split(";");
  for (const cookie of cookies) {
    const [name, ...rest] = cookie.trim().split("=");
    if (name === cookieName) return rest.join("=");
  }
  return undefined;
}

export function formatSessionCookie(token: string, options: { isProduction?: boolean; maxAgeSeconds?: number } = {}): string {
  const maxAge = options.maxAgeSeconds ?? 86400;
  const secure = options.isProduction ? "; Secure" : "";
  return `${SESSION_COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

export interface BenchAgentEnvironment {
  readonly AI_PROVIDER?: string;
  readonly GROQ_API_KEY?: string;
  readonly GROQ_MODEL?: string;
  readonly GEMINI_API_KEY?: string;
  readonly GEMINI_MODEL?: string;
  readonly OHMNI_ACCESS_PASSWORD?: string;
  readonly OHMNI_AUTH_SECRET?: string;
  readonly NODE_ENV?: string;
}

export function createBenchAgentHandler(options: {
  env: BenchAgentEnvironment;
  provider?: BenchAgentProvider;
  now?: () => number;
}): (request: Request) => Promise<Response> {
  const rawProviderType = options.env.AI_PROVIDER?.trim().toLowerCase();
  const groqApiKey = options.env.GROQ_API_KEY?.trim() ?? "";
  const groqModel = options.env.GROQ_MODEL?.trim() || DEFAULT_GROQ_MODEL;
  const geminiApiKey = options.env.GEMINI_API_KEY?.trim() ?? "";
  const geminiModel = options.env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL;

  let providerType: "groq" | "gemini";
  if (rawProviderType === "gemini") {
    providerType = "gemini";
  } else if (rawProviderType === "groq") {
    providerType = "groq";
  } else if (options.env.GROQ_API_KEY !== undefined || options.env.GROQ_MODEL !== undefined) {
    providerType = "groq";
  } else if (options.env.GEMINI_API_KEY !== undefined || options.env.GEMINI_MODEL !== undefined) {
    providerType = "gemini";
  } else {
    providerType = "groq";
  }

  const activeApiKey = providerType === "gemini" ? geminiApiKey : groqApiKey;
  const activeModel = providerType === "gemini" ? geminiModel : groqModel;
  const isConfigured = activeApiKey.length > 0;
  const providerLabel = providerType === "gemini" ? "Gemini" : "Groq";

  const provider =
    options.provider ??
    (isConfigured
      ? providerType === "gemini"
        ? new GeminiBenchAgentProvider({ apiKey: geminiApiKey, model: geminiModel })
        : new GroqBenchAgentProvider({ apiKey: groqApiKey, model: groqModel })
      : undefined);
  const model = activeModel;
  const apiKey = activeApiKey;
  const accessPassword = options.env.OHMNI_ACCESS_PASSWORD?.trim() ?? "";
  const authSecret = options.env.OHMNI_AUTH_SECRET?.trim() || "ohmni-auth-secret-key-default";
  const isAuthRequired = accessPassword.length > 0;
  const now = options.now ?? Date.now;
  const sessions = new Map<string, { count: number; windowStartedAt: number }>();
  return async (request: Request): Promise<Response> => {
    const requestId = "req_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
    let url: URL;
    try {
      url = new URL(request.url);
    } catch {
      url = new URL("http://localhost/api/bench-agent");
    }

    // 1. Auth Login Route
    if (url.pathname.endsWith("/auth/login") || url.pathname.endsWith("/login")) {
      if (request.method !== "POST") {
        return jsonResponse({ error: "METHOD_NOT_ALLOWED" }, 405);
      }
      const bodyResult = await readJsonBody(request);
      if (bodyResult.kind !== "ok" || typeof (bodyResult.value as Record<string, unknown>)?.password !== "string") {
        return jsonResponse({ ok: false, error: "INVALID_REQUEST", message: "Missing password field." }, 400);
      }
      const entered = (bodyResult.value as Record<string, unknown>).password as string;
      if (!verifyPassword(entered, accessPassword)) {
        return jsonResponse({ ok: false, error: "INVALID_CREDENTIALS", message: "Incorrect password." }, 401);
      }
      const token = createSessionToken(authSecret, now());
      const isProd = options.env.NODE_ENV === "production";
      const cookieHeader = formatSessionCookie(token, { isProduction: isProd });
      return jsonResponse({ ok: true, message: "Authenticated." }, 200, { "set-cookie": cookieHeader });
    }

    // 2. Auth Protection Gate
    if (isAuthRequired) {
      const cookieHeader = request.headers.get("cookie");
      const authHeader = request.headers.get("authorization");
      const token =
        extractCookie(cookieHeader, SESSION_COOKIE_NAME) ||
        (authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : undefined);

      if (!verifySessionToken(token, authSecret, undefined, now())) {
        return jsonResponse(
          {
            ok: false,
            error: "UNAUTHORIZED",
            message: "Passcode authorization required to access Bench Agent.",
            requestId,
          },
          401,
        );
      }
    }
    const isHealthCheck =
      url.pathname.endsWith("/health") ||
      url.searchParams.get("health") === "1" ||
      url.searchParams.has("health");

    if (isHealthCheck) {
      if (!isConfigured || provider === undefined) {
        return jsonResponse(
          {
            ok: false,
            error: "BENCH_AGENT_UNAVAILABLE",
            message: `${providerLabel} API key is not configured.`,
            requestId,
          },
          503,
        );
      }
      try {
        if (typeof provider.canary === "function") {
          const canaryResult = await provider.canary({ signal: request.signal });
          return jsonResponse({ ...canaryResult, requestId });
        }
        const turnResult = await provider.turn(
          { input: "Reply with exactly OK.", tools: [] },
          { signal: request.signal },
        );
        return jsonResponse({
          ok: true,
          message: turnResult.text ?? "OK",
          model,
          requestId,
        });
      } catch (err: unknown) {
        const safeMessage = sanitizeErrorMessage(err);
        console.error("[BenchAgent Canary Failure]", {
          requestId,
          errorMessage: safeMessage,
          model,
        });
        return jsonResponse(
          {
            ok: false,
            error: "CANARY_FAILED",
            message: safeMessage,
            requestId,
          },
          502,
        );
      }
    }

    if (request.method === "GET") {
      return jsonResponse({
        available: isConfigured,
        provider: providerType,
        model: activeModel,
        ...(isAuthRequired ? { authRequired: true } : {}),
      });
    }
    if (request.method !== "POST") {
      return jsonResponse(
        { error: "METHOD NOT ALLOWED", message: "Use GET or POST.", requestId },
        405,
        { allow: "GET, POST" },
      );
    }

    const origin = request.headers.get("origin");
    if (origin === null || origin !== url.origin) {
      return jsonResponse(
        { error: "FORBIDDEN", message: "Cross-origin requests are not allowed.", requestId },
        403,
      );
    }

    if (!isConfigured || provider === undefined) {
      return jsonResponse(
        {
          error: "BENCH_AGENT_UNAVAILABLE",
          message: `${providerLabel} API key is not configured.`,
          requestId,
        },
        503,
      );
    }

    const contentType = request.headers.get("content-type") ?? "";
    if (contentType.split(";", 1)[0]?.trim().toLowerCase() !== "application/json") {
      return jsonResponse(
        { error: "INVALID REQUEST", message: "Expected application/json.", requestId },
        400,
      );
    }

    const sessionId = request.headers.get(BENCH_AGENT_SESSION_HEADER);
    if (
      sessionId === null ||
      sessionId.length === 0 ||
      encoder.encode(sessionId).byteLength > MAX_SESSION_ID_BYTES
    ) {
      return jsonResponse(
        { error: "INVALID REQUEST", message: "A valid agent session is required.", requestId },
        400,
      );
    }

    const parsedBody = await readJsonBody(request);
    if (parsedBody.kind === "too-large") {
      return jsonResponse(
        { error: "PAYLOAD TOO LARGE", message: "Request body exceeds 128 KiB.", requestId },
        413,
      );
    }
    if (parsedBody.kind === "invalid") {
      return jsonResponse(
        { error: "INVALID REQUEST", message: "Request body must be valid JSON.", requestId },
        400,
      );
    }

    // Check for canary inside body
    if (
      typeof parsedBody.value === "object" &&
      parsedBody.value !== null &&
      (parsedBody.value as Record<string, unknown>).canary === true
    ) {
      try {
        if (typeof provider.canary === "function") {
          const canaryResult = await provider.canary({ signal: request.signal });
          return jsonResponse({ ...canaryResult, requestId });
        }
        const turnResult = await provider.turn(
          { input: "Reply with exactly OK.", tools: [] },
          { signal: request.signal },
        );
        return jsonResponse({
          ok: true,
          message: turnResult.text ?? "OK",
          model,
          requestId,
        });
      } catch (err: unknown) {
        const safeMessage = sanitizeErrorMessage(err);
        console.error("[BenchAgent Canary Failure]", {
          requestId,
          errorMessage: safeMessage,
          model,
        });
        return jsonResponse(
          {
            ok: false,
            error: "CANARY_FAILED",
            message: safeMessage,
            requestId,
          },
          502,
        );
      }
    }

    const turnRequest = parseTurnRequest(parsedBody.value);
    if (turnRequest === undefined) {
      return jsonResponse(
        { error: "INVALID REQUEST", message: "Request body has an invalid shape.", requestId },
        400,
      );
    }

    const timestamp = now();
    const previousRate = sessions.get(sessionId);
    const rate =
      previousRate === undefined ||
      timestamp - previousRate.windowStartedAt >= SESSION_RATE_WINDOW_MS
        ? { count: 0, windowStartedAt: timestamp }
        : previousRate;
    if (rate.count >= MAX_REQUESTS_PER_SESSION) {
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil(
          (SESSION_RATE_WINDOW_MS - (timestamp - rate.windowStartedAt)) / 1_000,
        ),
      );
      return jsonResponse(
        { error: "RATE LIMITED", message: "Too many agent turns.", requestId },
        429,
        { "retry-after": String(retryAfterSeconds) },
      );
    }
    rate.count += 1;
    sessions.delete(sessionId);
    sessions.set(sessionId, rate);
    if (sessions.size > MAX_TRACKED_SESSIONS) {
      const oldestSessionId = sessions.keys().next().value;
      if (typeof oldestSessionId === "string") {
        sessions.delete(oldestSessionId);
      }
    }

    try {
      const result: AgentTurnResult = await provider.turn(turnRequest, {
        signal: request.signal,
      });
      return jsonResponse({ ...result, requestId });
    } catch (err: unknown) {
      if (err instanceof GroqRateLimitError) {
        return jsonResponse(
          {
            error: "RATE_LIMITED",
            message: err.message,
            retryAfter: err.retryAfterSeconds,
            requestId,
          },
          429,
          err.retryAfterSeconds !== undefined
            ? { "retry-after": String(err.retryAfterSeconds) }
            : {},
        );
      }

      const safeMessage = sanitizeErrorMessage(err);
      const errorObj = err as Record<string, unknown> | undefined;
      const errorName = errorObj?.name ?? (err instanceof Error ? err.name : "Error");
      const statusCode = (errorObj?.status ?? errorObj?.statusCode ?? (err as any)?.code) as number | undefined;

      console.error("[BenchAgent Server Failure]", {
        requestId,
        errorName,
        errorMessage: safeMessage,
        statusCode,
        model,
      });

      return jsonResponse(
        {
          error: "BENCH_AGENT_FAILED",
          message: safeMessage,
          requestId,
        },
        502,
      );
    }
  };
}

// ============================================================================
// Node.js + Web Standard Universal Serverless Adapter
// ============================================================================

const webHandler = createBenchAgentHandler({
  env: {
    AI_PROVIDER: process.env.AI_PROVIDER,
    GROQ_API_KEY: process.env.GROQ_API_KEY,
    GROQ_MODEL: process.env.GROQ_MODEL,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    GEMINI_MODEL: process.env.GEMINI_MODEL,
    OHMNI_ACCESS_PASSWORD: process.env.OHMNI_ACCESS_PASSWORD,
    OHMNI_AUTH_SECRET: process.env.OHMNI_AUTH_SECRET,
    NODE_ENV: process.env.NODE_ENV,
  },
});

async function nodeToWebRequest(req: IncomingMessage): Promise<Request> {
  const host = req.headers.host || "localhost";
  const protocol = (req.headers["x-forwarded-proto"] as string) || "https";
  const url = new URL(req.url || "/", `${protocol}://${host}`);

  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      for (const v of value) headers.append(key, v);
    } else {
      headers.set(key, value);
    }
  }

  let body: BodyInit | undefined = undefined;
  if (req.method !== "GET" && req.method !== "HEAD") {
    const rawBody = (req as unknown as { body?: unknown }).body;
    if (rawBody !== undefined && rawBody !== null) {
      if (typeof rawBody === "string") {
        body = rawBody;
      } else if (Buffer.isBuffer(rawBody)) {
        body = new Uint8Array(rawBody);
      } else if (typeof rawBody === "object") {
        body = JSON.stringify(rawBody);
      }
    } else {
      const chunks: Buffer[] = [];
      for await (const chunk of req) {
        chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : Buffer.from(chunk as Uint8Array));
      }
      body = new Uint8Array(Buffer.concat(chunks));
    }
  }

  return new Request(url.toString(), {
    method: req.method || "GET",
    headers,
    body,
  });
}

async function sendWebResponseToNode(webResponse: Response, res: ServerResponse): Promise<void> {
  res.statusCode = webResponse.status;
  webResponse.headers.forEach((value, key) => {
    res.setHeader(key, value);
  });
  const arrayBuffer = await webResponse.arrayBuffer();
  res.end(Buffer.from(arrayBuffer));
}

export async function universalHandler(
  reqOrRequest: IncomingMessage | Request,
  resOrUndefined?: ServerResponse,
): Promise<Response | void> {
  if (resOrUndefined && typeof (resOrUndefined as ServerResponse).setHeader === "function") {
    const nodeReq = reqOrRequest as IncomingMessage;
    const nodeRes = resOrUndefined as ServerResponse;
    try {
      const webReq = await nodeToWebRequest(nodeReq);
      const webRes = await webHandler(webReq);
      await sendWebResponseToNode(webRes, nodeRes);
    } catch (err) {
      console.error("[BenchAgent Serverless Error]", err);
      nodeRes.statusCode = 500;
      nodeRes.setHeader("content-type", "application/json");
      nodeRes.end(JSON.stringify({ error: "INTERNAL_SERVER_ERROR", message: "Server error occurred." }));
    }
    return;
  }

  return webHandler(reqOrRequest as Request);
}

export default universalHandler;

export const GET = (request: Request) => universalHandler(request);
export const POST = (request: Request) => universalHandler(request);
export const OPTIONS = (request: Request) => universalHandler(request);
