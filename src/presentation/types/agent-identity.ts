/**
 * Agent Identity & Provider Presentation Abstraction.
 * OHMNI Product Truth Milestone — Eliminates hardcoded provider identity.
 *
 * Terminology:
 * - External agent: Preferred bring-your-own-agent flow via WebMCP.
 * - Built-in agent • Groq: Optional serverless demo agent fallback.
 * - Demo agent: Deterministic walkthrough for automated testing and offline demos.
 */

import type { AgentMode } from "@/infrastructure/bench-agent/types";

export interface AgentIdentity {
  readonly id: "external" | "groq" | "demo";
  readonly displayName: string;
  readonly shortName: string;
  readonly model?: string;
  readonly mode: AgentMode;
  readonly isDeterministic: boolean;
  readonly isBlind: boolean;
}

export function getAgentIdentity(
  mode: AgentMode = "external",
  liveProvider?: string,
  liveModel?: string
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

  if (mode === "groq") {
    const providerName = liveProvider
      ? liveProvider.charAt(0).toUpperCase() + liveProvider.slice(1)
      : "Groq";
    return {
      id: "groq",
      displayName: `Built-in agent • ${providerName}`,
      shortName: providerName,
      model: liveModel ?? "openai/gpt-oss-120b",
      mode: "groq",
      isDeterministic: false,
      isBlind: true,
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
