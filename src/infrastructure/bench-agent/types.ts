import type {
  ModelContext,
  RegisteredTool,
} from "@/infrastructure/webmcp/types";

export interface GeminiFunctionDeclaration {
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
  readonly result: readonly { readonly type: "text"; readonly text: string }[];
  readonly is_error?: boolean;
}

export interface AgentTurnRequest {
  readonly input: string | readonly AgentFunctionResult[];
  readonly tools: readonly GeminiFunctionDeclaration[];
  readonly previousInteractionId?: string;
}

export interface AgentTurnResult {
  readonly interactionId: string;
  readonly functionCalls: readonly AgentFunctionCall[];
  readonly text?: string;
}

export type AgentMode = "gemini" | "demo";

export interface BenchAgentProvider {
  turn(
    request: AgentTurnRequest,
    options?: { signal?: AbortSignal }
  ): Promise<AgentTurnResult>;
  canary?(options?: { signal?: AbortSignal }): Promise<{
    readonly ok: boolean;
    readonly message: string;
    readonly model: string;
  }>;
}

export type BenchAgentEvent =
  | {
      readonly type: "tool-requested";
      readonly call: AgentFunctionCall;
    }
  | {
      readonly type: "approval-requested";
      readonly call: AgentFunctionCall;
      readonly tool: RegisteredTool;
    }
  | {
      readonly type: "tool-completed";
      readonly call: AgentFunctionCall;
      readonly result: string;
      readonly durationMs: number;
    }
  | {
      readonly type: "tool-unavailable";
      readonly call: AgentFunctionCall;
      readonly message: string;
    }
  | {
      readonly type: "tool-denied";
      readonly call: AgentFunctionCall;
      readonly message: string;
    }
  | {
      readonly type: "tool-failed";
      readonly call: AgentFunctionCall;
      readonly message: string;
      readonly durationMs: number;
    };

export type BenchAgentRunResult =
  | {
      readonly status: "completed";
      readonly steps: number;
      readonly text: string;
      readonly interactionId?: string;
    }
  | {
      readonly status: "stopped";
      readonly steps: number;
      readonly interactionId?: string;
    }
  | {
      readonly status: "step-limit";
      readonly steps: number;
      readonly interactionId?: string;
    }
  | {
      readonly status: "failed";
      readonly steps: number;
      readonly message: string;
      readonly requestId?: string;
      readonly interactionId?: string;
    };

export interface BenchAgentApprovalRequest {
  readonly call: AgentFunctionCall;
  readonly tool: RegisteredTool;
}

export interface RunBenchAgentOptions {
  readonly goal: string;
  readonly modelContext: ModelContext;
  readonly provider: BenchAgentProvider;
  readonly requestApproval: (
    request: BenchAgentApprovalRequest
  ) => Promise<boolean>;
  readonly onEvent?: (event: BenchAgentEvent) => void;
  readonly signal?: AbortSignal;
  readonly maxSteps?: number;
  readonly previousInteractionId?: string;
}

export interface BenchAgentAvailability {
  readonly available: boolean;
  readonly model: string;
}
