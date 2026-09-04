/**
 * Agent Identity & Presentation Abstraction.
 *
 * Terminology:
 * - External agent: Primary bring-your-own-agent flow via WebMCP.
 * - Demo agent: Deterministic walkthrough for demonstration and testing.
 */

import type { AgentMode } from "@/infrastructure/bench-agent/types";

export interface AgentIdentity {
  readonly id: "external" | "demo";
  readonly displayName: string;
  readonly shortName: string;
  readonly model?: string;
  readonly mode: AgentMode;
  readonly isDeterministic: boolean;
  readonly isBlind: boolean;
}

export function getAgentIdentity(
  mode: AgentMode = "external",
  _liveProvider?: string,
  _liveModel?: string
): AgentIdentity {
  if (mode === "demo") {
    return {
      id: "demo",
      displayName: "Demo agent",
      shortName: "Demo",
      model: "Deterministic walkthrough",
      mode: "demo",
      isDeterministic: true,
      isBlind: false,
    };
  }

  return {
    id: "external",
    displayName: "External agent",
    shortName: "External",
    model: "WebMCP compatible",
    mode: "external",
    isDeterministic: false,
    isBlind: true,
  };
}
