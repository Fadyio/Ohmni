import { describe, expect, it } from "bun:test";
import {
  GeminiBenchAgentProvider,
  BENCH_AGENT_SYSTEM_INSTRUCTION as SYSTEM_INSTRUCTION,
} from "../../server/bench-agent/gemini-provider";

const API_KEY = "server-only-gemini-secret";
const DEFAULT_MODEL = "gemini-3.7-flash";
const REQUEST_TIMEOUT_MS = 30_000;

const VOLTAGE_TOOL = {
  type: "function" as const,
  name: "measure_supply_voltage",
  description: "Measure the current supply voltage.",
  parameters: {
    type: "object",
    properties: {
      rail: { type: "string" },
    },
    required: ["rail"],
    additionalProperties: false,
  },
};

const RESET_TOOL = {
  type: "function" as const,
  name: "read_reset_history",
  description: "Read the device reset history.",
  parameters: {
    type: "object",
    properties: {},
    additionalProperties: false,
  },
};

interface FakeInteraction {
  id: string;
  steps?: Array<Record<string, unknown>>;
  output_text?: string;
}

interface RecordedCreateCall {
  request: Record<string, unknown>;
  options?: {
    timeout_ms?: number;
    signal?: AbortSignal | null;
  };
}

function recordingInteractions(responses: FakeInteraction[]): {
  interactions: {
    create(
      request: Record<string, unknown>,
      options?: RecordedCreateCall["options"],
    ): Promise<FakeInteraction>;
  };
  calls: RecordedCreateCall[];
} {
  const queue = [...responses];
  const calls: RecordedCreateCall[] = [];
  const interactions = {
    async create(
      request: Record<string, unknown>,
      options?: RecordedCreateCall["options"],
    ): Promise<FakeInteraction> {
      calls.push({ request, options });
      const response = queue.shift();
      if (response === undefined) {
        throw new Error("Unexpected Interactions API create call");
      }
      return response;
    },
  };

  return { interactions, calls };
}

describe("GeminiBenchAgentProvider", () => {
  it("uses the constructor-selected default or explicit model", async () => {
    const defaultFake = recordingInteractions([{ id: "default-turn", steps: [] }]);
    const explicitFake = recordingInteractions([{ id: "explicit-turn", steps: [] }]);
    const defaultProvider = new GeminiBenchAgentProvider({
      apiKey: API_KEY,
      interactions: defaultFake.interactions,
    });
    const explicitProvider = new GeminiBenchAgentProvider({
      apiKey: API_KEY,
      model: "gemini-custom-model",
      interactions: explicitFake.interactions,
    });

    await defaultProvider.turn({ input: "Inspect the board.", tools: [] });
    await explicitProvider.turn({ input: "Inspect the board.", tools: [] });

    expect(defaultFake.calls[0]?.request.model).toBe(DEFAULT_MODEL);
    expect(explicitFake.calls[0]?.request.model).toBe("gemini-custom-model");
  });

  it("sends interaction-scoped configuration on every turn and preserves continuation input", async () => {
    const fake = recordingInteractions([
      { id: "interaction-1", steps: [] },
      { id: "interaction-2", steps: [] },
    ]);
    const provider = new GeminiBenchAgentProvider({
      apiKey: API_KEY,
      model: "gemini-test-model",
      interactions: fake.interactions,
    });
    const controller = new AbortController();
    const functionResults = [
      {
        type: "function_result" as const,
        name: "measure_supply_voltage",
        call_id: "function-call-id::exact-7",
        result: [{ type: "text" as const, text: '{"volts":3.18}' }],
        is_error: false,
      },
    ];

    await provider.turn(
      {
        input: "Diagnose intermittent resets.",
        tools: [VOLTAGE_TOOL],
      },
      { signal: controller.signal },
    );
    await provider.turn(
      {
        input: functionResults,
        tools: [VOLTAGE_TOOL, RESET_TOOL],
        previousInteractionId: "interaction-1",
      },
      { signal: controller.signal },
    );

    expect(fake.calls.map(({ request }) => request)).toEqual([
      {
        model: "gemini-test-model",
        input: "Diagnose intermittent resets.",
        system_instruction: SYSTEM_INSTRUCTION,
        tools: [VOLTAGE_TOOL],
        generation_config: { thinking_level: "medium" },
        store: true,
      },
      {
        model: "gemini-test-model",
        input: functionResults,
        system_instruction: SYSTEM_INSTRUCTION,
        tools: [VOLTAGE_TOOL, RESET_TOOL],
        generation_config: { thinking_level: "medium" },
        store: true,
        previous_interaction_id: "interaction-1",
      },
    ]);
    expect(fake.calls.map(({ options }) => options)).toEqual([
      { timeout_ms: REQUEST_TIMEOUT_MS, signal: controller.signal },
      { timeout_ms: REQUEST_TIMEOUT_MS, signal: controller.signal },
    ]);
    expect(fake.calls[1]?.request.input).toEqual(functionResults);
    expect(
      (fake.calls[1]?.request.input as typeof functionResults)[0]?.call_id,
    ).toBe("function-call-id::exact-7");
    expect("generateContent" in fake.interactions).toBe(false);
  });

  it("maps public response fields and omits thought or private-reasoning steps", async () => {
    const privateReasoning = "PRIVATE: infer an unobserved short circuit";
    const firstArguments = { rail: "3v3", samples: 8 };
    const secondArguments = { limit: 4 };
    const fake = recordingInteractions([
      {
        id: "interaction-response-42",
        output_text: "The measured rail is below tolerance.",
        steps: [
          {
            type: "thought",
            id: "thought-1",
            content: privateReasoning,
          },
          {
            type: "function_call",
            id: "call-voltage-17",
            name: "measure_supply_voltage",
            arguments: firstArguments,
          },
          {
            type: "reasoning",
            id: "reasoning-2",
            summary: privateReasoning,
          },
          {
            type: "function_call",
            id: "call-reset-23",
            name: "read_reset_history",
            arguments: secondArguments,
          },
        ],
      },
    ]);
    const provider = new GeminiBenchAgentProvider({
      apiKey: API_KEY,
      interactions: fake.interactions,
    });

    const result = await provider.turn({
      input: "Continue the diagnosis.",
      tools: [VOLTAGE_TOOL, RESET_TOOL],
    });

    expect(result).toEqual({
      interactionId: "interaction-response-42",
      functionCalls: [
        {
          id: "call-voltage-17",
          name: "measure_supply_voltage",
          arguments: firstArguments,
        },
        {
          id: "call-reset-23",
          name: "read_reset_history",
          arguments: secondArguments,
        },
      ],
      text: "The measured rail is below tolerance.",
    });
    expect(JSON.stringify(result)).not.toContain(privateReasoning);
    expect("generateContent" in fake.interactions).toBe(false);
  });
});
