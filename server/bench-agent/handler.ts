import {
  DEFAULT_GEMINI_MODEL,
  GeminiBenchAgentProvider,
  sanitizeErrorMessage,
  type AgentFunctionResult,
  type AgentTurnRequest,
  type AgentTurnResult,
  type BenchAgentProvider,
  type GeminiFunctionDeclaration,
} from "./gemini-provider.ts";
export type {
  AgentFunctionCall,
  AgentFunctionResult,
  AgentTurnRequest,
  AgentTurnResult,
  BenchAgentProvider,
  GeminiFunctionDeclaration,
} from "./gemini-provider.ts";
export { DEFAULT_GEMINI_MODEL, sanitizeErrorMessage } from "./gemini-provider.ts";

export const MAX_REQUEST_BODY_BYTES = 128 * 1024;
export const MAX_TOOLS = 64;
export const MAX_TOOL_DESCRIPTION_BYTES = 2 * 1024;
export const MAX_TOOL_SCHEMA_BYTES = 16 * 1024;
export const MAX_REQUESTS_PER_SESSION = 24;
export const SESSION_RATE_WINDOW_MS = 60_000;
export const BENCH_AGENT_SESSION_HEADER = "x-bench-agent-session";

const MAX_SESSION_ID_BYTES = 256;
const MAX_TRACKED_SESSIONS = 1_024;
const JSON_HEADERS = { "content-type": "application/json; charset=utf-8" };
const encoder = new TextEncoder();

export interface BenchAgentEnvironment {
  readonly GEMINI_API_KEY?: string;
  readonly GEMINI_MODEL?: string;
}

export type BenchAgentHandler = (request: Request) => Promise<Response>;

export interface CreateBenchAgentHandlerOptions {
  readonly env: BenchAgentEnvironment;
  readonly provider?: BenchAgentProvider;
  readonly now?: () => number;
}

interface SessionRateState {
  count: number;
  windowStartedAt: number;
}

interface ParsedObject {
  readonly [key: string]: unknown;
}

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
  value: ParsedObject,
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
  const candidate = value as ParsedObject;
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
  const content = first as ParsedObject;
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

function parseTool(value: unknown): GeminiFunctionDeclaration | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return undefined;
  }
  const candidate = value as ParsedObject;
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

function parseTurnRequest(value: unknown): AgentTurnRequest | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return undefined;
  }
  const candidate = value as ParsedObject;
  if (
    !hasExactKeys(candidate, ["input", "tools"], ["previousInteractionId"]) ||
    !Array.isArray(candidate.tools) ||
    candidate.tools.length > MAX_TOOLS ||
    (candidate.previousInteractionId !== undefined &&
      (typeof candidate.previousInteractionId !== "string" ||
        candidate.previousInteractionId.length === 0))
  ) {
    return undefined;
  }

  const tools: GeminiFunctionDeclaration[] = [];
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

  return {
    input,
    tools,
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

export function createBenchAgentHandler(
  options: CreateBenchAgentHandlerOptions,
): BenchAgentHandler {
  const apiKey = options.env.GEMINI_API_KEY?.trim() ?? "";
  const model = options.env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL;
  const provider =
    options.provider ??
    (apiKey.length > 0
      ? new GeminiBenchAgentProvider({ apiKey, model })
      : undefined);
  const now = options.now ?? Date.now;
  const sessions = new Map<string, SessionRateState>();

  return async (request: Request): Promise<Response> => {
    const requestId = "req_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
    let url: URL;
    try {
      url = new URL(request.url);
    } catch {
      url = new URL("http://localhost/api/bench-agent");
    }

    const isHealthCheck =
      url.pathname.endsWith("/health") ||
      url.searchParams.get("health") === "1" ||
      url.searchParams.has("health");

    if (isHealthCheck) {
      if (apiKey.length === 0 || provider === undefined) {
        return jsonResponse(
          {
            ok: false,
            error: "BENCH_AGENT_UNAVAILABLE",
            message: "Gemini API key is not configured.",
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
        available: apiKey.length > 0,
        model,
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

    if (apiKey.length === 0 || provider === undefined) {
      return jsonResponse(
        {
          error: "BENCH_AGENT_UNAVAILABLE",
          message: "Gemini API key is not configured.",
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
