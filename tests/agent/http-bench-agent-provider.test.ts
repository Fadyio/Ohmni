import { describe, expect, it } from "bun:test";
import {
  HttpBenchAgentProvider,
  fetchBenchAgentAvailability,
} from "@/infrastructure/bench-agent/http-provider";

const ENDPOINT = "/api/bench-agent";
const SESSION_HEADER = "x-bench-agent-session";
const SERVER_SECRET = "server-only-gemini-secret";
const SERVER_MODEL = "gemini-3.7-flash";

const TURN_REQUEST = {
  input: [
    {
      type: "function_result" as const,
      name: "read_supply_voltage",
      call_id: "call-1",
      result: [{ type: "text" as const, text: "{\"voltage\":2.71}" }],
      is_error: false,
    },
  ],
  tools: [
    {
      type: "function" as const,
      name: "read_supply_voltage",
      description: "Read the current supply voltage.",
      parameters: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
  ],
  previousInteractionId: "interaction-1",
};

const TURN_RESULT = {
  interactionId: "interaction-2",
  functionCalls: [
    {
      id: "call-2",
      name: "read_supply_voltage",
      arguments: { rail: "3v3" },
    },
  ],
  text: "The 3.3 V rail is low.",
};

interface FetchCall {
  readonly input: RequestInfo | URL;
  readonly init?: RequestInit;
}

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function recordingFetch(responses: readonly Response[]): {
  readonly calls: FetchCall[];
  readonly fetchImpl: typeof fetch;
} {
  const calls: FetchCall[] = [];
  let responseIndex = 0;
  const fetchImpl = (async (
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> => {
    calls.push({ input, init });
    const response = responses[responseIndex];
    responseIndex += 1;
    if (!response) {
      throw new Error(`Unexpected fetch call ${responseIndex}`);
    }
    return response;
  }) as typeof fetch;

  return { calls, fetchImpl };
}

function parsedBody(call: FetchCall): unknown {
  expect(typeof call.init?.body).toBe("string");
  return JSON.parse(call.init?.body as string) as unknown;
}

function wireText(call: FetchCall): string {
  return JSON.stringify({
    input: String(call.input),
    headers: Object.fromEntries(new Headers(call.init?.headers)),
    body: call.init?.body,
  });
}

async function withForbiddenBrowserPersistence<T>(
  operation: () => Promise<T>,
): Promise<T> {
  const names = ["localStorage", "sessionStorage", "window"] as const;
  const originals = names.map((name) => [
    name,
    Object.getOwnPropertyDescriptor(globalThis, name),
  ] as const);

  for (const name of names) {
    Object.defineProperty(globalThis, name, {
      configurable: true,
      get() {
        throw new Error(`${name} must not be used by the HTTP provider`);
      },
    });
  }

  try {
    return await operation();
  } finally {
    for (const [name, descriptor] of originals) {
      if (descriptor) {
        Object.defineProperty(globalThis, name, descriptor);
      } else {
        Reflect.deleteProperty(globalThis, name);
      }
    }
  }
}

describe("HttpBenchAgentProvider", () => {
  it("posts the exact turn to the same-origin endpoint and parses the result", async () => {
    const secondResult = {
      interactionId: "interaction-3",
      functionCalls: [],
      text: "Investigation complete.",
    };
    const { calls, fetchImpl } = recordingFetch([
      jsonResponse(TURN_RESULT),
      jsonResponse(secondResult),
    ]);
    const abortController = new AbortController();

    const results = await withForbiddenBrowserPersistence(async () => {
      const provider = new HttpBenchAgentProvider(fetchImpl);
      return [
        await provider.turn(TURN_REQUEST, { signal: abortController.signal }),
        await provider.turn(TURN_REQUEST),
      ];
    });

    expect(results).toEqual([TURN_RESULT, secondResult]);
    expect(calls).toHaveLength(2);

    const firstCall = calls[0];
    expect(firstCall.input).toBe(ENDPOINT);
    expect(firstCall.init?.method).toBe("POST");
    expect(new Headers(firstCall.init?.headers).get("content-type")).toBe(
      "application/json",
    );
    expect(firstCall.init?.signal).toBe(abortController.signal);
    expect(parsedBody(firstCall)).toEqual(TURN_REQUEST);
    expect(Object.keys(parsedBody(firstCall) as Record<string, unknown>).sort()).toEqual([
      "input",
      "previousInteractionId",
      "tools",
    ]);

    const firstSession = new Headers(firstCall.init?.headers).get(SESSION_HEADER);
    const secondSession = new Headers(calls[1].init?.headers).get(SESSION_HEADER);
    expect(firstSession).toBeTruthy();
    expect(secondSession).toBe(firstSession);
    expect(firstSession).not.toBe(SERVER_SECRET);

    for (const call of calls) {
      expect(call.input).toBe(ENDPOINT);
      expect(wireText(call)).not.toContain(SERVER_SECRET);
      expect(wireText(call)).not.toContain(SERVER_MODEL);
      expect(wireText(call)).not.toMatch(/api[_-]?key/i);
      expect(wireText(call)).not.toMatch(/authorization/i);
      expect(wireText(call)).not.toMatch(/"model"\s*:/i);
      expect(wireText(call)).not.toMatch(/localStorage|sessionStorage|window/);
    }
  });

  it("throws the unavailable message returned by a 503 response", async () => {
    const { fetchImpl } = recordingFetch([
      jsonResponse(
        {
          error: "BENCH AGENT UNAVAILABLE",
          message: "Gemini API key is not configured.",
        },
        503,
      ),
    ]);
    const provider = new HttpBenchAgentProvider(fetchImpl);

    try {
      await provider.turn(TURN_REQUEST);
      throw new Error("Expected the provider turn to reject");
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toBe("Gemini API key is not configured.");
    }
  });

  it("formats forensic error when receiving non-JSON HTML error page with redacted secrets", async () => {
    const htmlBody = `<!DOCTYPE html><html><body><h1>FUNCTION_INVOCATION_FAILED</h1><p>Error with API key AIzaSyA1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6Q and secret=supersecret123456</p></body></html>`;
    const htmlResponse = new Response(htmlBody, {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
    const { fetchImpl } = recordingFetch([htmlResponse]);
    const provider = new HttpBenchAgentProvider(fetchImpl);

    try {
      await provider.turn(TURN_REQUEST);
      throw new Error("Expected turn to reject");
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      const message = (error as Error).message;
      expect(message).toContain("Bench Agent API returned HTTP 500 text/html; charset=utf-8.");
      expect(message).toContain("FUNCTION_INVOCATION_FAILED");
      expect(message).not.toContain("AIzaSyA1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6Q");
      expect(message).not.toContain("supersecret123456");
      expect(message).toContain("[REDACTED");
    }
  });

  it("formats forensic error on empty non-JSON response", async () => {
    const emptyResponse = new Response("", {
      status: 502,
      headers: { "content-type": "text/plain" },
    });
    const { fetchImpl } = recordingFetch([emptyResponse]);
    const provider = new HttpBenchAgentProvider(fetchImpl);

    try {
      await provider.turn(TURN_REQUEST);
      throw new Error("Expected turn to reject");
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      const message = (error as Error).message;
      expect(message).toContain("Bench Agent API returned HTTP 502 text/plain.");
      expect(message).toContain("(empty response)");
    }
  });

  it("detects and surfaces Vercel Protected Deployment 401 response with actionable error", async () => {
    const vercelAuthResponse = jsonResponse(
      {
        protection: { auto_vercel_auth_redirect: true, vercel_auth_enabled: true },
        error: { code: "401", message: "Protected deployment" },
      },
      401,
    );
    const { fetchImpl } = recordingFetch([vercelAuthResponse]);
    const provider = new HttpBenchAgentProvider(fetchImpl);

    try {
      await provider.turn(TURN_REQUEST);
      throw new Error("Expected turn to reject");
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      const message = (error as Error).message;
      expect(message).toContain("Vercel Protected Deployment");
      expect(message).toContain("Vercel Authentication is enabled on this preview deployment");
    }
  });
});

describe("fetchBenchAgentAvailability", () => {
  it("gets and parses availability from the same-origin endpoint", async () => {
    const availability = { available: false, model: SERVER_MODEL };
    const { calls, fetchImpl } = recordingFetch([jsonResponse(availability)]);

    const result = await withForbiddenBrowserPersistence(() =>
      fetchBenchAgentAvailability(fetchImpl),
    );

    expect(result).toEqual(availability);
    expect(calls).toHaveLength(1);
    expect(calls[0].input).toBe(ENDPOINT);
    expect(calls[0].init?.method ?? "GET").toBe("GET");
    expect(wireText(calls[0])).not.toContain(SERVER_SECRET);
    expect(wireText(calls[0])).not.toMatch(/api[_-]?key|authorization/i);
    expect(wireText(calls[0])).not.toMatch(/localStorage|sessionStorage|window/);
  });
});
