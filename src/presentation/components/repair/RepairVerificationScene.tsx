/**
 * State 3 — Human Intervention & Repair Verification Scene.
 * Full focus shift for physical repair action:
 * - Interactive physical jumper selector controlling VirtualDeviceAdapter state directly.
 * - Human physical change produces a first-class human observation for the Bench Agent.
 * - Split-scope comparison deriving BEFORE and AFTER measurements strictly from ExperimentRecords.
 * - Zero presentation fallback truth (no ?? 2.72 or ?? 3.18).
 * - Agent independently decides to retest, requests human authorization, reads new evidence, and confirms.
 */

import React, { useState, useCallback, useMemo } from "react";
import { Wrench, CheckCircle2, Zap, ArrowRight, ShieldCheck, Activity, RotateCcw, AlertTriangle, Send, Bot, ShieldAlert } from "lucide-react";
import type { DeviceAdapter } from "@/domain/device/adapter";
import type { ExperimentStore } from "@/domain/experiment/store";
import type { EvidenceStore } from "@/domain/evidence/store";
import type { HypothesisStore } from "@/domain/hypothesis/store";
import type { Hypothesis } from "@/domain/hypothesis/types";
import type { ExperimentRecord } from "@/domain/experiment/types";
import type { BenchAgentState } from "@/presentation/hooks/useBenchAgent";
import { getAgentIdentity } from "@/presentation/types/agent-identity";
interface InteractiveDeviceAdapter extends DeviceAdapter {
  getInterventionPoint?(point: string): string | undefined;
  setInterventionPoint?(point: string, value: string): void;
}

export interface RepairVerificationSceneProps {
  readonly deviceAdapter?: DeviceAdapter;
  readonly experimentStore?: ExperimentStore;
  readonly evidenceStore?: EvidenceStore;
  readonly hypothesisStore?: HypothesisStore;
  readonly hypothesis?: Hypothesis | null;
  readonly agentState?: BenchAgentState;
  readonly onSendObservation?: (observation: string) => void;
  readonly onApproveTest?: () => void;
  readonly onDenyTest?: () => void;
  readonly onReturnToInvestigation: () => void;
}

