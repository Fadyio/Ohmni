import type {
  AgentFunctionCall,
  AgentTurnRequest,
  AgentTurnResult,
  BenchAgentAvailability,
  BenchAgentProvider,
} from "./types";

const BENCH_AGENT_ENDPOINT = "/api/bench-agent";
const SESSION_HEADER = "x-bench-agent-session";
const SESSION_ID = globalThis.crypto.randomUUID();

function parseFunctionCall(value: unknown): AgentFunctionCall {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Bench agent returned an invalid function call.");
  }

  const record = value as Record<string, unknown>;
  const { id, name, arguments: callArguments } = record;
  if (
    typeof id !== "string" ||
    id.length === 0 ||
    typeof name !== "string" ||
    name.length === 0 ||
    callArguments === null ||
    typeof callArguments !== "object" ||
    Array.isArray(callArguments)
  ) {
    throw new Error("Bench agent returned an invalid function call.");
  }

  return {
    id,
    name,
    arguments: callArguments as Record<string, unknown>,
  };
}

function parseTurnResult(value: unknown): AgentTurnResult {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Bench agent returned an invalid response.");
  }

  const record = value as Record<string, unknown>;
  const { interactionId, functionCalls, text } = record;
  if (
    typeof interactionId !== "string" ||
    interactionId.length === 0 ||
    !Array.isArray(functionCalls) ||
    (text !== undefined && typeof text !== "string")
  ) {
    throw new Error("Bench agent returned an invalid response.");
  }

  return {
    interactionId,
    functionCalls: functionCalls.map(parseFunctionCall),
    ...(text === undefined ? {} : { text }),
  };
}

function parseAvailability(value: unknown): BenchAgentAvailability {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Bench agent returned invalid availability information.");
  }

  const record = value as Record<string, unknown>;
  if (
    typeof record.available !== "boolean" ||
    typeof record.model !== "string" ||
    record.model.length === 0
  ) {
    throw new Error("Bench agent returned invalid availability information.");
  }

  return {
    available: record.available as boolean,
    model: record.model as string,
  };
}
function sanitizeResponseText(text: string): string {
  return text
    .replace(/AIza[0-9A-Za-z-_]{35}/g, "[REDACTED_API_KEY]")
    .replace(/(?:api[_-]?key|secret|token|password|bearer)[=:\s]+["']?([^\s"',;]+)/gi, (match) => {
      return match.replace(/([=:\s]+["']?)(.+)/, "$1[REDACTED]");
    })
    .slice(0, 1000);
}

async function readResponseJson(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type") || "unknown";
  let rawText = "";
  try {
    rawText = await response.text();
  } catch {
    throw new Error(`Bench Agent API returned HTTP ${response.status} ${contentType} with unreadable body.`);
  }

  try {
    return JSON.parse(rawText);
  } catch {
    const sanitized = sanitizeResponseText(rawText).trim();
    const excerpt = sanitized.length > 0 ? sanitized : "(empty response)";
    throw new Error(
      `Bench Agent API returned HTTP ${response.status} ${contentType}.\nResponse:\n${excerpt}`
    );
  }
}

function responseError(response: Response, payload: unknown): Error {
  if (payload !== null && typeof payload === "object" && !Array.isArray(payload)) {
    const record = payload as Record<string, unknown>;
    if (
      record.protection !== undefined ||
      (typeof record.error === "object" &&
        record.error !== null &&
        (record.error as Record<string, unknown>).message === "Protected deployment")
    ) {
      return new Error(
        "Vercel Protected Deployment: Vercel Authentication is enabled on this preview deployment. Disable Vercel Authentication under Project Settings -> Deployment Protection or access with bypass credentials."
      );
    }
    if (typeof record.error === "object" && record.error !== null) {
      const nestedMessage = (record.error as Record<string, unknown>).message;
      if (typeof nestedMessage === "string" && nestedMessage.trim() !== "") {
        return new Error(nestedMessage);
      }
    }
    const message = record.message;
    if (typeof message === "string" && message.trim() !== "") {
      return new Error(message);
    }
  }
  return new Error(`Bench agent request failed with status ${response.status}.`);
}

export type FetchFunction = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export class HttpBenchAgentProvider implements BenchAgentProvider {
  private readonly fetchImpl: FetchFunction;

  public constructor(fetchImpl?: FetchFunction) {
    this.fetchImpl = fetchImpl ? ((input, init) => fetchImpl(input, init)) : ((input, init) => globalThis.fetch(input, init));
  }
  public async turn(
    request: AgentTurnRequest,
    options?: { signal?: AbortSignal }
  ): Promise<AgentTurnResult> {
    const response = await this.fetchImpl(BENCH_AGENT_ENDPOINT, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        [SESSION_HEADER]: SESSION_ID,
      },
      body: JSON.stringify(request),
      signal: options?.signal,
    });
    const payload = await readResponseJson(response);
    if (!response.ok) {
      throw responseError(response, payload);
    }
    return parseTurnResult(payload);
  }
}

export async function fetchBenchAgentAvailability(
  fetchImpl?: FetchFunction,
  options?: { signal?: AbortSignal }
): Promise<BenchAgentAvailability> {
  const executeFetch = fetchImpl ? ((input: RequestInfo | URL, init?: RequestInit) => fetchImpl(input, init)) : ((input: RequestInfo | URL, init?: RequestInit) => globalThis.fetch(input, init));
  const response = await executeFetch(BENCH_AGENT_ENDPOINT, {
    method: "GET",
    headers: { [SESSION_HEADER]: SESSION_ID },
    signal: options?.signal,
  });
  const payload = await readResponseJson(response);
  if (!response.ok) {
    throw responseError(response, payload);
  }
  return parseAvailability(payload);
}
