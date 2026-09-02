import { GoogleGenAI } from "@google/genai";

import type {
  AgentFunctionCall,
  AgentFunctionResult,
  AgentTurnRequest,
  AgentTurnResult,
  BenchAgentProvider,
  GeminiFunctionDeclaration,
} from "../../src/infrastructure/bench-agent/types.ts";

export type {
  AgentFunctionCall,
  AgentFunctionResult,
  AgentTurnRequest,
  AgentTurnResult,
  BenchAgentProvider,
  GeminiFunctionDeclaration,
};

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

export interface GeminiBenchAgentProviderOptions {
  readonly apiKey: string;
  readonly model?: string;
  readonly interactions?: InteractionsClient;
}

export const DEFAULT_GEMINI_MODEL = "gemini-3.7-flash";
export const GEMINI_REQUEST_TIMEOUT_MS = 30_000;

export const BENCH_AGENT_SYSTEM_INSTRUCTION = `You are Ohmni's diagnostic bench agent.

Investigate hardware failures empirically.

Use available WebMCP instruments rather than guessing.

Distinguish observations from hypotheses.

Use evidence tools to inspect factual records.

Create or update hypotheses only when supported by evidence.

Do not claim a root cause is verified until the workbench contains a successful verification experiment.

When a human reports a physical repair, do not claim it succeeded. Use available diagnostic instruments to empirically verify the change.

After a verification experiment succeeds and you inspect the new empirical evidence records, call confirm_hypothesis with the verified experiment ID and supporting evidence IDs to formally verify the hypothesis.

Do not invent hardware capabilities.

If a required physical action cannot be performed with available tools, explain what human action is needed.

Prefer the smallest informative next experiment.`;

function publicFunctionCalls(
  steps: readonly Record<string, unknown>[] | undefined,
): AgentFunctionCall[] {
  if (steps === undefined) {
    return [];
  }

  const calls: AgentFunctionCall[] = [];
  for (const step of steps) {
    if (
      step.type === "function_call" &&
      typeof step.id === "string" &&
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

export class GeminiBenchAgentProvider implements BenchAgentProvider {
  private readonly model: string;
  private readonly interactions: InteractionsClient;

  constructor(options: GeminiBenchAgentProviderOptions) {
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
}