export const RepairVerificationScene: React.FC<RepairVerificationSceneProps> = ({
  deviceAdapter,
  experimentStore,
  evidenceStore,
  hypothesisStore,
  hypothesis,
  agentState,
  onSendObservation,
  onApproveTest,
  onDenyTest,
  onReturnToInvestigation,
}) => {
  const agentIdentity = getAgentIdentity(agentState?.agentMode, agentState?.liveProvider, agentState?.liveModel);
  const isNativeMode = typeof window !== "undefined" && window.__webmcpMode === "native";
  const resolvedAdapter = useMemo<InteractiveDeviceAdapter | undefined>(() => {
    return (deviceAdapter as InteractiveDeviceAdapter) ?? (typeof window !== "undefined" ? (window.__virtualDevice as InteractiveDeviceAdapter) : undefined);
  }, [deviceAdapter]);

  const resolvedExperimentStore = useMemo<ExperimentStore | undefined>(() => {
    return experimentStore ?? (typeof window !== "undefined" ? window.__experimentStore : undefined);
  }, [experimentStore]);

  const resolvedEvidenceStore = useMemo<EvidenceStore | undefined>(() => {
    return evidenceStore ?? (typeof window !== "undefined" ? window.__evidenceStore : undefined);
  }, [evidenceStore]);

  const resolvedHypothesisStore = useMemo<HypothesisStore | undefined>(() => {
    return hypothesisStore ?? (typeof window !== "undefined" ? window.__hypothesisStore : undefined);
  }, [hypothesisStore]);

  // Initial jumper read from actual adapter state
  const initialJumper =
    resolvedAdapter?.getInterventionPoint?.("relay_power_jumper") === "5v" ? "5V" : "3V3";

  const [jumperPosition, setJumperPosition] = useState<"3V3" | "5V">(initialJumper);
  const [observationSent, setObservationSent] = useState<boolean>(false);

  // Read all experiment records
  const allExperiments = useMemo<readonly ExperimentRecord[]>(() => {
    if (!resolvedExperimentStore) return [];
    return resolvedExperimentStore.getExperiments();
  }, [resolvedExperimentStore, hypothesis]);

  // Derive BEFORE failed experiment (first failure or brownout)
  const beforeExperiment = useMemo(() => {
    return (
      allExperiments.find(
        (exp) =>
          (exp.summary?.unexpected_resets !== undefined && exp.summary.unexpected_resets > 0) ||
          exp.events?.some((e) => e.event.type === "reset") ||
          (exp.summary?.supply_voltage?.minimum_v !== undefined && exp.summary.supply_voltage.minimum_v < 2.80)
      ) ?? allExperiments[0]
    );
  }, [allExperiments]);

  // Derive AFTER verification experiment (most recent completed experiment with zero resets)
  const afterExperiment = useMemo(() => {
    const passing = allExperiments.filter(
      (exp) =>
        exp.metadata.id !== beforeExperiment?.metadata.id &&
        (exp.summary?.unexpected_resets === 0 || !exp.summary?.unexpected_resets) &&
        (exp.summary?.supply_voltage?.minimum_v !== undefined && exp.summary.supply_voltage.minimum_v >= 2.80) &&
        !exp.events?.some((e) => e.event.type === "reset")
    );
    return passing.length > 0 ? passing[passing.length - 1] : undefined;
  }, [allExperiments, beforeExperiment]);

  // Human Physical Intervention: Selecting the jumper changes the real VirtualDeviceAdapter state
  const handleSelectJumper = useCallback(
    (pos: "3V3" | "5V") => {
      setJumperPosition(pos);
      setObservationSent(false);
      if (resolvedAdapter?.setInterventionPoint) {
        resolvedAdapter.setInterventionPoint("relay_power_jumper", pos === "5V" ? "5v" : "3v3");
      }
    },
    [resolvedAdapter]
  );

  const handleJumperKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>): void => {
      if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
        event.preventDefault();
        handleSelectJumper("3V3");
      } else if (event.key === "ArrowRight" || event.key === "ArrowUp") {
        event.preventDefault();
        handleSelectJumper("5V");
      }
    },
    [handleSelectJumper]
  );

  // Notify Bench Agent of human observation
  const handleNotifyAgent = useCallback(() => {
    const observationText =
      jumperPosition === "5V"
        ? "Human observation: Relay power jumper moved from shared 3.3V rail to external 5V rail."
        : "Human observation: Relay power jumper moved back to shared 3.3V rail.";
    setObservationSent(true);
    if (resolvedEvidenceStore && typeof resolvedEvidenceStore.addHumanObservation === "function") {
      resolvedEvidenceStore.addHumanObservation({
        summary: observationText,
        notes: `Jumper physically moved to ${jumperPosition}`,
        interventionPointId: "relay_power_jumper",
      });
    }
    if (onSendObservation) {
      onSendObservation(observationText);
    }
  }, [jumperPosition, resolvedEvidenceStore, onSendObservation]);

  const beforeMinVoltage = beforeExperiment?.summary?.supply_voltage?.minimum_v;
  const afterMinVoltage = afterExperiment?.summary?.supply_voltage?.minimum_v;
  
  // Real domain-driven verification state: hypothesis verified status OR confirmed status from domain store
  const isHypothesisVerified =
    hypothesis?.verificationStatus === "VERIFIED" ||
    hypothesis?.status === "CONFIRMED";
  const hasVerified = Boolean(afterExperiment && isHypothesisVerified);

  const isAgentInvestigating = agentState?.status === "investigating";
  const isAgentApproval = agentState?.status === "approval";

  // Dynamic instruction & rationale derived from actual hypothesis state
  const interventionTitle =
    hypothesis?.description ||
    "Move relay power from shared 3.3 V rail to external 5 V.";
  const rootCauseText =
    hypothesis?.rationale ||
    hypothesis?.description ||
    "The relay coil draws peak inrush current from the same voltage regulator feeding the microcontroller. Moving the jumper to the 5 V auxiliary rail eliminates the supply collapse.";

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        background: "var(--ohmni-canvas)",
        color: "var(--ohmni-ink)",
        overflowY: "auto",
      }}
    >
      {/* Shared application navigation shell */}
      <header
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
        {/* Left: Flat Brand Logo + Hardware Identity */}
        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          <div id="navbar-brand-wordmark" data-testid="navbar-brand-wordmark">
            <img src="/brand/ohmni-logo.svg" alt="OHMNI" style={{ height: "26px", width: "auto" }} />
          </div>
          <div style={{ height: "16px", width: "1px", background: "var(--ohmni-lab-border, #E2E4E9)" }} />
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span
              aria-hidden="true"
              style={{
                width: "7px",
                height: "7px",
                borderRadius: "50%",
                background: "var(--ohmni-lab-verified, #27966B)",
                boxShadow: "0 0 8px rgba(39, 150, 107, 0.5)",
              }}
            />
            <span className="font-mono" style={{ fontSize: "12.5px", fontWeight: 700, color: "var(--ohmni-lab-text, #0F172A)" }}>
              ESP32-S3 Environmental Controller (Virtual)
            </span>
          </div>
        </div>

        {/* Center: OBSERVE -> TEST -> DIAGNOSE -> REPAIR -> VERIFY */}
        <div
          id="investigation-progress-strip"
          data-testid="investigation-progress-strip"
          style={{ display: "flex", alignItems: "center", gap: "8px" }}
        >
          {(["OBSERVE", "TEST", "DIAGNOSE", "REPAIR", "VERIFY"] as const).map((phase, index) => {
            const isActive = phase === "REPAIR";
            return (
              <React.Fragment key={phase}>
                {index > 0 && <span style={{ color: "var(--ohmni-lab-border, #CBD5E1)", fontSize: "11px" }}>→</span>}
                <span
                  data-phase={phase}
                  data-active={isActive}
                  style={{
                    padding: "3px 9px",
                    borderRadius: "var(--radius-full, 9999px)",
                    fontSize: "11px",
                    fontWeight: isActive ? 800 : 600,
                    letterSpacing: "0.04em",
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

        {/* Right: Native WebMCP (if native), Provider Badge, Return to Investigation */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          {isNativeMode && (
            <span
              data-testid="webmcp-mode-badge"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
                padding: "3px 9px",
                borderRadius: "var(--radius-full, 9999px)",
                background: "rgba(39, 150, 107, 0.08)",
                border: "1px solid rgba(39, 150, 107, 0.25)",
                color: "var(--ohmni-lab-verified, #27966B)",
                fontSize: "11px",
                fontWeight: 600,
              }}
            >
              <ShieldCheck size={12} />
              <span>Native WebMCP</span>
            </span>
          )}

          <span
            data-testid={agentState?.agentMode === "demo" ? "demo-provider-badge" : "groq-provider-badge"}
            data-provider-badge="true"
            id="provider-badge"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "4px 11px",
              borderRadius: "var(--radius-full, 9999px)",
              background: agentState?.agentMode === "demo" ? "rgba(73, 103, 255, 0.08)" : "rgba(39, 150, 107, 0.08)",
              border: agentState?.agentMode === "demo" ? "1px solid rgba(73, 103, 255, 0.25)" : "1px solid rgba(39, 150, 107, 0.25)",
              color: agentState?.agentMode === "demo" ? "var(--ohmni-lab-brand, #4967FF)" : "var(--ohmni-lab-verified, #27966B)",
              fontSize: "11.5px",
              fontWeight: 700,
              letterSpacing: "0.02em",
            }}
          >
            <Bot size={13} />
            <span>{agentState?.agentMode === "demo" ? "Demo Agent" : `${agentIdentity.displayName} Live`}</span>
          </span>

          <button
            type="button"
            onClick={onReturnToInvestigation}
            className="btn-secondary"
            style={{ padding: "8px 14px", fontSize: "13px", fontWeight: 600 }}
          >
            Return to Investigation
          </button>
        </div>
      </header>

      {/* Main Repair Canvas */}
      <main
        style={{
          flex: 1,
          maxWidth: "1160px",
          margin: "0 auto",
          padding: "2.5rem 2rem 4rem",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          gap: "2.5rem",
        }}
      >
        {/* Agent Human Intervention Guidance Card */}
        <div
          style={{
            background: "var(--ohmni-surface)",
            border: "1.5px solid var(--ohmni-brand)",
            borderRadius: "var(--radius-xl)",
            padding: "2rem",
            boxShadow: "var(--shadow-md)",
            display: "grid",
            gridTemplateColumns: "1.2fr 1fr",
            gap: "2.5rem",
            alignItems: "center",
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "var(--ohmni-brand)", fontSize: "12.5px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              <Wrench size={15} />
              THE AGENT NEEDS YOUR HANDS
            </div>

            <h2 style={{ fontSize: "28px", fontWeight: 800, color: "var(--ohmni-ink)", margin: "8px 0 12px", lineHeight: 1.2 }}>
              Move JP1: Shared 3.3 V → Independent 5 V
            </h2>

            <p className="body-text" style={{ fontSize: "15px", lineHeight: 1.6, margin: 0 }}>
              <strong>Why:</strong> {rootCauseText}
            </p>
          </div>

          {/* Interactive Hardware Jumper Card */}
          <div
            style={{
              background: "var(--ohmni-lab-dark, #0D1118)",
              borderRadius: "var(--radius-lg)",
              padding: "1.5rem",
              display: "flex",
              flexDirection: "column",
              gap: "1rem",
              alignItems: "center",
              textAlign: "center",
            }}
          >
            <div className="font-mono" style={{ fontSize: "12px", fontWeight: 700, color: "#94A3B8" }}>
              PHYSICAL JUMPER JP1 SELECTOR
            </div>

            {/* Visual Jumper Toggle */}
            <div
              role="radiogroup"
              aria-label="Physical Jumper Position"
              tabIndex={0}
              onKeyDown={handleJumperKeyDown}
              style={{ display: "flex", gap: "12px", alignItems: "center" }}
            >
              <button
                role="radio"
                aria-checked={jumperPosition === "3V3"}
                onClick={() => handleSelectJumper("3V3")}
                style={{
                  background: jumperPosition === "3V3" ? "var(--ohmni-fault)" : "#1E293B",
                  color: "#FFFFFF",
                  border: "none",
                  padding: "10px 18px",
                  borderRadius: "var(--radius-md)",
                  fontSize: "14px",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Shared 3.3 V
              </button>

              <span style={{ color: "#64748B", fontSize: "16px" }}>→</span>

              <button
                role="radio"
                aria-checked={jumperPosition === "5V"}
                onClick={() => handleSelectJumper("5V")}
                style={{
                  background: jumperPosition === "5V" ? "var(--ohmni-brand)" : "#1E293B",
                  color: "#FFFFFF",
                  border: "none",
                  padding: "10px 18px",
                  borderRadius: "var(--radius-md)",
                  fontSize: "14px",
                  fontWeight: 700,
                  cursor: "pointer",
                  boxShadow: jumperPosition === "5V" ? "0 0 16px rgba(85, 112, 255, 0.4)" : "none",
                }}
              >
                Independent 5 V
              </button>
            </div>

            <div style={{ fontSize: "12px", color: jumperPosition === "5V" ? "#E2E8F0" : "#94A3B8" }}>
              {jumperPosition === "5V"
                ? "PHYSICAL CONFIGURATION CHANGED • Verification required."
                : "Jumper connected to shared 3.3V microcontroller rail."}
            </div>

            {/* Agent-driven Continuation / Approval Section */}
            {jumperPosition === "5V" && (
              <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: "8px", marginTop: "4px" }}>
                {hasVerified ? (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "8px",
                      background: "rgba(37, 138, 96, 0.2)",
                      color: "var(--ohmni-success)",
                      border: "1px solid var(--ohmni-success)",
                      padding: "8px 16px",
                      borderRadius: "var(--radius-md)",
                      fontSize: "12px",
                      fontWeight: 700,
                    }}
                  >
                    <CheckCircle2 size={14} />
                    <span>Empirically Verified by Bench Agent (VERIFIED)</span>
                  </div>
                ) : isAgentApproval ? (
                  /* Amber Safety Authorization Gate requested by Gemini */
                  <div
                    style={{
                      background: "rgba(244, 184, 96, 0.12)",
                      border: "1px solid var(--ohmni-warning)",
                      borderRadius: "var(--radius-md)",
                      padding: "10px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "8px",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "var(--ohmni-warning)", fontSize: "12px", fontWeight: 700 }}>
                      <ShieldAlert size={14} />
                      <span>{agentIdentity.displayName} Requested Retest: {agentState?.approval?.tool.name}</span>
                    </div>
                    <div style={{ display: "flex", gap: "8px", justifyContent: "center" }}>
                      <button
                        onClick={onApproveTest}
                        className="btn-primary"
                        data-testid="repair-approve-btn"
                        style={{
                          background: "var(--ohmni-warning)",
                          borderColor: "var(--ohmni-warning)",
                          color: "#000000",
                          fontSize: "12px",
                          fontWeight: 700,
                          padding: "6px 14px",
                        }}
                      >
                        Authorize & Energize
                      </button>
                      <button
                        type="button"
                        onClick={onDenyTest}
                        className="btn-secondary"
                        data-testid="repair-deny-btn"
                        style={{
                          background: "#FFFFFF",
                          color: "#0F172A",
                          border: "1px solid #CBD5E1",
                          padding: "6px 14px",
                          fontWeight: 600,
                          fontSize: "12px",
                        }}
                      >
                        Deny retest
                      </button>
                    </div>
                  </div>
                ) : isAgentInvestigating ? (
                  /* Agent actively running retest / reading evidence */
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "8px",
                      background: "rgba(85, 112, 255, 0.15)",
                      color: "var(--ohmni-brand)",
                      border: "1px solid var(--ohmni-brand)",
                      padding: "8px 16px",
                      borderRadius: "var(--radius-md)",
                      fontSize: "12px",
                      fontWeight: 700,
                    }}
                  >
                    <Activity size={14} className="animate-spin" />
                    <span>{agentIdentity.displayName} is evaluating physical repair & executing verification...</span>
                  </div>
                ) : (
                  /* Human Observation CTA: Tell Gemini I changed it */
                  <button
                    onClick={handleNotifyAgent}
                    className="btn-primary"
                    data-testid="tell-agent-repair-btn"

                    id="tell-agent-repair-btn"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "8px",
                      background: "var(--ohmni-brand)",
                      color: "#FFFFFF",
                      border: "none",
                      padding: "10px 18px",
                      borderRadius: "var(--radius-md)",
                      fontWeight: 700,
                      cursor: "pointer",
                      boxShadow: "0 0 12px rgba(85, 112, 255, 0.4)",
                    }}
                  >
                    <Send size={14} />
                    <span>Tell {agentIdentity.displayName} I've changed it</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* The Money Shot: Split-Scope Before vs After Comparison */}
        <div>
          <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--ohmni-secondary)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "12px" }}>
            Split-Screen Verification • Before vs After
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "1.5rem",
            }}
          >
            {/* BEFORE: Brownout */}
            <div
              style={{
                background: "var(--ohmni-surface-dark)",
                borderRadius: "var(--radius-xl)",
                padding: "1.5rem",
                display: "flex",
                flexDirection: "column",
                gap: "1rem",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span className="font-mono" style={{ fontSize: "13px", fontWeight: 800, color: "#F43F5E" }}>
                  BEFORE REPAIR (Shared 3.3V Rail)
                </span>
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: 800,
                    padding: "2px 8px",
                    borderRadius: "var(--radius-full)",
                    background: "rgba(244, 63, 94, 0.2)",
                    color: "#F43F5E",
                  }}
                >
                  Brownout reset
                </span>
              </div>

              <div style={{ height: "140px", display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
                <svg viewBox="0 0 300 120" style={{ width: "100%", height: "100%" }}>
                  <line x1="20" y1="60" x2="280" y2="60" stroke="#F59E0B" strokeWidth="1" strokeDasharray="3 3" />
                  <text x="280" y="55" textAnchor="end" fill="#F59E0B" fontSize="9" fontFamily="var(--font-mono)">2.80 V reset threshold</text>
                  <path d="M 20 40 L 90 40 L 140 95 L 180 95 L 230 40 L 280 40" fill="none" stroke="#F43F5E" strokeWidth="2.5" />
                  <circle cx="160" cy="95" r="4" fill="#F43F5E" />
                  <text x="160" y="112" textAnchor="middle" fill="#F43F5E" fontSize="10" fontFamily="var(--font-mono)" fontWeight="700">
                    MIN {beforeMinVoltage !== undefined ? `${beforeMinVoltage.toFixed(2)} V` : "-- V"}
                  </text>
                </svg>
              </div>

              <div style={{ fontSize: "12.5px", color: "#94A3B8", textAlign: "center" }}>
                {typeof beforeExperiment?.summary?.message === "string"
                  ? beforeExperiment.summary.message
                  : "Relay actuation draws excessive inrush current on shared rail, breaching brownout threshold."}
              </div>
            </div>

            {/* AFTER: Verification Scope */}
            <div
              style={{
                background: "var(--ohmni-surface-dark)",
                borderRadius: "var(--radius-xl)",
                padding: "1.5rem",
                display: "flex",
                flexDirection: "column",
                gap: "1rem",
                border: hasVerified ? "1.5px solid var(--ohmni-success)" : "1px dashed #334155",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span className="font-mono" style={{ fontSize: "13px", fontWeight: 800, color: hasVerified ? "#22D3EE" : "#94A3B8" }}>
                  AFTER REPAIR (Independent 5 V supply)
                </span>
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: 800,
                    padding: "2px 8px",
                    borderRadius: "var(--radius-full)",
                    background: hasVerified ? "rgba(37, 138, 96, 0.2)" : "rgba(148, 163, 184, 0.1)",
                    color: hasVerified ? "#258A60" : "#94A3B8",
                  }}
                >
                  {hasVerified ? "STABLE • VERIFIED" : "PENDING RETEST"}
                </span>
              </div>

              <div style={{ height: "140px", display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
                {hasVerified && afterMinVoltage !== undefined ? (
                  <svg viewBox="0 0 300 120" style={{ width: "100%", height: "100%" }}>
                    <line x1="20" y1="60" x2="280" y2="60" stroke="#F59E0B" strokeWidth="1" strokeDasharray="3 3" />
                    <text x="280" y="55" textAnchor="end" fill="#F59E0B" fontSize="9" fontFamily="var(--font-mono)">2.80 V reset threshold</text>
                    <path d="M 20 40 L 90 40 L 140 46 L 180 46 L 230 40 L 280 40" fill="none" stroke="#22D3EE" strokeWidth="2.5" />
                    <circle cx="160" cy="46" r="4" fill="#22D3EE" />
                    <text x="160" y="32" textAnchor="middle" fill="#22D3EE" fontSize="10" fontFamily="var(--font-mono)" fontWeight="700">
                      MIN {afterMinVoltage.toFixed(2)} V
                    </text>
                  </svg>
                ) : (
                  <div style={{ color: "#64748B", fontSize: "13px", textAlign: "center" }}>
                    Awaiting empirical verification stress test on 5.0 V rail...
                  </div>
                )}
              </div>

              <div style={{ fontSize: "12.5px", color: "#94A3B8", textAlign: "center" }}>
                {hasVerified
                  ? (typeof afterExperiment?.summary?.message === "string"
                      ? afterExperiment.summary.message
                      : "Supply remains securely above reset threshold during full fan actuation.")
                  : "Move jumper and notify Bench Agent to record empirical verification telemetry."}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
