import { describe, expect, it } from "bun:test";
import {
  GroqBenchAgentProvider,
  GroqRateLimitError,
  stripThinking,
  compactTranscriptItem,
  translateToolsToGroq,
  buildGroqMessages,
  parseGroqToolCalls,
  DEFAULT_GROQ_MODEL,
  GROQ_MAX_COMPLETION_TOKENS,
  BENCH_AGENT_SYSTEM_INSTRUCTION,
  type FetchFunction,
} from "../../server/bench-agent/groq-provider";
import type {
  AgentToolDeclaration,
  AgentTranscriptItem,
  AgentTurnRequest,
} from "../../src/infrastructure/bench-agent/types";

const TEST_API_KEY = "gsk_test_secret_12345678901234567890";

const VOLTAGE_TOOL: AgentToolDeclaration = {
  type: "function",
  name: "measure_supply_voltage",
  description: "Measure the current supply voltage.",
  parameters: {
    type: "object",
    properties: {},
  },
};

describe("GroqBenchAgentProvider", () => {
  describe("stripThinking", () => {
    it("strips think tags from output text", () => {
      const input = "<think>\nThinking about voltage measurements...\n</think>I will measure the voltage.";
      expect(stripThinking(input)).toBe("I will measure the voltage.");
    });

    it("returns untouched text when no think tags are present", () => {
      const input = "Standard diagnostic hypothesis.";
      expect(stripThinking(input)).toBe("Standard diagnostic hypothesis.");
    });
  });

  describe("translateToolsToGroq", () => {
    it("translates generic AgentToolDeclaration to Groq/OpenAI function format", () => {
      const translated = translateToolsToGroq([VOLTAGE_TOOL]);
      expect(translated).toEqual([
        {
          type: "function",
          function: {
            name: "measure_supply_voltage",
            description: "Measure the current supply voltage.",
            parameters: {
              type: "object",
              properties: {},
            },
          },
        },
      ]);
    });

    it("removes schema prose but preserves validation constraints for the Groq token budget", () => {
      const translated = translateToolsToGroq([{
        ...VOLTAGE_TOOL,
        parameters: {
          type: "object",
          properties: {
            samples: { type: "integer", minimum: 1, maximum: 10, description: "Sample count" },
          },
          required: ["samples"],
          additionalProperties: false,
        },
      }]);

      expect(translated[0].function.parameters).toEqual({
        type: "object",
        properties: { samples: { type: "integer", minimum: 1, maximum: 10 } },
        required: ["samples"],
        additionalProperties: false,
      });
    });
  });

  describe("parseGroqToolCalls", () => {
    it("parses valid tool calls strictly", () => {
      const toolCalls = [
        {
          id: "call_abc123",
          type: "function" as const,
          function: {
            name: "measure_supply_voltage",
            arguments: '{"probe":"3V3"}',
          },
        },
      ];

      const parsed = parseGroqToolCalls(toolCalls);
      expect(parsed).toEqual([
        {
          id: "call_abc123",
          name: "measure_supply_voltage",
          arguments: { probe: "3V3" },
        },
      ]);
    });

    it("throws on malformed JSON arguments", () => {
      const toolCalls = [
        {
          id: "call_bad",
          type: "function" as const,
          function: {
            name: "measure_supply_voltage",
            arguments: "{not-valid-json}",
          },
        },
      ];

      expect(() => parseGroqToolCalls(toolCalls)).toThrow(
        "Groq returned unparseable JSON arguments for tool 'measure_supply_voltage'."
      );
    });

    it("throws on non-object arguments (e.g. array or primitive)", () => {
      const toolCalls = [
        {
          id: "call_bad",
          type: "function" as const,
          function: {
            name: "measure_supply_voltage",
            arguments: "[1, 2, 3]",
          },
        },
      ];

      expect(() => parseGroqToolCalls(toolCalls)).toThrow(
        "Groq returned non-object arguments for tool 'measure_supply_voltage'."
      );
    });
  });

  describe("compactTranscriptItem", () => {
    it("leaves user and assistant items unchanged", () => {
      const userItem: AgentTranscriptItem = { role: "user", content: "Short goal" };
      expect(compactTranscriptItem(userItem)).toEqual(userItem);
    });

    it("compacts overly large tool result items", () => {
      const largeContent = "A".repeat(5000);
      const toolItem: AgentTranscriptItem = {
        role: "tool",
        callId: "call_1",
        name: "test_tool",
        content: largeContent,
      };

      const compacted = compactTranscriptItem(toolItem);
      expect(compacted.content?.length).toBeLessThan(2000);
      expect(compacted.content).toContain("[TRUNCATED FOR TOKEN CONTROL]");
    });
  });

  describe("buildGroqMessages", () => {
    it("builds multi-turn message history with system, user, assistant tool calls, and tool results", () => {
      const history: AgentTranscriptItem[] = [
        { role: "user", content: "Diagnose intermittent reset." },
        {
          role: "assistant",
          content: "Let me check the voltage.",
          toolCalls: [
            {
              id: "call_01",
              name: "measure_supply_voltage",
              arguments: {},
            },
          ],
        },
        {
          role: "tool",
          callId: "call_01",
          name: "measure_supply_voltage",
          content: '{"voltage":3.12,"nominal":5.0}',
        },
      ];

      const request: AgentTurnRequest = {
        input: "Next turn",
        tools: [VOLTAGE_TOOL],
        history,
      };

      const messages = buildGroqMessages("Custom system instruction", request);
      expect(messages).toEqual([
        { role: "system", content: "Custom system instruction" },
        { role: "user", content: "Diagnose intermittent reset." },
        {
          role: "assistant",
          content: "Let me check the voltage.",
          tool_calls: [
            {
              id: "call_01",
              type: "function",
              function: {
                name: "measure_supply_voltage",
                arguments: "{}",
              },
            },
          ],
        },
        {
          role: "tool",
          tool_call_id: "call_01",
          name: "measure_supply_voltage",
          content: '{"voltage":3.12,"nominal":5.0}',
        },
      ]);
    });
  });

  describe("turn execution with mocked fetchImpl", () => {
    it("executes a tool call turn and strictly returns AgentTurnResult", async () => {
      const mockFetch: FetchFunction = async (input, init) => {
        expect(init?.method).toBe("POST");
        const body = JSON.parse(init?.body as string);
        expect(body.model).toBe(DEFAULT_GROQ_MODEL);
        expect(body.tools).toBeDefined();
        expect(body.max_completion_tokens).toBe(GROQ_MAX_COMPLETION_TOKENS);

        return new Response(
          JSON.stringify({
            id: "chatcmpl-test-123",
            choices: [
              {
                index: 0,
                message: {
                  role: "assistant",
                  content: "<think>thinking...</think>Measuring voltage now.",
                  tool_calls: [
                    {
                      id: "call_v1",
                      type: "function",
                      function: {
                        name: "measure_supply_voltage",
                        arguments: "{}",
                      },
                    },
                  ],
                },
                finish_reason: "tool_calls",
              },
            ],
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      };

      const provider = new GroqBenchAgentProvider({
        apiKey: TEST_API_KEY,
        fetchImpl: mockFetch,
      });

      const result = await provider.turn({
        input: "Check voltage",
        tools: [VOLTAGE_TOOL],
        history: [{ role: "user", content: "Check voltage" }],
      });

      expect(result.interactionId).toBe("chatcmpl-test-123");
      expect(result.text).toBe("Measuring voltage now.");
      expect(result.functionCalls).toEqual([
        {
          id: "call_v1",
          name: "measure_supply_voltage",
          arguments: {},
        },
      ]);
    });

    it("handles 429 rate limit and raises GroqRateLimitError with retryAfter", async () => {
      const mockFetch: FetchFunction = async () => {
        return new Response(
          JSON.stringify({
            error: {
              message: "Rate limit reached for model openai/gpt-oss-120b in organization org_123 on tokens per minute (TPM).",
              type: "tokens",
            },
          }),
          {
            status: 429,
            headers: {
              "content-type": "application/json",
              "retry-after": "5",
            },
          }
        );
      };

      const provider = new GroqBenchAgentProvider({
        apiKey: TEST_API_KEY,
        fetchImpl: mockFetch,
      });

      let caughtError: unknown;
      try {
        await provider.turn({
          input: "Check voltage",
          tools: [VOLTAGE_TOOL],
        });
      } catch (err) {
        caughtError = err;
      }

      expect(caughtError).toBeInstanceOf(GroqRateLimitError);
      const rateLimitErr = caughtError as GroqRateLimitError;
      expect(rateLimitErr.retryAfterSeconds).toBe(5);
      expect(rateLimitErr.message).toContain("Rate limit reached");
    });
  });

  describe("canary", () => {
    it("returns ok=true when Groq returns 200 and nonempty output", async () => {
      const mockFetch: FetchFunction = async (input, init) => {
        const body = JSON.parse(init?.body as string);
        expect(body.messages[0].content).toBe("Reply exactly OK.");

        return new Response(
          JSON.stringify({
            choices: [
              {
                index: 0,
                message: {
                  role: "assistant",
                  content: "OK",
                },
              },
            ],
          }),
          { status: 200 }
        );
      };

      const provider = new GroqBenchAgentProvider({
        apiKey: TEST_API_KEY,
        fetchImpl: mockFetch,
      });

      const canaryResult = await provider.canary();
      expect(canaryResult.ok).toBe(true);
      expect(canaryResult.message).toBe("OK");
      expect(canaryResult.model).toBe(DEFAULT_GROQ_MODEL);
    });

    it("returns ok=false when Groq returns HTTP error", async () => {
      const mockFetch: FetchFunction = async () => {
        return new Response("Unauthorized", { status: 401 });
      };

      const provider = new GroqBenchAgentProvider({
        apiKey: TEST_API_KEY,
        fetchImpl: mockFetch,
      });

      const canaryResult = await provider.canary();
      expect(canaryResult.ok).toBe(false);
      expect(canaryResult.message).toContain("Canary HTTP 401");
    });
  });
});
