import { GoogleGenAI } from "@google/genai";

import type {
  AgentFunctionCall,
  AgentFunctionResult,
  AgentTranscriptItem,
  AgentTurnRequest,
  AgentTurnResult,
  BenchAgentProvider,
  AgentToolDeclaration,
} from "../../src/infrastructure/bench-agent/types.ts";

export type {
  AgentFunctionCall,
  AgentFunctionResult,
  AgentTranscriptItem,
  AgentTurnRequest,
  AgentTurnResult,
  BenchAgentProvider,
  AgentToolDeclaration,
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

export function sanitizeErrorMessage(error: unknown): string {
  if (!error) return "Unknown error";
  let message = error instanceof Error ? error.message : String(error);
  // Redact any Google API keys (AIza...)
  message = message.replace(/AIza[0-9A-Za-z-_]{35}/g, "[REDACTED_API_KEY]");
  // Redact any auth tokens or secrets
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

export const BENCH_AGENT_SYSTEM_INSTRUCTION = `You are Ohmni's diagnostic bench agent.
Your mission is to find hardware faults, test hypotheses, and verify repairs on the connected board using the provided WebMCP diagnostic instruments.

Standard Investigation Workflow:
1. Baseline Inspection: Call read_reset_history and measure_supply_voltage to observe reboot reasons and baseline voltage.
2. Active Fault Reproduction: If the reported symptom involves restarts during fan or load operation, actively reproduce the fault by calling run_relay_stress_test. This stress-tests the supply rail under coil inrush load. Note: the browser automatically interlocks this tool with an Amber Safety Gate for human approval.
3. Causal Hypothesis: When the stress test reproduces a brownout reset or voltage sag, immediately register a root cause hypothesis by calling propose_hypothesis citing the empirical evidence.
4. Physical Repair Guidance: When your diagnosis identifies a hardware fault requiring physical changes, request human assistance by calling request_human_intervention with your recommended repair action derived from the evidence.
5. Empirical Verification: When the human technician reports the physical change is complete, re-run the relevant stress test to empirically prove the fault no longer manifests under identical load conditions.
6. Confirmation: Once the retest succeeds with stable voltage, call confirm_hypothesis to verify the repair.

Core Rules:
- Never conclude without empirical measurement.
- Always use run_relay_stress_test to reproduce and verify relay/fan power faults.
- Keep tool calls focused, calling one primary diagnostic instrument at a time.`;

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
