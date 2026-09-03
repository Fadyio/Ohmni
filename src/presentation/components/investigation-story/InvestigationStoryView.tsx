/**
 * State 2 — World 2 (Focused Lab Mode Workbench).
 * Master Milestone 8 — Precision Workbench Layout.
 *
 * Requirements:
 * - Top Bar: Compact 3D OHMNI Wordmark | ESP32 Controller | Sealed Scenario Badge | Gemini / WebMCP Provider Badge
 * - 70% Left Main Workbench Canvas / 30% Right Agent Column
 * - Cohesive Light Theme Canvas (#F4F5F7)
 * - Clean whitespace and typography; remove card wall
 * - Signal pulse connects agent orb and hardware target
 * - Developer Inspector access
 */

import React, { useState } from "react";
import { DynamicInvestigationScene } from "./DynamicInvestigationScene";
import { InvestigationNarrativeRail } from "./InvestigationNarrativeRail";
import { SignalPulse } from "./SignalPulse";
import { Ohmni3DWordmark } from "../brand/Ohmni3DWordmark";
import { WebMCPCapabilityDrawer } from "../layout/WebMCPCapabilityDrawer";
import type { TelemetryRingBuffer } from "@/domain/telemetry/ring-buffer";
import type { ScopeEventMarker } from "../../hooks/useOscilloscopeBuffer";
import type { EvidenceRecord } from "@/domain/evidence/types";
import type { Hypothesis } from "@/domain/hypothesis/types";
import type { DeviceDescriptor } from "@/domain/device/descriptor";
import type { BenchAgentState } from "../../hooks/useBenchAgent";
import type { ScenarioSession } from "@/domain/scenario/types";
import type { AgentMode } from "@/infrastructure/bench-agent/types";
import { Radio, Sliders, AlertTriangle, Bot, ShieldCheck, Sparkles, Lock, Terminal } from "lucide-react";
export interface InvestigationStoryViewProps {
  readonly isConnected: boolean;
  readonly descriptor: DeviceDescriptor | null;
  readonly relayState: "open" | "closed";
  readonly resetCount: number;
  readonly railVoltage: number;
  readonly experimentStatus: "idle" | "running" | "completed" | "failed" | "aborted" | string;
  readonly ringBufferRef: React.RefObject<TelemetryRingBuffer>;
  readonly markersRef: React.RefObject<ScopeEventMarker[]>;
  readonly evidenceRecords: readonly EvidenceRecord[];
  readonly hypothesis: Hypothesis | null;
  readonly agentState: BenchAgentState;
  readonly agentMode?: AgentMode;
  readonly activeScenario?: ScenarioSession | null;
  readonly onSetGoal: (goal: string) => void;
  readonly onStartAgent: () => void;
  readonly onStopAgent: () => void;
  readonly onApproveTest: () => void;
  readonly onDenyTest: () => void;
  readonly onToggleConnect: () => void;
  readonly onProceedToRepair?: () => void;
  readonly onOpenDevInspector?: () => void;
  readonly onSwitchToDemo?: () => void;
  readonly onRetryGemini?: () => void;
  readonly labChromeRef?: React.RefObject<HTMLElement | null>;
  readonly labMainSceneRef?: React.RefObject<HTMLElement | null>;
  readonly agentRailRef?: React.RefObject<HTMLElement | null>;
}

