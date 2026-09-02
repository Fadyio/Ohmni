/**
 * State 2 — Investigation Story View for OHMNI.
 * Implements the ~68% / 32% split layout:
 * - Top Bar: OHMNI Logo | ESP32 Controller | Live Agent
 * - Left 68%: Dynamic Investigation Scene (Answers "WHAT IS HAPPENING RIGHT NOW?")
 * - Right 32%: Human Narrative Rail (01 Observed, 02 Testing, 03 Evidence, 04 Hypothesis)
 */

import React, { useState } from "react";
import { DynamicInvestigationScene } from "./DynamicInvestigationScene";
import { InvestigationNarrativeRail } from "./InvestigationNarrativeRail";
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
}) => {
  const [activeSceneOverride, setActiveSceneOverride] = useState<"observing" | "test-request" | "running" | "evidence" | "hypothesis" | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div
      style={{
        width: "100%",
        maxWidth: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: "var(--ohmni-canvas)",
        color: "var(--ohmni-ink)",
        overflow: "hidden",
        boxSizing: "border-box",
      }}
    >
      {/* Clean Top Bar */}
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0.85rem 2rem",
          background: "var(--ohmni-surface)",
          borderBottom: "1px solid var(--ohmni-border)",
          flex: "none",
        }}
      >
        {/* Left: Brand */}
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <img
            src="/brand/ohmni-logo.svg"
            alt="OHMNI"
            style={{ height: "26px", width: "auto" }}
          />

          <div style={{ height: "16px", width: "1px", background: "var(--ohmni-border)" }} />

          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span
              style={{
                width: "7px",
                height: "7px",
                borderRadius: "50%",
                background: "var(--ohmni-success)",
              }}
            />
            <span style={{ fontSize: "13.5px", fontWeight: 700, color: "var(--ohmni-ink)" }}>
              {descriptor?.name ?? "ESP32 Environmental Controller"}
            </span>
          </div>
        </div>

        {/* Center: Scenario Goal Excerpt */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px", maxWidth: "450px" }}>
          <span style={{ fontSize: "12.5px", color: "var(--ohmni-secondary)", fontStyle: "italic", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            "{agentState.goal.length > 0 ? agentState.goal : "Controller resets whenever the fan turns on."}"
          </span>
        </div>

        {/* Right: Technical Inspector & Connection */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <button
            onClick={() => setDrawerOpen(true)}
            className="btn-secondary"
            style={{
              padding: "6px 12px",
              fontSize: "12px",
              fontWeight: 600,
            }}
          >
            <Radio size={13} />
            WebMCP Tools
          </button>

          <button
            onClick={onToggleConnect}
            className="btn-secondary"
            style={{
              padding: "6px 12px",
              fontSize: "12px",
              fontWeight: 600,
            }}
          >
            <Sliders size={13} />
            Disconnect
          </button>
        </div>
      </header>

      {/* Main 68% / 32% Investigation Canvas */}
      <div
        style={{
          flex: 1,
          display: "grid",
          gridTemplateColumns: "68% 32%",
          overflow: "hidden",
          minHeight: 0,
        }}
      >
        {/* Left 68%: Dynamic Investigation Scene */}
        <main
          style={{
            height: "100%",
            overflowY: "auto",
            padding: "1.75rem 2rem",
            background: "var(--ohmni-canvas)",
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

        {/* Right 32%: Human Investigation Narrative Rail */}
        <aside
          style={{
            height: "100%",
            overflow: "hidden",
            background: "var(--ohmni-surface)",
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
