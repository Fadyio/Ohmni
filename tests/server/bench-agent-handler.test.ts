import { describe, expect, it } from "bun:test";
import {
  DEFAULT_GEMINI_MODEL,
  MAX_REQUEST_BODY_BYTES,
  MAX_REQUESTS_PER_SESSION,
  MAX_TOOL_DESCRIPTION_BYTES,
  MAX_TOOL_SCHEMA_BYTES,
  MAX_TOOLS,
  createBenchAgentHandler,
  type AgentTurnRequest,
  type AgentTurnResult,
  type BenchAgentHandler,
  type BenchAgentProvider,
} from "../../server/bench-agent/handler";

const ORIGIN = "https://ohmni.test";
const ENDPOINT = `${ORIGIN}/api/bench-agent`;
const API_KEY = "server-only-gemini-secret";
const SESSION_HEADER = "x-bench-agent-session";

const TOOL = {
  type: "function" as const,
  name: "read_supply_voltage",
  description: "Read the current supply voltage.",
  parameters: {
    type: "object",
    properties: {},
    additionalProperties: false,
  },
};

const PROVIDER_RESULT: AgentTurnResult = {
  interactionId: "interaction-2",
  functionCalls: [
    {
      id: "call-1",
      name: "read_supply_voltage",
      arguments: { rail: "3v3" },
    },
  ],
  text: "Measure the 3.3 V rail.",
};


function recordingProvider(result: AgentTurnResult = PROVIDER_RESULT): {
  provider: BenchAgentProvider;
  requests: AgentTurnRequest[];
} {
  const requests: AgentTurnRequest[] = [];
  const provider: BenchAgentProvider = {
    async turn(request) {
      requests.push(structuredClone(request));
      return structuredClone(result);
    },
  };

  return { provider, requests };
}

function createHandler(
  provider: BenchAgentProvider,
  options: {
    apiKey?: string;
    model?: string;
    now?: () => number;
  } = {},
): BenchAgentHandler {
  return createBenchAgentHandler({
    env: {
      GEMINI_API_KEY: options.apiKey === undefined ? API_KEY : options.apiKey,
      GEMINI_MODEL: options.model,
    },
    provider,
    now: options.now,
  });
}

