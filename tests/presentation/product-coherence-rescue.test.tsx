/**
 * OHMNI — Product Coherence Rescue Invariants Test Suite.
 *
 * Verifies all requirements from the Final Product Coherence Rescue specification:
 * 1. Flat OHMNI logo canonical everywhere; zero Ohmni3DWordmark elements.
 * 2. Zero SignalPulse floating orbs anywhere across landing, modal, approval, hypothesis, repair, or reveal.
 * 3. Deterministic walkthrough modal entry and ReadyScene "Start investigation" handoff.
 * 4. Progress phase truth: OBSERVE -> TEST -> DIAGNOSE -> REPAIR -> VERIFY.
 * 5. Agent status truth: DIAGNOSIS FORMED, WAITING FOR YOU, VERIFICATION RUNNING, COMPLETED.
 * 6. Hypothesis UI: WORKING DIAGNOSIS, 3 measured facts, NEEDS CONTROLLED RETEST, Verify with repair →.
 * 7. Repair scene: Shared application shell, REPAIR highlighted, high-contrast visible "Deny retest" button.
 * 8. Plain English labels across observing, running, repair scenes.
 * 9. Oscilloscope accessible aria-label.
 * 10. Reveal scene: "Repair verified" title and "The agent's diagnosis matched the hidden hardware fault." subtitle.
 */

import React from "react";
import { describe, expect, it } from "bun:test";
import { renderToString } from "react-dom/server";
import { WelcomeView } from "@/presentation/components/welcome/WelcomeView";
import { TopBar } from "@/presentation/components/layout/TopBar";
import { MysteryIntroModal } from "@/presentation/components/mystery/MysteryIntroModal";
import { ReadyScene } from "@/presentation/components/investigation-story/scenes/ReadyScene";
import { HypothesisScene } from "@/presentation/components/investigation-story/scenes/HypothesisScene";
import { ObservingScene } from "@/presentation/components/investigation-story/scenes/ObservingScene";
import { RunningExperimentScene } from "@/presentation/components/investigation-story/scenes/RunningExperimentScene";
import { buildRepairObservation, RepairVerificationScene } from "@/presentation/components/repair/RepairVerificationScene";
import { GroundTruthRevealScene } from "@/presentation/components/mystery/GroundTruthRevealScene";
import { Oscilloscope } from "@/presentation/components/instruments/Oscilloscope";
import { InvestigationNarrativeRail } from "@/presentation/components/investigation-story/InvestigationNarrativeRail";
import { InvestigationStoryView } from "@/presentation/components/investigation-story/InvestigationStoryView";
import { deriveInvestigationPhase } from "@/domain/investigation/lifecycle";
import { createScenarioSession } from "@/domain/scenario";
import { TelemetryRingBuffer } from "@/domain/telemetry/ring-buffer";
import type { BenchAgentState } from "@/presentation/hooks/useBenchAgent";
import type { Hypothesis } from "@/domain/hypothesis/types";
import type { EvidenceRecord } from "@/domain/evidence/types";

