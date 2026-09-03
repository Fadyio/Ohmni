/**
 * Agent Identity & Provider Presentation Abstraction.
 * OHMNI Product Truth Milestone — Eliminates hardcoded provider identity.
 */

import type { AgentMode } from "@/infrastructure/bench-agent/types";

export interface AgentIdentity {
  readonly id: "groq" | "demo";
  readonly displayName: string;
  readonly shortName: string;
  readonly model?: string;
  readonly mode: "groq" | "demo";
  readonly isDeterministic: boolean;
  readonly isBlind: boolean;
}

export function getAgentIdentity(
  mode: AgentMode = "groq",
  liveProvider?: string,
  liveModel?: string
): AgentIdentity {
  if (mode === "demo") {
    return {
      id: "demo",
      displayName: "Demo Agent",
      shortName: "Demo Agent",
      model: "Deterministic walkthrough",
      mode: "demo",
      isDeterministic: true,
      isBlind: false,
    };
  }
  return {
    id: "groq",
    displayName: "Groq",
    shortName: "Groq",
    model: liveModel ?? "openai/gpt-oss-120b",
    mode: "groq",
    isDeterministic: false,
    isBlind: true,
  };
}
