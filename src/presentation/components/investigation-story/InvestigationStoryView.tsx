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
import { Radio, Sliders, Cpu, Activity, Sparkles, Terminal } from "lucide-react";

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

        {/* Center: Gemini Live Badge */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "3px 10px",
              borderRadius: "var(--radius-full)",
              background: "rgba(85, 112, 255, 0.12)",
              border: "1px solid rgba(85, 112, 255, 0.25)",
              color: "var(--ohmni-lab-brand)",
              fontSize: "12px",
              fontWeight: 700,
            }}
          >
            <Sparkles size={12} />
            <span>GEMINI LIVE</span>
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