export const InvestigationStoryView: React.FC<InvestigationStoryViewProps> = ({
  isConnected,
  descriptor,
  relayState,
  resetCount,
  railVoltage,
  experimentStatus,
  ringBufferRef,
  markersRef,
  evidenceRecords,
  hypothesis,
  agentState,
  agentMode = "gemini",
  activeScenario,
  onSetGoal,
  onStartAgent,
  onStopAgent,
  onApproveTest,
  onDenyTest,
  onToggleConnect,
  onProceedToRepair,
  onOpenDevInspector,
  onSwitchToDemo,
  onRetryGemini,
  labChromeRef,
  labMainSceneRef,
  agentRailRef,
}) => {
  const [activeSceneOverride, setActiveSceneOverride] = useState<"ready" | "observing" | "test-request" | "running" | "evidence" | "hypothesis" | "completed" | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const isNativeMode = typeof window !== "undefined" && window.__webmcpMode === "native";
  const providerStatus = agentState.providerStatus;

  const isAgentActive = agentState.status === "investigating" || agentState.status === "approval";
  const activeToolName = agentState.activity.length > 0 ? agentState.activity[agentState.activity.length - 1].call.name : undefined;

  return (
    <div
      style={{
        width: "100%",
        maxWidth: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: "var(--ohmni-lab-canvas, #F4F5F7)",
        color: "var(--ohmni-lab-text, #12151A)",
        overflow: "hidden",
        boxSizing: "border-box",
        position: "relative",
      }}
    >
      {/* Signal Pulse traveling between Agent and Target Hardware */}
      <SignalPulse
        isActive={isAgentActive}
        direction="agent-to-device"
        label={activeToolName}
      />

      {/* Lab Header Chrome with Compact 3D Wordmark */}
      <header
        ref={labChromeRef}
        id="lab-header"
        data-testid="lab-header"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0.75rem 2.25rem",
          background: "var(--ohmni-lab-nav, rgba(255, 255, 255, 0.88))",
          backdropFilter: "blur(12px)",
          borderBottom: "1px solid var(--ohmni-lab-border, #E2E4E9)",
          flex: "none",
          zIndex: 10,
        }}
      >
        {/* Left: 3D Compact Brand Wordmark + Hardware Identity */}
        <div style={{ display: "flex", alignItems: "center", gap: "18px" }}>
          <div id="navbar-brand-wordmark" data-testid="navbar-brand-wordmark">
            <Ohmni3DWordmark variant="compact" />
          </div>

          <div style={{ height: "18px", width: "1px", background: "var(--ohmni-lab-border, #E2E4E9)" }} />

          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span
              style={{
                width: "7px",
                height: "7px",
                borderRadius: "50%",
                background: isConnected ? "var(--ohmni-lab-verified, #27966B)" : "var(--ohmni-lab-muted, #64748B)",
                boxShadow: isConnected ? "0 0 8px rgba(39, 150, 107, 0.5)" : "none",
              }}
            />
            <span className="font-mono" style={{ fontSize: "13px", fontWeight: 700, color: "var(--ohmni-lab-text, #0F172A)" }}>
              {descriptor?.name ?? "ESP32 ENVIRONMENTAL CONTROLLER"}
            </span>
          </div>
        </div>

        {/* Center: Sealed Fault Badge & Dynamic Agent Provider Badge */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          {/* Sealed Fault Badge */}
          {activeScenario && (
            <span
              data-testid="sealed-fault-badge"
              title="The scenario state is held outside the model/tool context and is revealed only after verification."
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
                padding: "4px 10px",
                borderRadius: "var(--radius-full, 9999px)",
                background: activeScenario.isSealed ? "rgba(15, 23, 42, 0.05)" : "rgba(39, 150, 107, 0.1)",
                border: `1px solid ${activeScenario.isSealed ? "rgba(15, 23, 42, 0.15)" : "rgba(39, 150, 107, 0.3)"}`,
                color: activeScenario.isSealed ? "var(--ohmni-lab-secondary, #64748B)" : "var(--ohmni-lab-verified, #27966B)",
                fontSize: "11px",
                fontWeight: 700,
                cursor: "help",
              }}
            >
              <Lock size={12} />
              <span>{activeScenario.isSealed ? "SEALED FAULT" : "VERIFIED FAULT"}</span>
            </span>
          )}

          <span
            data-testid="gemini-provider-badge"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "4px 12px",
              borderRadius: "var(--radius-full, 9999px)",
              background:
                agentMode === "demo"
                  ? "rgba(73, 103, 255, 0.1)"
                  : providerStatus === "live"
                  ? "rgba(39, 150, 107, 0.1)"
                  : providerStatus === "error" || agentState.status === "failed" || agentState.status === "unavailable"
                  ? "rgba(220, 80, 80, 0.1)"
                  : "rgba(73, 103, 255, 0.1)",
              border: `1px solid ${
                agentMode === "demo"
                  ? "rgba(73, 103, 255, 0.3)"
                  : providerStatus === "live"
                  ? "rgba(39, 150, 107, 0.3)"
                  : providerStatus === "error" || agentState.status === "failed" || agentState.status === "unavailable"
                  ? "rgba(220, 80, 80, 0.3)"
                  : "rgba(73, 103, 255, 0.3)"
              }`,
              color:
                agentMode === "demo"
                  ? "var(--ohmni-lab-brand, #4967FF)"
                  : providerStatus === "live"
                  ? "var(--ohmni-lab-verified, #27966B)"
                  : providerStatus === "error" || agentState.status === "failed" || agentState.status === "unavailable"
                  ? "var(--ohmni-lab-fault, #DC5050)"
                  : "var(--ohmni-lab-brand, #4967FF)",
              fontSize: "11.5px",
              fontWeight: 700,
              letterSpacing: "0.02em",
            }}
          >
            {agentMode === "demo" ? (
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <Bot size={13} />
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", lineHeight: 1.1 }}>
                  <span>DEMO AGENT</span>
                  <span style={{ fontSize: "9px", fontWeight: 500, opacity: 0.85 }}>Deterministic walkthrough</span>
                </div>
              </div>
            ) : providerStatus === "live" ? (
              <>
                <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "var(--ohmni-lab-verified, #27966B)", boxShadow: "0 0 6px rgba(39, 150, 107, 0.8)" }} />
                <span>GEMINI LIVE</span>
              </>
            ) : providerStatus === "error" || agentState.status === "failed" || agentState.status === "unavailable" ? (
              <>
                <AlertTriangle size={12} />
                <span>GEMINI ERROR</span>
              </>
            ) : (
              <>
                <Sparkles size={12} />
                <span>GEMINI CONFIGURED</span>
              </>
            )}
          </span>

          {/* WebMCP Mode Badge */}
          <span
            data-testid="webmcp-mode-badge"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "5px",
              padding: "4px 10px",
              borderRadius: "var(--radius-full, 9999px)",
              background: isNativeMode ? "rgba(39, 150, 107, 0.08)" : "rgba(18, 21, 26, 0.04)",
              border: `1px solid ${isNativeMode ? "rgba(39, 150, 107, 0.25)" : "var(--ohmni-lab-border, #E2E4E9)"}`,
              color: isNativeMode ? "var(--ohmni-lab-verified, #27966B)" : "var(--ohmni-lab-muted, #64748B)",
              fontSize: "11px",
              fontWeight: 600,
            }}
          >
            <ShieldCheck size={12} />
            <span>{isNativeMode ? "Native WebMCP" : "Standard WebMCP"}</span>
          </span>
        </div>

        {/* Right: Technical Inspector & Disconnect Button */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          {onOpenDevInspector && (
            <button
              type="button"
              data-testid="open-dev-inspector-btn"
              onClick={onOpenDevInspector}
              className="btn-secondary"
              title="Developer Inspector [Cmd+Shift+D]"
              style={{
                padding: "7px 12px",
                fontSize: "12.5px",
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
              }}
            >
              <Terminal size={13} color="var(--ohmni-lab-brand, #4967FF)" />
              <span>Inspector</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="btn-secondary"
            style={{
              padding: "7px 14px",
              fontSize: "12.5px",
            }}
          >
            <Radio size={13} color="var(--ohmni-lab-brand, #4967FF)" />
            <span>WebMCP Tools</span>
          </button>

          <button
            type="button"
            onClick={onToggleConnect}
            className="btn-secondary"
            style={{
              padding: "7px 14px",
              fontSize: "12.5px",
            }}
          >
            <Sliders size={13} />
            <span>{isConnected ? "Disconnect" : "Connect"}</span>
          </button>
        </div>
      </header>

      {/* Persistent Progress Strip: OBSERVE -> TEST -> DIAGNOSE -> REPAIR -> VERIFY */}
      <div
        id="investigation-progress-strip"
        data-testid="investigation-progress-strip"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "10px",
          padding: "7px 16px",
          background: "rgba(255, 255, 255, 0.75)",
          backdropFilter: "blur(8px)",
          borderBottom: "1px solid var(--ohmni-lab-border, #E2E4E9)",
          flex: "none",
          zIndex: 5,
        }}
      >
        {(["OBSERVE", "TEST", "DIAGNOSE", "REPAIR", "VERIFY"] as const).map((phase, idx) => {
          const isTestActive =
            experimentStatus === "running" ||
            relayState === "closed" ||
            (agentState.status === "approval" && agentState.approval.tool.name.includes("stress")) ||
            agentState.activity.some((a) => a.call.name.includes("stress"));
          const hasHypothesis = hypothesis !== null;
          const isVerified = activeScenario?.isVerified === true || hypothesis?.verificationStatus === "VERIFIED";
          const isRepair = hypothesis !== null && activeScenario?.isVerified !== true && !isTestActive;

          let currentPhase: "OBSERVE" | "TEST" | "DIAGNOSE" | "REPAIR" | "VERIFY" = "OBSERVE";
          if (isVerified) {
            currentPhase = "VERIFY";
          } else if (isRepair) {
            currentPhase = "REPAIR";
          } else if (hasHypothesis) {
            currentPhase = "DIAGNOSE";
          } else if (isTestActive) {
            currentPhase = "TEST";
          } else {
            currentPhase = "OBSERVE";
          }

          const isActive = phase === currentPhase;
          return (
            <React.Fragment key={phase}>
              {idx > 0 && <span style={{ color: "var(--ohmni-lab-border, #CBD5E1)", fontSize: "11px" }}>→</span>}
              <span
                data-phase={phase}
                data-active={isActive}
                style={{
                  padding: "3px 10px",
                  borderRadius: "var(--radius-full, 9999px)",
                  fontSize: "11px",
                  fontWeight: isActive ? 800 : 600,
                  letterSpacing: "0.05em",
                  color: isActive ? "var(--ohmni-lab-brand, #4967FF)" : "var(--ohmni-lab-muted, #94A3B8)",
                  background: isActive ? "rgba(73, 103, 255, 0.08)" : "transparent",
                  border: isActive ? "1px solid rgba(73, 103, 255, 0.25)" : "1px solid transparent",
                }}
              >
                {phase}
              </span>
            </React.Fragment>
          );
        })}
      </div>

      {/* Main 72% / 28% Workbench Layout */}
      <div
        style={{
          flex: 1,
          display: "grid",
          gridTemplateColumns: "72% 28%",
          overflow: "hidden",
          minHeight: 0,
        }}
      >
        {/* Left 70%: Current Scene Canvas (Hardware, Scope, Evidence) */}
        <main
          ref={labMainSceneRef}
          id="lab-main-scene"
          style={{
            height: "100%",
            overflowY: "auto",
            padding: "1.5rem 2rem",
            background: "var(--ohmni-lab-canvas, #F4F5F7)",
          }}
        >
          <DynamicInvestigationScene
            agentState={agentState}
            experimentStatus={experimentStatus}
            relayState={relayState}
            resetCount={resetCount}
            railVoltage={railVoltage}
            ringBufferRef={ringBufferRef}
            markersRef={markersRef}
            evidenceRecords={evidenceRecords}
            hypothesis={hypothesis}
            onApproveTest={onApproveTest}
            onDenyTest={onDenyTest}
            onProceedToRepair={onProceedToRepair}
            onStartAgent={onStartAgent}
            agentMode={agentMode}
            onSwitchToDemo={onSwitchToDemo}
            onRetryGemini={onRetryGemini}
            activeSceneOverride={activeSceneOverride}
          />
        </main>

        {/* Right 30%: Chronological Agent Narrative Rail */}
        <aside
          ref={agentRailRef}
          id="lab-agent-rail"
          style={{
            height: "100%",
            overflow: "hidden",
            background: "var(--ohmni-lab-raised, #FFFFFF)",
          }}
        >
          <InvestigationNarrativeRail
            agentState={agentState}
            onSetGoal={onSetGoal}
            onStartAgent={onStartAgent}
            onStopAgent={onStopAgent}
            onApprove={onApproveTest}
            onDeny={onDenyTest}
            onSelectScene={(scene) => setActiveSceneOverride(scene)}
          />
        </aside>
      </div>

      {/* WebMCP Capability Drawer */}
      <WebMCPCapabilityDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        tools={[]}
        isNative={true}
        isDiscovering={false}
      />
    </div>
  );
};
