/**
 * Core Agent-Ready Workbench Layout.
 * Provides a 70% live instrument surface and 30% external agent activity rail.
 */

import React, { useState, useRef, useEffect } from "react";
import { Bot, ShieldCheck, Terminal, Radio, Sliders, MoreHorizontal } from "lucide-react";
import { DynamicInvestigationScene } from "./DynamicInvestigationScene";
import { InvestigationNarrativeRail } from "./InvestigationNarrativeRail";
import { WebMCPCapabilityDrawer } from "../layout/WebMCPCapabilityDrawer";
import type { TelemetryRingBuffer } from "@/domain/telemetry/ring-buffer";
import type { ScopeEventMarker } from "../../hooks/useOscilloscopeBuffer";
import type { EvidenceRecord } from "@/domain/evidence/types";
import type { Hypothesis } from "@/domain/hypothesis/types";
import type { DeviceDescriptor } from "@/domain/device/descriptor";
import type { BenchAgentState } from "../../hooks/useBenchAgent";
import type { AgentMode } from "@/infrastructure/bench-agent/types";
import type { ScenarioSession } from "@/domain/scenario/types";
import type { InvestigationPhase } from "@/domain/investigation/lifecycle";
import { deriveInvestigationPhase } from "@/domain/investigation/lifecycle";
import { classifyTool } from "@/domain/safety/tool-safety-policy";
import { getAgentIdentity } from "@/presentation/types/agent-identity";
import { useWebMCPTools } from "@/presentation/hooks/useWebMCPTools";
import type { ToolLedgerEntry } from "@/domain/investigation/tool-ledger";
import type { ToolApprovalRequest } from "@/domain/safety/approval-gate";

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
  readonly ledgerEntries?: readonly ToolLedgerEntry[];
  readonly pendingApproval?: ToolApprovalRequest | null;
  readonly registeredToolCount?: number;
  readonly onSetGoal: (goal: string) => void;
  readonly onStartAgent: () => void;
  readonly onStopAgent: () => void;
  readonly onApproveTest: () => void;
  readonly onDenyTest: () => void;
  readonly onToggleConnect: () => void;
  readonly onProceedToRepair?: () => void;
  readonly onOpenDevInspector?: () => void;
  readonly onSwitchToDemo?: () => void;
  readonly onRetryAgent?: () => void;
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
  agentMode = "external",
  activeScenario,
  ledgerEntries,
  pendingApproval,
  registeredToolCount,
  onSetGoal,
  onStartAgent,
  onStopAgent,
  onApproveTest,
  onDenyTest,
  onToggleConnect,
  onProceedToRepair,
  onOpenDevInspector,
  onSwitchToDemo,
  onRetryAgent,
  labChromeRef,
  labMainSceneRef,
  agentRailRef,
}) => {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeSceneOverride, setActiveSceneOverride] = useState<"ready" | "observing" | "test-request" | "running" | "evidence" | "hypothesis" | "completed" | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const agentIdentity = getAgentIdentity(agentMode, agentState.liveProvider, agentState.liveModel);

  const activeLedgerEntry = ledgerEntries?.findLast(
    (entry) =>
      entry.status === "requested" ||
      entry.status === "waiting-approval" ||
      entry.status === "running"
  );
  const activeToolName =
    pendingApproval?.toolName ??
    activeLedgerEntry?.toolName ??
    (agentState.activity.length > 0
      ? agentState.activity[agentState.activity.length - 1].call.name
      : undefined);
  const isAwaitingApproval =
    pendingApproval !== null && pendingApproval !== undefined
      ? true
      : activeLedgerEntry?.status === "waiting-approval" ||
        agentState.status === "approval";
  const isToolRunning =
    activeLedgerEntry?.status === "requested" ||
    activeLedgerEntry?.status === "running" ||
    agentState.status === "investigating";

  const isHumanInterventionCompleted = Boolean(
    evidenceRecords.some((e) => e.source === "human") ||
    activeScenario?.isVerified === true
  );

  const investigationPhase: InvestigationPhase = deriveInvestigationPhase({
    isConnected,
    isAgentRunning: isToolRunning,
    agentStatus:
      isAwaitingApproval
        ? "waiting_approval"
        : isToolRunning
        ? "running"
        : agentState.status === "failed"
        ? "failed"
        : agentState.status === "stopped"
        ? "stopped"
        : agentState.status === "completed"
        ? "completed"
        : "idle",
    activeToolClass:
      activeToolName ? classifyTool(activeToolName) : undefined,
    isAwaitingApproval,
    isExperimentActive:
      experimentStatus === "running" &&
      !(hypothesis !== null && !isHumanInterventionCompleted),
    isVerificationExperiment: isHumanInterventionCompleted,
    hasRecentEvidence: evidenceRecords.length > 0,
    hasHypothesis: hypothesis !== null,
    isWaitingForHuman: hypothesis !== null && !isHumanInterventionCompleted,
    isHumanInterventionCompleted,
    isVerified: hypothesis?.verificationStatus === "VERIFIED" || activeScenario?.isVerified === true,
    isChallengeMode: agentMode !== "demo",
    hasStarted: true,
    failureMessage: agentState.status === "failed" ? agentState.message : undefined,
  });
  const {
    tools: webmcpTools,
    toolCount,
    isNative: isNativeMode,
    isDiscovering,
  } = useWebMCPTools();
  const materializedToolCount = registeredToolCount ?? toolCount;

  useEffect(() => {
    if (!menuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMenuOpen(false);
        return;
      }

      if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;

      const menuButtons = menuRef.current?.querySelectorAll<HTMLButtonElement>(
        '[role="menuitem"]:not(:disabled)'
      );
      if (!menuButtons || menuButtons.length === 0) return;

      e.preventDefault();
      const buttons = Array.from(menuButtons);
      const currentIndex = buttons.indexOf(document.activeElement as HTMLButtonElement);
      const direction = e.key === "ArrowDown" ? 1 : -1;
      const nextIndex =
        currentIndex === -1
          ? direction === 1
            ? 0
            : buttons.length - 1
          : (currentIndex + direction + buttons.length) % buttons.length;
      buttons[nextIndex]?.focus();
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuOpen]);

  const currentProgressStep: "OBSERVE" | "TEST" | "DIAGNOSE" | "REPAIR" | "VERIFY" = (() => {
    switch (investigationPhase) {
      case "welcome":
      case "challenge_ready":
      case "connecting":
      case "ready":
      case "observing":
        return "OBSERVE";
      case "waiting_for_approval":
      case "experiment_running":
      case "evidence_review":
        return "TEST";
      case "reasoning":
      case "hypothesis":
        return "DIAGNOSE";
      case "waiting_for_human":
        return "REPAIR";
      case "verification_pending":
      case "verification_running":
      case "verified":
        return "VERIFY";
      default:
        return "OBSERVE";
    }
  })();
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
      <header
        ref={labChromeRef}
        id="lab-header"
        data-testid="lab-header"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0.65rem 1.5rem",
          background: "#FFFFFF",
          borderBottom: "1px solid var(--ohmni-lab-border, #E2E4E9)",
          flex: "none",
          zIndex: 10,
        }}
      >
        {/* Left: Flat Brand Logo + Hardware Identity */}
        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          <div id="navbar-brand-wordmark" data-testid="navbar-brand-wordmark">
            <img src="/brand/ohmni-logo.svg" alt="OHMNI" style={{ height: "26px", width: "auto" }} />
          </div>

          <div style={{ height: "16px", width: "1px", background: "var(--ohmni-lab-border, #E2E4E9)" }} />

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
            <span className="font-mono" style={{ fontSize: "12.5px", fontWeight: 700, color: "var(--ohmni-lab-text, #0F172A)" }}>
              {descriptor?.name ?? "No target connected"}
            </span>
          </div>
        </div>

        {/* Center: OBSERVE -> TEST -> DIAGNOSE -> REPAIR -> VERIFY */}
        <div
          id="investigation-progress-strip"
          data-testid="investigation-progress-strip"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          {(["OBSERVE", "TEST", "DIAGNOSE", "REPAIR", "VERIFY"] as const).map((phase, idx) => {
            const isActive = phase === currentProgressStep;
            return (
              <React.Fragment key={phase}>
                {idx > 0 && <span aria-hidden="true" style={{ width: "12px", height: "1px", background: "var(--ohmni-lab-border, #CBD5E1)" }} />}
                <span
                  data-phase={phase}
                  data-active={isActive}
                  style={{
                    padding: "4px 5px 5px",
                    borderRadius: 0,
                    fontSize: "11px",
                    fontWeight: isActive ? 800 : 600,
                    letterSpacing: "0.04em",
                    color: isActive ? "var(--ohmni-lab-text)" : "var(--ohmni-lab-muted, #737A86)",
                    background: "transparent",
                    borderBottom: isActive ? "2px solid var(--ohmni-lab-brand, #4967FF)" : "2px solid transparent",
                  }}
                >
                  {phase}
                </span>
              </React.Fragment>
            );
          })}
        </div>

        {/* Right: WebMCP mode, explicitly active built-in provider, and ••• More Menu */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span
            data-testid="webmcp-mode-badge"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "5px",
              padding: "3px 9px",
              borderRadius: "var(--radius-full, 9999px)",
              background: isNativeMode ? "rgba(39, 150, 107, 0.08)" : "rgba(73, 103, 255, 0.08)",
              border: isNativeMode ? "1px solid rgba(39, 150, 107, 0.25)" : "1px solid rgba(73, 103, 255, 0.22)",
              color: isNativeMode ? "var(--ohmni-lab-verified, #27966B)" : "var(--ohmni-lab-brand, #4967FF)",
              fontSize: "11px",
              fontWeight: 600,
            }}
          >
            <ShieldCheck size={12} />
            <span>
              {isNativeMode ? "Native WebMCP" : "Compatibility mode"} · {materializedToolCount} tools active
            </span>
          </span>

          {(agentMode === "demo" || agentMode === "groq") && (
            <span
              data-testid={agentMode === "demo" ? "demo-provider-badge" : "groq-provider-badge"}
              data-provider-badge="true"
              id="provider-badge"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "3px 0",
                borderRadius: 0,
                background: "transparent",
                border: "none",
                color:
                  agentMode === "demo"
                    ? "var(--ohmni-lab-brand, #4967FF)"
                    : agentState.providerAvailable
                    ? "var(--ohmni-lab-verified, #27966B)"
                    : "var(--ohmni-lab-muted, #64748B)",
                fontSize: "11.5px",
                fontWeight: 700,
                letterSpacing: "0.02em",
              }}
            >
              {agentMode === "demo" ? (
                <>
                  <Bot size={13} />
                  <span>DEMO AGENT · Deterministic walkthrough</span>
                </>
              ) : agentState.providerAvailable ? (
                <>
                  <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "var(--ohmni-lab-verified, #27966B)", boxShadow: "0 0 6px rgba(39, 150, 107, 0.8)" }} />
                  <span>{agentIdentity.displayName} · Live</span>
                </>
              ) : (
                <>
                  <Bot size={13} />
                  <span>{agentIdentity.displayName} · Connecting...</span>
                </>
              )}
            </span>
          )}

          {/* ••• More Menu */}
          <div ref={menuRef} style={{ position: "relative" }}>
            <button
              type="button"
              data-testid="more-menu-btn"
              aria-label="More developer tools and connection details"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((prev) => !prev)}
              className="btn-secondary"
              style={{
                padding: "5px 9px",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: "var(--radius-md, 8px)",
                fontSize: "14px",
                fontWeight: 800,
              }}
            >
              <MoreHorizontal size={16} />
            </button>

            {menuOpen && (
              <div
                role="menu"
                aria-label="More options"
                style={{
                  position: "absolute",
                  top: "calc(100% + 6px)",
                  right: 0,
                  width: "210px",
                  background: "var(--ohmni-lab-surface, #FFFFFF)",
                  border: "1px solid var(--ohmni-lab-border, #E2E4E9)",
                  borderRadius: "var(--radius-lg, 12px)",
                  boxShadow: "0 12px 32px -4px rgba(15, 23, 42, 0.12)",
                  padding: "6px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "2px",
                  zIndex: 100,
                }}
              >
                {onOpenDevInspector && (
                  <button
                    type="button"
                    data-testid="open-dev-inspector-btn"
                    role="menuitem"
                    onClick={() => {
                      setMenuOpen(false);
                      onOpenDevInspector();
                    }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      padding: "8px 10px",
                      borderRadius: "6px",
                      background: "transparent",
                      border: "none",
                      cursor: "pointer",
                      fontSize: "12.5px",
                      color: "var(--ohmni-lab-text, #0F172A)",
                      textAlign: "left",
                      width: "100%",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(15, 23, 42, 0.04)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <Terminal size={14} color="var(--ohmni-lab-brand, #4967FF)" />
                    <span style={{ flex: 1, fontWeight: 600 }}>WebMCP Inspector</span>
                    <span className="font-mono" style={{ fontSize: "10px", color: "var(--ohmni-lab-muted, #64748B)" }}>⌘⇧D</span>
                  </button>
                )}

                <button
                  type="button"
                  data-testid="webmcp-tools-btn"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    setDrawerOpen(true);
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "8px 10px",
                    borderRadius: "6px",
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    fontSize: "12.5px",
                    color: "var(--ohmni-lab-text, #0F172A)",
                    textAlign: "left",
                    width: "100%",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(15, 23, 42, 0.04)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <Radio size={14} color="var(--ohmni-lab-brand, #4967FF)" />
                  <span style={{ flex: 1, fontWeight: 600 }}>Tool Registry</span>
                </button>

                <div style={{ height: "1px", background: "var(--ohmni-lab-border, #E2E4E9)", margin: "4px 0" }} />

                <button
                  type="button"
                  data-testid="toggle-connect-btn"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    onToggleConnect();
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "8px 10px",
                    borderRadius: "6px",
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    fontSize: "12.5px",
                    color: isConnected ? "var(--ohmni-lab-fault, #DC5050)" : "var(--ohmni-lab-text, #0F172A)",
                    textAlign: "left",
                    width: "100%",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(15, 23, 42, 0.04)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <Sliders size={14} />
                  <span style={{ flex: 1, fontWeight: 600 }}>{isConnected ? "Disconnect Board" : "Connect Board"}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>
      {/* Main 72% / 28% Workbench Layout */}
      <div
        style={{
          flex: 1,
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) minmax(320px, 27%)",
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
            padding: "1.35rem 1.6rem",
            background: "var(--ohmni-lab-canvas, #F4F5F7)",
          }}
        >
          <DynamicInvestigationScene
            descriptor={descriptor}
            agentState={agentState}
            ledgerEntries={ledgerEntries}
            pendingApproval={pendingApproval}
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
            onRetryAgent={onRetryAgent}
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
            investigationPhase={investigationPhase}
            hypothesis={hypothesis}
            ledgerEntries={ledgerEntries}
            pendingApproval={pendingApproval}
            agentMode={agentMode}
            onSwitchToDemo={onSwitchToDemo}
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
        tools={webmcpTools}
        isNative={isNativeMode}
        isDiscovering={isDiscovering}
      />
    </div>
  );
};
