/**
 * State 2 — World 2 (Focused Lab Mode Workbench).
 *
 * Requirements:
 * - Top Bar: OHMNI Logo | GEMINI LIVE / ESP32 ENVIRONMENTAL CONTROLLER
 * - Main Scene (~75%): Hardware / Scope / Dynamic Scene
 * - Agent Story (~25%): Chronological live narrative & activity
 * - Background: #090B10 (Dark technical lab canvas)
 * - Zero rounded card wall; clean dividers and floating instrument planes.
 */

import React, { useState } from "react";
import { DynamicInvestigationScene } from "./DynamicInvestigationScene";
import { InvestigationNarrativeRail } from "./InvestigationNarrativeRail";
import { SignalPulse } from "./SignalPulse";
import { WebMCPCapabilityDrawer } from "../layout/WebMCPCapabilityDrawer";
import type { TelemetryRingBuffer } from "@/domain/telemetry/ring-buffer";
import type { ScopeEventMarker } from "../../hooks/useOscilloscopeBuffer";
import type { EvidenceRecord } from "@/domain/evidence/types";
import type { Hypothesis } from "@/domain/hypothesis/types";
import type { DeviceDescriptor } from "@/domain/device/descriptor";
import type { BenchAgentState } from "../../hooks/useBenchAgent";
import { Radio, Sliders, Cpu, Activity, Sparkles, Terminal, AlertTriangle, Bot, ShieldCheck } from "lucide-react";
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
  readonly onSetGoal: (goal: string) => void;
  readonly onStartAgent: () => void;
  readonly onStopAgent: () => void;
  readonly onApproveTest: () => void;
  readonly onDenyTest: () => void;
  readonly onToggleConnect: () => void;
  readonly onProceedToRepair?: () => void;
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
  onSetGoal,
  onStartAgent,
  onStopAgent,
  onApproveTest,
  onDenyTest,
  onToggleConnect,
  onProceedToRepair,
  labChromeRef,
  labMainSceneRef,
  agentRailRef,
}) => {
  const [activeSceneOverride, setActiveSceneOverride] = useState<"observing" | "test-request" | "running" | "evidence" | "hypothesis" | null>(null);
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
        background: "var(--ohmni-lab-canvas)",
        color: "var(--ohmni-lab-text)",
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

      {/* Lab Header Chrome */}
      <header
        ref={labChromeRef}
        id="lab-header"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0.75rem 2rem",
          background: "var(--ohmni-lab-raised)",
          borderBottom: "1px solid var(--ohmni-lab-border)",
          flex: "none",
          zIndex: 10,
        }}
      >
        {/* Left: Brand + Hardware Identity */}
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <img
            src="/brand/ohmni-logo.svg"
            alt="OHMNI"
            style={{ height: "24px", width: "auto" }}
          />

          <div style={{ height: "16px", width: "1px", background: "var(--ohmni-lab-border)" }} />

          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span
              style={{
                width: "7px",
                height: "7px",
                borderRadius: "50%",
                background: "var(--ohmni-lab-verified)",
                boxShadow: "0 0 8px rgba(79, 209, 154, 0.4)",
              }}
            />
            <span className="font-mono" style={{ fontSize: "13px", fontWeight: 700, color: "var(--ohmni-lab-text)" }}>
              {descriptor?.name ?? "ESP32 ENVIRONMENTAL CONTROLLER"}
            </span>
          </div>
        </div>

        {/* Center: Gemini Dynamic Provider Badge */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span
            data-testid="gemini-provider-badge"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "4px 12px",
              borderRadius: "var(--radius-full)",
              background:
                providerStatus === "live"
                  ? "rgba(79, 209, 154, 0.12)"
                  : providerStatus === "error"
                  ? "rgba(255, 89, 95, 0.12)"
                  : providerStatus === "configured"
                  ? "rgba(85, 112, 255, 0.12)"
                  : "rgba(255, 255, 255, 0.05)",
              border: `1px solid ${
                providerStatus === "live"
                  ? "rgba(79, 209, 154, 0.3)"
                  : providerStatus === "error"
                  ? "rgba(255, 89, 95, 0.3)"
                  : providerStatus === "configured"
                  ? "rgba(85, 112, 255, 0.3)"
                  : "var(--ohmni-lab-border)"
              }`,
              color:
                providerStatus === "live"
                  ? "var(--ohmni-lab-verified)"
                  : providerStatus === "error"
                  ? "var(--ohmni-lab-fault)"
                  : providerStatus === "configured"
                  ? "var(--ohmni-lab-brand)"
                  : "var(--ohmni-lab-muted)",
              fontSize: "11.5px",
              fontWeight: 700,
              letterSpacing: "0.02em",
            }}
          >
            {providerStatus === "live" ? (
              <>
                <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "var(--ohmni-lab-verified)", boxShadow: "0 0 6px rgba(79, 209, 154, 0.8)" }} />
                <span>GEMINI LIVE</span>
              </>
            ) : providerStatus === "error" ? (
              <>
                <AlertTriangle size={12} />
                <span>GEMINI ERROR</span>
              </>
            ) : providerStatus === "configured" ? (
              <>
                <Bot size={12} />
                <span>GEMINI CONFIGURED</span>
              </>
            ) : (
              <>
                <Bot size={12} />
                <span>GEMINI UNCONFIGURED</span>
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
              borderRadius: "var(--radius-full)",
              background: isNativeMode ? "rgba(79, 209, 154, 0.08)" : "rgba(255, 255, 255, 0.04)",
              border: `1px solid ${isNativeMode ? "rgba(79, 209, 154, 0.25)" : "var(--ohmni-lab-border)"}`,
              color: isNativeMode ? "var(--ohmni-lab-verified)" : "var(--ohmni-lab-muted)",
              fontSize: "11px",
              fontWeight: 600,
            }}
          >
            <ShieldCheck size={12} />
            <span>{isNativeMode ? "Native WebMCP" : "Compatibility Mode"}</span>
          </span>
        </div>
        {/* Right: Technical Drawer & Connection Toggle */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <button
            onClick={() => setDrawerOpen(true)}
            className="btn-secondary"
            style={{
              padding: "6px 12px",
              fontSize: "12px",
              fontWeight: 600,
              color: "var(--ohmni-lab-text)",
              borderColor: "var(--ohmni-lab-border)",
            }}
          >
            <Radio size={13} color="var(--ohmni-lab-signal)" />
            <span>WebMCP Tools</span>
          </button>

          <button
            onClick={onToggleConnect}
            className="btn-secondary"
            style={{
              padding: "6px 12px",
              fontSize: "12px",
              fontWeight: 600,
              color: "var(--ohmni-lab-text)",
              borderColor: "var(--ohmni-lab-border)",
            }}
          >
            <Sliders size={13} />
            <span>Disconnect</span>
          </button>
        </div>
      </header>

      {/* Main 75% / 25% Lab Layout */}
      <div
        style={{
          flex: 1,
          display: "grid",
          gridTemplateColumns: "75% 25%",
          overflow: "hidden",
          minHeight: 0,
        }}
      >
        {/* Left 75%: Current Scene (Hardware & Scope) */}
        <main
          ref={labMainSceneRef}
          id="lab-main-scene"
          style={{
            height: "100%",
            overflowY: "auto",
            padding: "1.75rem 2rem",
            background: "var(--ohmni-lab-canvas)",
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
            activeSceneOverride={activeSceneOverride}
          />
        </main>

        {/* Right 25%: Chronological Agent Narrative Rail */}
        <aside
          ref={agentRailRef}
          id="lab-agent-rail"
          style={{
            height: "100%",
            overflow: "hidden",
            background: "var(--ohmni-lab-raised)",
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