function request(
  method: string,
  options: {
    body?: string;
    origin?: string | null;
    session?: string;
    headers?: Record<string, string>;
  } = {},
): Request {
  const headers = new Headers(options.headers);
  if (options.body !== undefined && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  if (options.origin !== null) {
    headers.set("origin", options.origin ?? ORIGIN);
  }
  headers.set(SESSION_HEADER, options.session ?? "session-a");

  return new Request(ENDPOINT, {
    method,
    headers,
    body: options.body,
  });
}

function jsonRequest(
  value: unknown,
  options: {
    origin?: string | null;
    session?: string;
    headers?: Record<string, string>;
  } = {},
): Request {
  return request("POST", { ...options, body: JSON.stringify(value) });
}

async function responseJson(response: Response): Promise<Record<string, unknown>> {
  return (await response.json()) as Record<string, unknown>;
}

describe("createBenchAgentHandler", () => {
  describe("availability", () => {
    it("reports the fixed default model without exposing the configured API key", async () => {
      const { provider, requests } = recordingProvider();
      const handler = createHandler(provider);

      const response = await handler(request("GET", { origin: null }));
      const body = await response.text();

      expect(response.status).toBe(200);
      expect(JSON.parse(body)).toEqual({
        available: true,
        model: DEFAULT_GEMINI_MODEL,
      });
      expect(body).not.toContain(API_KEY);
      expect(requests).toHaveLength(0);
    });

    it("reports unavailable when GEMINI_API_KEY is absent", async () => {
      const { provider, requests } = recordingProvider();
      const handler = createHandler(provider, {
        apiKey: "",
        model: "server-selected-model",
      });

      const response = await handler(request("GET", { origin: null }));

      expect(response.status).toBe(200);
      expect(await responseJson(response)).toEqual({
        available: false,
        model: "server-selected-model",
      });
      expect(requests).toHaveLength(0);
    });

    it("returns the exact unavailable response for POST when the key is missing", async () => {
      const { provider, requests } = recordingProvider();
      const handler = createHandler(provider, { apiKey: "" });

      const response = await handler(
        jsonRequest({ input: "Inspect the device", tools: [TOOL] }),
      );
      const body = await response.text();

      expect(response.status).toBe(503);
      expect(JSON.parse(body)).toEqual({
        error: "BENCH AGENT UNAVAILABLE",
        message: "Gemini API key is not configured.",
      });
      expect(body).not.toContain(API_KEY);
      expect(requests).toHaveLength(0);
    });
  });

  describe("valid turns", () => {
    it("forwards only input, tools, and previousInteractionId and returns the provider result", async () => {
      const { provider, requests } = recordingProvider();
      const handler = createHandler(provider, { model: "server-selected-model" });
      const turn = {
        input: "Find the voltage fault",
        tools: [TOOL],
        previousInteractionId: "interaction-1",
      };

      const response = await handler(jsonRequest(turn));
      const body = await response.text();

      expect(response.status).toBe(200);
      expect(JSON.parse(body)).toEqual(PROVIDER_RESULT);
      expect(requests).toEqual([turn]);
      expect(Object.keys(requests[0]).sort()).toEqual([
        "input",
        "previousInteractionId",
        "tools",
      ]);
      expect(body).not.toContain(API_KEY);
    });

    it("preserves the function-result call_id sent to the provider", async () => {
      const { provider, requests } = recordingProvider({
        interactionId: "interaction-3",
        functionCalls: [],
        text: "The measurement confirms a brownout.",
      });
      const handler = createHandler(provider);
      const functionResult = {
        type: "function_result" as const,
        name: "read_supply_voltage",
        call_id: "call-1",
        result: [{ type: "text" as const, text: "{\"voltage\":2.71}" }] as const,
        is_error: false,
      };

      const response = await handler(
        jsonRequest({
          input: [functionResult],
          tools: [TOOL],
          previousInteractionId: "interaction-2",
        }),
      );

      expect(response.status).toBe(200);
      expect(requests).toHaveLength(1);
      expect(requests[0].input).toEqual([functionResult]);
      expect(Array.isArray(requests[0].input)).toBe(true);
      if (Array.isArray(requests[0].input)) {
        expect(requests[0].input[0].call_id).toBe("call-1");
      }
    });

    it("does not allow a client-provided model to reach the provider", async () => {
      const { provider, requests } = recordingProvider();
      const handler = createHandler(provider, { model: "server-selected-model" });

      const response = await handler(
        jsonRequest({
          input: "Inspect the device",
          tools: [TOOL],
          model: "client-selected-model",
          modelName: "another-client-model",
        }),
      );
      const body = await response.text();

      if (response.ok) {
        expect(requests).toEqual([
          {
            input: "Inspect the device",
            tools: [TOOL],
          },
        ]);
        expect(Object.keys(requests[0]).sort()).toEqual(["input", "tools"]);
      } else {
        expect(response.status).toBe(400);
        expect(requests).toHaveLength(0);
      }
      expect(body).not.toContain("client-selected-model");
      expect(body).not.toContain(API_KEY);
    });
  });

  describe("request rejection", () => {
    it("rejects a cross-origin POST before invoking the provider", async () => {
      const { provider, requests } = recordingProvider();
      const handler = createHandler(provider);

      const response = await handler(
        jsonRequest(
          { input: "Inspect the device", tools: [TOOL] },
          { origin: "https://attacker.example" },
        ),
      );

      expect(response.status).toBe(403);
      expect(requests).toHaveLength(0);
      expect(await response.text()).not.toContain(API_KEY);
    });

    it("rejects POST requests without an Origin header", async () => {
      const { provider, requests } = recordingProvider();
      const handler = createHandler(provider);

      const response = await handler(
        jsonRequest(
          { input: "Inspect the device", tools: [TOOL] },
          { origin: null },
        ),
      );

      expect(response.status).toBe(403);
      expect(requests).toHaveLength(0);
    });

    it("rejects unsupported methods without invoking the provider", async () => {
      const { provider, requests } = recordingProvider();
      const handler = createHandler(provider);

      const response = await handler(request("PUT"));

      expect(response.status).toBe(405);
      expect(response.headers.get("allow")).toBe("GET, POST");
      expect(requests).toHaveLength(0);
    });

    it("rejects invalid JSON and invalid fixed-schema requests", async () => {
      const { provider, requests } = recordingProvider();
      const handler = createHandler(provider);

      const invalidJson = await handler(request("POST", { body: "{not-json" }));
      const invalidSchema = await handler(
        jsonRequest({ input: 42, tools: [TOOL] }),
      );
      const missingTools = await handler(
        jsonRequest({ input: "Inspect the device" }),
      );

      expect(invalidJson.status).toBe(400);
      expect(invalidSchema.status).toBe(400);
      expect(missingTools.status).toBe(400);
      expect(requests).toHaveLength(0);
    });

    it("rejects request bodies larger than 128 KiB", async () => {
      expect(MAX_REQUEST_BODY_BYTES).toBe(128 * 1024);
      const { provider, requests } = recordingProvider();
      const handler = createHandler(provider);
      const oversizedBody = "x".repeat(MAX_REQUEST_BODY_BYTES + 1);

      const response = await handler(request("POST", { body: oversizedBody }));

      expect(response.status).toBe(413);
      expect(requests).toHaveLength(0);
    });

    it("rejects more than 64 function declarations", async () => {
      expect(MAX_TOOLS).toBe(64);
      const { provider, requests } = recordingProvider();
      const handler = createHandler(provider);
      const tools = Array.from({ length: MAX_TOOLS + 1 }, (_, index) => ({
        ...TOOL,
        name: `tool_${index}`,
      }));

      const response = await handler(
        jsonRequest({ input: "Inspect the device", tools }),
      );

      expect(response.status).toBe(400);
      expect(requests).toHaveLength(0);
    });

    it("rejects tool descriptions larger than 2 KiB", async () => {
      expect(MAX_TOOL_DESCRIPTION_BYTES).toBe(2 * 1024);
      const { provider, requests } = recordingProvider();
      const handler = createHandler(provider);
      const tool = {
        ...TOOL,
        description: "d".repeat(MAX_TOOL_DESCRIPTION_BYTES + 1),
      };

      const response = await handler(
        jsonRequest({ input: "Inspect the device", tools: [tool] }),
      );

      expect(response.status).toBe(400);
      expect(requests).toHaveLength(0);
    });

    it("rejects serialized tool schemas larger than 16 KiB", async () => {
      expect(MAX_TOOL_SCHEMA_BYTES).toBe(16 * 1024);
      const { provider, requests } = recordingProvider();
      const handler = createHandler(provider);
      const tool = {
        ...TOOL,
        parameters: {
          type: "object",
          description: "s".repeat(MAX_TOOL_SCHEMA_BYTES),
        },
      };

      const response = await handler(
        jsonRequest({ input: "Inspect the device", tools: [tool] }),
      );

      expect(response.status).toBe(400);
      expect(requests).toHaveLength(0);
    });
  });

  describe("session rate protection", () => {
    it("bounds one session without preventing a different session from proceeding", async () => {
      expect(MAX_REQUESTS_PER_SESSION).toBeGreaterThan(0);
      const { provider, requests } = recordingProvider({
        interactionId: "interaction-rate",
        functionCalls: [],
      });
      const handler = createHandler(provider, { now: () => 10_000 });
      const turn = { input: "Inspect the device", tools: [TOOL] };

      for (let index = 0; index < MAX_REQUESTS_PER_SESSION; index += 1) {
        const response = await handler(
          jsonRequest(turn, { session: "bounded-session" }),
        );
        expect(response.status).toBe(200);
      }

      const limited = await handler(
        jsonRequest(turn, { session: "bounded-session" }),
      );
      expect(limited.status).toBe(429);
      expect(limited.headers.get("retry-after")).not.toBeNull();
      expect(await limited.text()).not.toContain(API_KEY);
      expect(requests).toHaveLength(MAX_REQUESTS_PER_SESSION);

      const otherSession = await handler(
        jsonRequest(turn, { session: "different-session" }),
      );
      expect(otherSession.status).toBe(200);
      expect(requests).toHaveLength(MAX_REQUESTS_PER_SESSION + 1);
    });
  });
});
