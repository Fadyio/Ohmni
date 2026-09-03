/**
 * WebMCP Tool Execution Coordinator.
 * Intercepts tool calls at the WebMCP layer so that:
 * 1. Amber (physical actuation) tools pause for human approval via ToolApprovalGate
 *    regardless of caller (external WebMCP agent, Groq, deterministic walkthrough).
 * 2. Every tool invocation is truthfully recorded in the InvestigationToolLedger.
 * 3. Human intervention requests trigger the physical intervention workflow.
 * 4. Safe abort and cancellation are observed without side effects.
 */

import { ToolApprovalGate } from "@/domain/safety/approval-gate";
import { InvestigationToolLedger } from "@/domain/investigation/tool-ledger";
import { requiresHumanApproval } from "@/domain/safety/tool-safety-policy";
import type {
  ModelContextTool,
  ModelContextExecuteToolOptions,
} from "./types";

export interface HumanInterventionDetails {
  readonly target: string;
  readonly instruction: string;
  readonly rationale: string;
  readonly evidenceIds?: readonly string[];
}

export interface WebMCPExecutionCoordinatorOptions {
  readonly approvalGate?: ToolApprovalGate;
  readonly toolLedger?: InvestigationToolLedger;
  readonly onHumanInterventionRequested?: (details: HumanInterventionDetails) => void;
}

export class WebMCPExecutionCoordinator {
  public readonly approvalGate: ToolApprovalGate;
  public readonly toolLedger: InvestigationToolLedger;
  private readonly interventionListeners: Set<(details: HumanInterventionDetails) => void> = new Set();
  private readonly wrappedTools = new WeakMap<ModelContextTool, ModelContextTool>();
  private readonly coordinatedExecutions = new WeakMap<
    ModelContextTool,
    (
      input: Record<string, unknown>,
      options?: ModelContextExecuteToolOptions
    ) => Promise<unknown>
  >();

  constructor(options: WebMCPExecutionCoordinatorOptions = {}) {
    this.approvalGate = options.approvalGate ?? new ToolApprovalGate();
    this.toolLedger = options.toolLedger ?? new InvestigationToolLedger();
    if (options.onHumanInterventionRequested) {
      this.interventionListeners.add(options.onHumanInterventionRequested);
    }
  }

  public onHumanInterventionRequested(
    listener: (details: HumanInterventionDetails) => void
  ): () => void {
    this.interventionListeners.add(listener);
    return () => {
      this.interventionListeners.delete(listener);
    };
  }

  public notifyHumanIntervention(details: HumanInterventionDetails): void {
    for (const listener of this.interventionListeners) {
      try {
        listener(details);
      } catch (err) {
        console.error("[WebMCPExecutionCoordinator] Intervention listener error:", err);
      }
    }
  }

  /**
   * Wraps a registered callback once. Both native WebMCP execution and the
   * compatibility executeTool surface enter the coordinated execution below.
   */
  public wrapTool(tool: ModelContextTool): ModelContextTool {
    const existing = this.wrappedTools.get(tool);
    if (existing) return existing;

    const originalExecute = tool.execute.bind(tool);
    const needsApproval = requiresHumanApproval(tool.name, tool.annotations);
    const coordinatedExecute = async (
      input: Record<string, unknown>,
      options?: ModelContextExecuteToolOptions
    ): Promise<unknown> => {
      const startTime = Date.now();
      const origin = options?.origin ?? "external";
      const entryId = this.toolLedger.recordStart(tool.name, input, origin);

      try {
        if (options?.signal?.aborted) {
          throw new DOMException("Tool execution aborted by caller", "AbortError");
        }

        if (needsApproval && (origin === "external" || !options?.preApproved)) {
          this.toolLedger.recordWaitingApproval(entryId);
          const cycles = typeof input.cycles === "number" ? input.cycles : 3;
          const durationMs = typeof input.duration_ms === "number" ? input.duration_ms : 50;
          const decision = await this.approvalGate.requestApproval(
            {
              toolName: tool.name,
              toolTitle: tool.title ?? tool.name,
              input,
              why:
                tool.name === "run_relay_stress_test"
                  ? "Test whether relay load collapses MCU power rail."
                  : "Tool requires operator authorization before physical actuation.",
              whatWillHappen:
                tool.name === "run_relay_stress_test"
                  ? `Energize virtual relay load for up to ${cycles * durationMs} ms while sampling supply voltage.`
                  : "Execute hardware actuation.",
              safetyLimits:
                "Max 500 ms per cycle, auto-abort on brownout, relay always returns to safe open state.",
            },
            options?.signal
          );

          if (!decision.approved) {
            const denialResult = {
              status: "DENIED",
              error: decision.reason ?? "Human operator denied authorization.",
              message: "Operator denied authorization to execute physical actuation.",
            };
            this.toolLedger.recordDenied(entryId, denialResult, Date.now() - startTime);
            return denialResult;
          }
        }

        if (options?.signal?.aborted) {
          throw new DOMException("Tool execution aborted by caller", "AbortError");
        }

        this.toolLedger.recordRunning(entryId);
        const result = await originalExecute(input, { signal: options?.signal });
        this.toolLedger.recordCompleted(entryId, result, Date.now() - startTime);

        if (tool.name === "request_human_intervention") {
          const rawEvidenceIds = input.evidence_ids;
          const evidenceIds = Array.isArray(rawEvidenceIds)
            ? rawEvidenceIds.filter(
                (evidenceId): evidenceId is string => typeof evidenceId === "string"
              )
            : undefined;
          this.notifyHumanIntervention({
            target: String(input.target ?? "hardware"),
            instruction: String(input.instruction ?? ""),
            rationale: String(input.rationale ?? ""),
            evidenceIds,
          });
        }

        return result;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        this.toolLedger.recordFailed(entryId, errorMessage, Date.now() - startTime);
        throw error;
      }
    };

    const wrappedTool: ModelContextTool = {
      name: tool.name,
      title: tool.title,
      description: tool.description,
      inputSchema: tool.inputSchema,
      annotations: tool.annotations,
      execute: (input, options) =>
        coordinatedExecute(input, {
          signal: options?.signal,
          origin: "external",
        }),
    };

    this.wrappedTools.set(tool, wrappedTool);
    this.wrappedTools.set(wrappedTool, wrappedTool);
    this.coordinatedExecutions.set(wrappedTool, coordinatedExecute);
    return wrappedTool;
  }

  public executeTool(
    tool: ModelContextTool,
    input: Record<string, unknown>,
    options?: ModelContextExecuteToolOptions
  ): Promise<unknown> {
    const wrappedTool = this.wrapTool(tool);
    const execute = this.coordinatedExecutions.get(wrappedTool);
    if (!execute) {
      throw new Error(`Missing coordinated execution for registered tool '${tool.name}'`);
    }
    return execute(input, options);
  }
}