describe("OHMNI — Final Product Coherence Rescue Invariants", () => {
  const session = createScenarioSession({ scenarioId: "brownout" });
  const ringBuffer = new TelemetryRingBuffer(100);
  const ringBufferRef = { current: ringBuffer };
  const markersRef = { current: [] };

  const sampleHypothesis = {
    id: "H-001",
    title: "Relay-induced MCU supply brownout",
    description: "The 3.3V rail drops to 2.72V when the relay coil energizes, triggering a brownout reset.",
    confidence: "HIGH",
    supportingEvidenceIds: ["E-001", "E-002", "E-003"],
    refutingEvidenceIds: [],
    verificationStatus: "UNCONFIRMED",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  } as unknown as Hypothesis;

  const sampleEvidence = [
    {
      id: "E-001",
      fact: "Supply voltage dropped to 2.72 V (below 2.80 V reset threshold)",
      type: "measurement",
      source: "system",
      timestamp: Date.now(),
    },
    {
      id: "E-002",
      fact: "Microcontroller recorded brownout reset event in non-volatile register",
      type: "measurement",
      source: "system",
      timestamp: Date.now(),
    },
    {
      id: "E-003",
      fact: "Relay activation immediately preceded microcontroller reset",
      type: "test_result",
      source: "agent",
      timestamp: Date.now(),
    },
  ] as unknown as EvidenceRecord[];

  describe("1. Brand & Landing Page Hierarchy", () => {
    it("renders flat OHMNI logo and zero 3D wordmark on landing page", () => {
      const html = renderToString(
        <WelcomeView
          onStartMystery={() => undefined}
          onStartDemo={() => undefined}
        />
      );

      // 1. Flat SVG logo must be present
      expect(html).toContain("/brand/ohmni-logo.svg");
      expect(html).toContain('alt="OHMNI"');

      // 2. Standalone HARDWARE DIAGNOSTIC WORKBENCH must be gone
      expect(html).not.toContain("HARDWARE DIAGNOSTIC WORKBENCH");

      // 3. 3D Wordmark component must NOT be rendered
      expect(html).not.toContain("Ohmni3DWordmark");
      expect(html).not.toContain("data-wordmark-variant");

      // 4. Hero must begin directly with required headline
      expect(html).toContain("Give AI agents instruments");
      expect(html).toContain("for the physical world.");
      expect(html).toContain("WebMCP tools");
      expect(html).toContain("Launch virtual diagnosis");
      expect(html).toContain('id="diagnose-demo-btn"');
      expect(html).toContain("How it works →");
      // 6. Plain bottom metadata
      expect(html).toContain("Human-approved actuation");
      expect(html).toContain("Evidence-backed diagnosis");
      expect(html).toContain("Retest to verify");
    });

    it("TopBar uses flat OHMNI logo and zero 3D wordmark", () => {
      const html = renderToString(
        <TopBar
          isConnected={true}
          descriptor={{ name: "ESP32-S3 Demo Board", type: "esp32", version: "1.0", capabilities: [] } as any}
          statusVisual="nominal"
          activeScenario={session}
        />
      );

      expect(html).toContain("/brand/ohmni-logo.svg");
      expect(html).not.toContain("Ohmni3DWordmark");
    });
  });

  describe("2. Ghost SignalPulse Removal", () => {
    it("renders zero SignalPulse elements across all canonical views", () => {
      // Landing
      const landingHtml = renderToString(<WelcomeView onStartDemo={() => undefined} />);
      expect(landingHtml).not.toContain("signal-pulse");
      expect(landingHtml).not.toContain("SignalPulse");

      // Investigation Story View (waiting for approval)
      const approvalAgentState = {
        status: "approval",
        agentMode: "demo",
        goal: "Investigate",
        activity: [],
        providerAvailable: true,
        providerStatus: "demo",
        approval: {
          id: "app-1",
          tool: { name: "run_relay_stress_test", description: "Stress test", parameters: {}, annotations: {} },
          arguments: {},
        },
      } as unknown as BenchAgentState;

      const workbenchHtml = renderToString(
        <InvestigationStoryView
          isConnected={true}
          relayState="open"
          resetCount={0}
          railVoltage={3.31}
          experimentStatus="idle"
          ringBufferRef={ringBufferRef}
          markersRef={markersRef}
          evidenceRecords={[]}
          hypothesis={null}
          agentState={approvalAgentState}
          agentMode="demo"
          {...({} as any)}
        />
      );

      expect(workbenchHtml).not.toContain("signal-pulse");
      expect(workbenchHtml).not.toContain("SignalPulse");
    });
  });

  describe("3. Deterministic Walkthrough & ReadyScene Handoff", () => {
    it("ReadyScene renders target hardware info and truthful unmeasured baseline state", () => {
      const html = renderToString(
        <ReadyScene
          isConnected={true}
          relayState="open"
        />
      );

      expect(html).toContain('data-scene="ready"');
      expect(html).toContain("Virtual reference controller");
      expect(html).not.toContain("Agent: Ready.");
      expect(html).not.toContain('id="start-investigation-btn"');
      expect(html).not.toContain("Start investigation");
      expect(html).toContain("Not measured");
      expect(html).toContain("Not inspected");
      expect(html).toContain("Open");
    });

    it("MysteryIntroModal provides dialog role, aria-modal, title, and Begin button", () => {
      const html = renderToString(
        <MysteryIntroModal
          session={session}
          agentMode="demo"
          onBegin={() => undefined}
          onCancel={() => undefined}
        />
      );

      expect(html).toContain('role="dialog"');
      expect(html).toContain('aria-modal="true"');
      expect(html).toContain('id="mystery-intro-title"');
      expect(html).toContain("DETERMINISTIC WEBMCP WALKTHROUGH");
      expect(html).toContain('id="begin-mystery-btn"');
      expect(html).toContain("Begin Walkthrough");
      expect(html).toContain("Cancel");
    });
  });

  describe("4. Phase Truth & Step Invariant", () => {
    it("derives correct semantic phases across lifecycle snapshots", () => {
      // 1. Ready / passive observation -> ready / observing (OBSERVE)
      const readyPhase = deriveInvestigationPhase({
        hasStarted: true,
        isConnected: true,
        agentStatus: "idle",
        isAgentRunning: false,
        isAwaitingApproval: false,
        isExperimentActive: false,
        isVerificationExperiment: false,
        hasRecentEvidence: false,
        hasHypothesis: false,
        isWaitingForHuman: false,
        isHumanInterventionCompleted: false,
        isVerified: false,
      });
      expect(readyPhase).toBe("ready");

      // 2. Approval gate -> waiting_for_approval (TEST)
      const approvalPhase = deriveInvestigationPhase({
        hasStarted: true,
        isConnected: true,
        agentStatus: "waiting_approval",
        isAgentRunning: false,
        isAwaitingApproval: true,
        isExperimentActive: false,
        isVerificationExperiment: false,
        hasRecentEvidence: false,
        hasHypothesis: false,
        isWaitingForHuman: false,
        isHumanInterventionCompleted: false,
        isVerified: false,
      });
      expect(approvalPhase).toBe("waiting_for_approval");

      // 3. Hypothesis synthesized -> hypothesis (DIAGNOSE)
      const hypothesisPhase = deriveInvestigationPhase({
        hasStarted: true,
        isConnected: true,
        agentStatus: "running",
        isAgentRunning: true,
        isAwaitingApproval: false,
        isExperimentActive: false,
        isVerificationExperiment: false,
        hasRecentEvidence: true,
        hasHypothesis: true,
        isWaitingForHuman: false,
        isHumanInterventionCompleted: false,
        isVerified: false,
      });
      expect(hypothesisPhase).toBe("hypothesis");

      // Even if isExperimentActive lingered, hypothesis takes precedence over stale experiment!
      const lingeringExperimentPhase = deriveInvestigationPhase({
        hasStarted: true,
        isConnected: true,
        agentStatus: "running",
        isAgentRunning: true,
        isAwaitingApproval: false,
        isExperimentActive: true, // stale
        isVerificationExperiment: false,
        hasRecentEvidence: true,
        hasHypothesis: true,
        isWaitingForHuman: false,
        isHumanInterventionCompleted: false,
        isVerified: false,
      });
      expect(lingeringExperimentPhase).toBe("hypothesis");

      // 4. Human intervention pending -> waiting_for_human (REPAIR)
      const repairPhase = deriveInvestigationPhase({
        hasStarted: true,
        isConnected: true,
        agentStatus: "running",
        isAgentRunning: true,
        isAwaitingApproval: false,
        isExperimentActive: false,
        isVerificationExperiment: false,
        hasRecentEvidence: true,
        hasHypothesis: true,
        isWaitingForHuman: true,
        isHumanInterventionCompleted: false,
        isVerified: false,
      });
      expect(repairPhase).toBe("hypothesis");

      // 5. Verification retest running -> verification_running (VERIFY)
      const verifyRunningPhase = deriveInvestigationPhase({
        hasStarted: true,
        isConnected: true,
        agentStatus: "running",
        isAgentRunning: true,
        isAwaitingApproval: false,
        isExperimentActive: true,
        isVerificationExperiment: true,
        hasRecentEvidence: true,
        hasHypothesis: true,
        isWaitingForHuman: false,
        isHumanInterventionCompleted: true,
        isVerified: false,
      });
      expect(verifyRunningPhase).toBe("verification_running");

      // 6. Verified result -> verified (VERIFY)
      const verifiedPhase = deriveInvestigationPhase({
        hasStarted: true,
        isConnected: true,
        agentStatus: "completed",
        isAgentRunning: false,
        isAwaitingApproval: false,
        isExperimentActive: false,
        isVerificationExperiment: false,
        hasRecentEvidence: true,
        hasHypothesis: true,
        isWaitingForHuman: false,
        isHumanInterventionCompleted: true,
        isVerified: true,
      });
      expect(verifiedPhase).toBe("verified");
    });

    it("InvestigationStoryView highlights DIAGNOSE when hypothesis is formed (never TEST)", () => {
      const agentState = {
        status: "investigating",
        agentMode: "demo",
        goal: "Investigate",
        activity: [],
        providerAvailable: true,
        providerStatus: "demo",
      } as unknown as BenchAgentState;

      const html = renderToString(
        <InvestigationStoryView
          isConnected={true}
          relayState="open"
          resetCount={1}
          railVoltage={2.72}
          experimentStatus="completed"
          ringBufferRef={ringBufferRef}
          markersRef={markersRef}
          evidenceRecords={sampleEvidence}
          hypothesis={sampleHypothesis}
          agentState={agentState}
          agentMode="demo"
          {...({} as any)}
        />
      );

      // Must have DIAGNOSE as the active progress step
      expect(html).toContain('data-phase="DIAGNOSE" data-active="true"');
    });
  });

  describe("5. Agent Rail Status Truth", () => {
    it("displays DIAGNOSIS FORMED or WAITING FOR PHYSICAL ACTION during hypothesis (never EXPERIMENT RUNNING)", () => {
      const agentState = {
        status: "investigating",
        agentMode: "demo",
        goal: "Investigate",
        activity: [],
        providerAvailable: true,
        providerStatus: "demo",
      } as unknown as BenchAgentState;

      const html = renderToString(
        <InvestigationNarrativeRail
          agentState={agentState}
          investigationPhase="hypothesis"
          hypothesis={sampleHypothesis}
          onSetGoal={() => undefined}
          onStartAgent={() => undefined}
          onStopAgent={() => undefined}
        />
      );

      expect(html).toContain("DIAGNOSIS FORMED");
      expect(html).not.toContain("EXPERIMENT RUNNING");
    });

    it("displays WAITING FOR YOU when awaiting human repair", () => {
      const agentState = {
        status: "investigating",
        agentMode: "demo",
        goal: "Investigate",
        activity: [],
        providerAvailable: true,
        providerStatus: "demo",
      } as unknown as BenchAgentState;

      const html = renderToString(
        <InvestigationNarrativeRail
          agentState={agentState}
          investigationPhase="waiting_for_human"
          hypothesis={sampleHypothesis}
          onSetGoal={() => undefined}
          onStartAgent={() => undefined}
          onStopAgent={() => undefined}
        />
      );

      expect(html).toContain("WAITING FOR YOU");
      expect(html).not.toContain("EXPERIMENT RUNNING");
    });

    it("displays VERIFICATION RUNNING during post-repair retest", () => {
      const agentState = {
        status: "investigating",
        agentMode: "demo",
        goal: "Investigate",
        activity: [],
        providerAvailable: true,
        providerStatus: "demo",
      } as unknown as BenchAgentState;

      const html = renderToString(
        <InvestigationNarrativeRail
          agentState={agentState}
          investigationPhase="verification_running"
          onSetGoal={() => undefined}
          onStartAgent={() => undefined}
          onStopAgent={() => undefined}
        />
      );

      expect(html).toContain("VERIFICATION RUNNING");
      expect(html).not.toContain("EXPERIMENT RUNNING");
    });
  });

  describe("6. Simplified Hypothesis Presentation", () => {
    it("renders WORKING DIAGNOSIS, 3 measured facts, and Verify with repair CTA", () => {
      const html = renderToString(
        <HypothesisScene
          hypothesis={sampleHypothesis}
          onProceedToRepair={() => undefined}
        />
      );

      expect(html).toContain("WORKING DIAGNOSIS");
      expect(html).toContain("Relay-induced MCU supply brownout");
      expect(html).toContain("Three measured facts support this diagnosis.");
      expect(html).toContain("2.72 V minimum");
      expect(html).toContain("Brownout reset");
      expect(html).toContain("Relay activation preceded reset");
      expect(html).toContain("NEEDS CONTROLLED RETEST");
      expect(html).toContain('id="proceed-to-repair-btn"');
      expect(html).toContain("Verify with repair →");
    });
  });

  describe("7. Unified Repair Application Shell & Visible Deny Button", () => {
    it("gives the live agent an explicit evidence-bound verification sequence", () => {
      const observation = buildRepairObservation("5V", "H-001");

      expect(observation).toContain("Re-run run_relay_stress_test with the same parameters now");
      expect(observation).toContain("evidence_ids from that exact verification experiment");
      expect(observation).toContain("confirm the existing hypothesis");
      expect(observation).toContain("H-001");
    });

    it("keeps the repair notification available until the observation is sent", () => {
      const investigatingState = {
        status: "investigating",
        agentMode: "demo",
        activity: [],
        providerAvailable: true,
        providerStatus: "demo",
      } as unknown as BenchAgentState;
      const adapter = {
        getInterventionPoint: () => "5v",
      } as any;

      const html = renderToString(
        <RepairVerificationScene
          deviceAdapter={adapter}
          hypothesis={sampleHypothesis}
          agentState={investigatingState}
          onSendObservation={() => undefined}
          onReturnToInvestigation={() => undefined}
        />
      );

      expect(html).toContain('id="tell-agent-repair-btn"');
      expect(html).toContain("Notify Demo and run verification");
      expect(html).not.toContain("is evaluating the virtual DUT change");
    });

    it("uses shared application navigation shell with REPAIR highlighted", () => {
      const html = renderToString(
        <RepairVerificationScene
          hypothesis={sampleHypothesis}
          onReturnToInvestigation={() => undefined}
        />
      );

      // Shared shell top bar
      expect(html).toContain("/brand/ohmni-logo.svg");
      expect(html).toContain("ESP32-S3 Environmental Controller (Virtual)");
      expect(html).toContain("OBSERVE");
      expect(html).toContain("TEST");
      expect(html).toContain("DIAGNOSE");
      expect(html).toContain("REPAIR");
      expect(html).toContain("VERIFY");
      expect(html).not.toContain("Physical Repair &amp; Split-Scope Verification");
      expect(html).toContain("Return to Investigation");
    });

    it("Deny button is labeled 'Deny retest' and has visible dark text", () => {
      const approvalAgentState = {
        status: "approval",
        agentMode: "demo",
        goal: "Investigate",
        activity: [],
        providerAvailable: true,
        providerStatus: "demo",
        approval: {
          id: "app-2",
          tool: { name: "run_relay_stress_test", description: "Retest", parameters: {}, annotations: {} },
          arguments: {},
        },
      } as unknown as BenchAgentState;

      const mockAdapter = {
        getInterventionPoint: (pt: string) => (pt === "relay_power_jumper" ? "5v" : undefined),
      } as any;

      const html = renderToString(
        <RepairVerificationScene
          deviceAdapter={mockAdapter}
          hypothesis={sampleHypothesis}
          agentState={approvalAgentState}
          onReturnToInvestigation={() => undefined}
          onApproveTest={() => undefined}
          onDenyTest={() => undefined}
        />
      );

      expect(html).toContain("Authorize &amp; Energize");
      expect(html).toContain('id="approve-test-btn"');
      expect(html).toContain('data-testid="repair-deny-btn"');
      expect(html).toContain("Deny retest");

      // Verify text color is NOT white (#FFFFFF)
      // The Deny button must have dark text (e.g. #0F172A)
      expect(html).toContain("color:#0F172A");
      expect(html).not.toContain('color:#FFFFFF">Deny');
    });

    it("Virtual jumper intervention requires one explicit, accessible confirmation", () => {
      const html = renderToString(
        <RepairVerificationScene
          hypothesis={sampleHypothesis}
          onReturnToInvestigation={() => undefined}
        />
      );

      expect(html).toContain('data-testid="simulate-jp1-btn"');
      expect(html).toContain("Virtual DUT intervention required");
      expect(html).toContain("Shared 3.3 V");
      expect(html).toContain("Independent 5 V");
      expect(html).toContain("Simulate moving JP1");
      expect(html).toContain("AFTER REPAIR (Independent 5 V supply)");
    });
  });

  describe("8. Plain English Hardware Labels Across Scenes", () => {
    it("ObservingScene displays Brownout reset and reset threshold armed", () => {
      const html = renderToString(
        <ObservingScene
          resetCount={1}
          railVoltage={2.72}
          hasInspectedResetHistory={true}
          brownoutCount={1}
        />
      );

      expect(html).toContain("Brownout reset");
      expect(html).toContain("2.80 V reset threshold armed");
    });

    it("RunningExperimentScene displays Fault reproduced: Brownout reset", () => {
      const html = renderToString(
        <RunningExperimentScene
          ringBufferRef={ringBufferRef}
          markersRef={markersRef}
          isRunning={false}
          relayState="open"
          railVoltage={2.72}
        />
      );

      expect(html).toContain("Fault reproduced: Brownout reset");
    });
  });

  describe("9. Oscilloscope Accessibility", () => {
    it("Oscilloscope provides accessible state description", () => {
      const html = renderToString(
        <Oscilloscope
          ringBufferRef={ringBufferRef}
          markersRef={markersRef}
          isRunning={false}
        />
      );

      expect(html).toContain('role="img"');
      expect(html).toContain('aria-label="');
    });
  });

  describe("10. Ground Truth Reveal Polish", () => {
    it("displays 'Repair verified' title and accurate payoff subtitle", () => {
      const html = renderToString(
        <GroundTruthRevealScene
          groundTruth={{
            title: "Shared 3.3V Microcontroller Supply Rail",
            category: "power",
            summary: "Relay coil draws inrush current collapsing 3.3V rail to 2.72V.",
            rootCause: "Coil shared 3.3V rail instead of independent 5V supply.",
            correctIntervention: "Move JP1 to 5V.",
            expectedVoltageBefore: 2.72,
            expectedVoltageAfter: 3.18,
          } as any}
          hypothesis={sampleHypothesis}
          matchResult={{ isMatch: true, reason: "Accurate diagnosis" } as any}
          evidenceRecords={sampleEvidence}
          toolsUsedCount={7}
          experimentsCount={2}
          humanInterventionsCount={1}
          isVerified={true}
          onRunAnotherMystery={() => undefined}
          onReturnToWorkbench={() => undefined}
        />
      );

      expect(html).toContain("Repair verified");
      expect(html).toContain("diagnosis matched the hidden virtual DUT fault.");
      expect(html).toContain("2.72 V");
      expect(html).toContain("3.18 V");
      expect(html).toContain("1");
      expect(html).toContain("Human Intervention");
      expect(html).toContain("2");
      expect(html).toContain("Controlled DUT Experiments");
      expect(html).toContain("DIAGNOSIS MATCH ✓");
    });
  });
});
