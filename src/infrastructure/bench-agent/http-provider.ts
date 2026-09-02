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

async function readResponseJson(response: Response): Promise<unknown> {
  try {
    const payload: unknown = await response.json();
    return payload;
  } catch {
    throw new Error("Bench agent returned a non-JSON response.");
  }
}

function responseError(response: Response, payload: unknown): Error {
  if (payload !== null && typeof payload === "object" && !Array.isArray(payload)) {
    const message = (payload as Record<string, unknown>).message;
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
