/**
 * Milestone 15 — Demo Mode Truth & Honest Fallback Presentation Test.
 *
 * Verifies:
 * 1. Demo Mode NEVER claims to be a blind AI or that it does not know the answer.
 * 2. Demo Mode displays the persistent badge "DEMO AGENT • Deterministic walkthrough".
 * 3. ZERO occurrences of "Gemini" or "Groq" when agent=demo.
 * 4. MysteryIntroModal in Demo mode renders "DETERMINISTIC WEBMCP WALKTHROUGH"
 *    and zero dev scenario leaks (DEV MODE: brownout).
 */

import React from "react";
import { describe, expect, it } from "bun:test";
import { renderToString } from "react-dom/server";
import { MysteryIntroModal } from "@/presentation/components/mystery/MysteryIntroModal";
import { InvestigationNarrativeRail } from "@/presentation/components/investigation-story/InvestigationNarrativeRail";
import { TopBar } from "@/presentation/components/layout/TopBar";
import { InvestigationStoryView } from "@/presentation/components/investigation-story/InvestigationStoryView";
import { TelemetryRingBuffer } from "@/domain/telemetry/ring-buffer";
import { createScenarioSession } from "@/domain/scenario";
import type { BenchAgentState } from "@/presentation/hooks/useBenchAgent";

describe("Milestone 15 — Demo Mode Truth Invariant", () => {
  const session = createScenarioSession({ scenarioId: "brownout" });

  it("MysteryIntroModal in demo mode renders deterministic walkthrough and zero false blind claims", () => {
    const html = renderToString(
      <MysteryIntroModal
        session={session}
        agentMode="demo"
        onBegin={() => undefined}
      />
    );

    // 1. Must explicitly state it is a deterministic walkthrough
    expect(html).toContain("DETERMINISTIC WEBMCP WALKTHROUGH");
    expect(html).toContain("DEMO AGENT • WALKTHROUGH");
    expect(html).toContain("without external AI inference");

    // 2. Must NOT claim blind challenge or unknown answer
    expect(html.toLowerCase()).not.toContain("blind hardware challenge");
    expect(html.toLowerCase()).not.toContain("does not know the answer");
    expect(html.toLowerCase()).not.toContain("gemini");
    expect(html.toLowerCase()).not.toContain("groq");

    // 3. Must NOT leak dev mode or scenario ID in user-facing UI
    expect(html).not.toContain("DEV MODE");
    expect(html).not.toContain("DEV MODE: brownout");
  });

  it("InvestigationNarrativeRail in demo mode displays Demo Agent and zero Gemini/Groq references", () => {
    const agentState: BenchAgentState = {
      status: "idle",
      checkingAvailability: false,
      agentMode: "demo",
      goal: "Investigate brownout fault",
      activity: [],
      providerAvailable: true,
      providerStatus: "demo",
    };

    const html = renderToString(
      <InvestigationNarrativeRail
        agentState={agentState}
        investigationPhase="ready"
        onSetGoal={() => undefined}
        onStartAgent={() => undefined}
        onStopAgent={() => undefined}
      />
    );

    expect(html).toContain("Demo Agent");
    expect(html.toLowerCase()).not.toContain("gemini");
    expect(html.toLowerCase()).not.toContain("groq");
  });

  it("InvestigationStoryView in demo mode renders persistent DEMO AGENT badge and zero Gemini", () => {
    const ringBuffer = new TelemetryRingBuffer(100);
    const ringBufferRef = { current: ringBuffer };
    const markersRef = { current: [] };

    const agentState: BenchAgentState = {
      status: "idle",
      checkingAvailability: false,
      agentMode: "demo",
      goal: "Investigate brownout fault",
      activity: [],
      providerAvailable: true,
      providerStatus: "demo",
    };

    const html = renderToString(
      <InvestigationStoryView
        isConnected={true}
        descriptor={null}
        relayState="open"
        resetCount={0}
        railVoltage={3.31}
        experimentStatus="idle"
        ringBufferRef={ringBufferRef}
        markersRef={markersRef}
        evidenceRecords={[]}
        hypothesis={null}
        agentState={agentState}
        agentMode="demo"
        activeScenario={session}
        onSetGoal={() => undefined}
        onStartAgent={() => undefined}
        onStopAgent={() => undefined}
        onApproveTest={() => undefined}
        onDenyTest={() => undefined}
        onToggleConnect={() => undefined}
      />
    );

    // Must clearly label DEMO AGENT and Deterministic walkthrough
    expect(html).toContain("DEMO AGENT");
    expect(html).toContain("Deterministic walkthrough");
    expect(html.toLowerCase()).not.toContain("gemini");
  });
});
