/**
 * Tool Safety Policy & Execution Classification.
 * Milestone 7.14 — Truthful State Machine & Safety Interlock.
 *
 * Disambiguates software investigation mutations ("reason") from
 * hazardous physical hardware actuations ("physical") and read-only queries ("observe").
 *
 * Invariants:
 * 1. "observe": Read-only inspection & telemetry queries. Executes automatically.
 * 2. "reason": Software hypothesis, evidence linkage & diagnostic conclusions. Executes automatically.
 * 3. "physical": Controlled physical actuation & hardware intervention. Requires Amber human approval.
 * 4. Safe Failure: Any unknown non-read-only tool defaults to "physical" requiring approval.
 */

export type ToolExecutionClass = "observe" | "reason" | "physical";

export interface ToolAnnotationsHint {
  readonly readOnlyHint?: boolean;
  readonly untrustedContentHint?: boolean;
}

export interface ToolSafetyPolicy {
  classify(toolName: string, annotations?: ToolAnnotationsHint): ToolExecutionClass;
  requiresHumanApproval(toolName: string, annotations?: ToolAnnotationsHint): boolean;
}

const KNOWN_OBSERVE_TOOLS = new Set<string>([
  "read_device_info",
  "read_reset_history",
  "read_system_health",
  "measure_supply_voltage",
  "scan_i2c_bus",
  "list_evidence",
  "get_evidence",
  "list_hypotheses",
  "get_hypothesis",
]);

const KNOWN_REASON_TOOLS = new Set<string>([
  "propose_hypothesis",
  "update_hypothesis",
  "link_evidence",
  "reject_hypothesis",
  "confirm_hypothesis",
  "record_conclusion",
]);

const KNOWN_PHYSICAL_TOOLS = new Set<string>([
  "run_relay_stress_test",
  "request_human_intervention",
]);

export class DefaultToolSafetyPolicy implements ToolSafetyPolicy {
  public classify(toolName: string, annotations?: ToolAnnotationsHint): ToolExecutionClass {
    const normalized = toolName.trim();

    // 1. Explicit reason tools (hypothesis synthesis, evidence links, conclusions)
    if (KNOWN_REASON_TOOLS.has(normalized)) {
      return "reason";
    }

    // 2. Explicit observe tools
    if (KNOWN_OBSERVE_TOOLS.has(normalized)) {
      return "observe";
    }

    // 3. Explicit physical actuation tools
    if (KNOWN_PHYSICAL_TOOLS.has(normalized)) {
      return "physical";
    }

    // 4. Annotated read-only tools
    if (annotations?.readOnlyHint === true) {
      return "observe";
    }

    // 5. Safe Failure: Unknown non-read-only tool requires physical authorization
    return "physical";
  }

  public requiresHumanApproval(toolName: string, annotations?: ToolAnnotationsHint): boolean {
    const executionClass = this.classify(toolName, annotations);
    return executionClass === "physical";
  }
}

export const defaultToolSafetyPolicy = new DefaultToolSafetyPolicy();

export function classifyTool(toolName: string, annotations?: ToolAnnotationsHint): ToolExecutionClass {
  return defaultToolSafetyPolicy.classify(toolName, annotations);
}

export function requiresHumanApproval(toolName: string, annotations?: ToolAnnotationsHint): boolean {
  return defaultToolSafetyPolicy.requiresHumanApproval(toolName, annotations);
}
