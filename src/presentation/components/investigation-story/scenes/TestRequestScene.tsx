/**
 * Scene 2 — Controlled Physical Test Request & Human Approval Interlock.
 * Milestone 7.14 — Physical Focus & Full Canvas Participation.
 *
 * Requirements:
 * - data-scene="approval" for state assertion
 * - Split canvas: Left 55% physical schematic/board focus, Right 45% safety envelope & decision
 * - Main headline: "Agent wants to stress-test the relay."
 * - Explicit action bullets:
 *     • energize relay briefly
 *     • watch the MCU rail
 *     • abort immediately on reset
 * - Safety envelope: Maximum actuation: 500 ms, Auto-abort on reset, Live voltage monitoring
 * - Small developer metadata: run_relay_stress_test
 * - Single pair of buttons: [ Deny ] and [ Approve test ]
 */

import React, { useState } from "react";
import { motion } from "motion/react";
import { ShieldAlert, Check, X, Zap, Clock, Activity, AlertTriangle } from "lucide-react";
import gsap from "gsap";
import type { ToolApprovalRequest } from "@/domain/safety/approval-gate";

export interface TestRequestSceneProps {
  readonly onApprove: () => void;
  readonly onDeny: () => void;
  readonly toolName?: string;
  readonly agentDisplayName?: string;
  readonly approvalRequest?: ToolApprovalRequest | null;
}

export const TestRequestScene: React.FC<TestRequestSceneProps> = ({
  onApprove,
  onDeny,
  toolName = "run_relay_stress_test",
  approvalRequest,
}) => {
  const [isApproved, setIsApproved] = useState(false);

  const handleApproveClick = () => {
    setIsApproved(true);
    onApprove();
    gsap.to("#approve-btn-inner", {
      scale: 1.05,
      yoyo: true,
      repeat: 1,
      duration: 0.15,
    });
  };

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
        return;
      }
      if (e.key === "a" || e.key === "A") {
        e.preventDefault();
        handleApproveClick();
      } else if (e.key === "d" || e.key === "D") {
        e.preventDefault();
        onDeny();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onDeny]);


  return (
    <motion.div
      data-scene="approval"
      data-testid="bench-agent-approval"
      id="test-request-scene"
      initial={{ opacity: 1 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        minHeight: "560px",
        gap: "1.25rem",
        color: "var(--ohmni-lab-text)",
      }}
    >
      {/* Top Banner Tag */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "7px",
            padding: "4px 12px",
            borderRadius: "var(--radius-sm, 6px)",
            background: "rgba(217, 119, 6, 0.10)",
            border: "1px solid rgba(217, 119, 6, 0.25)",
            fontSize: "11.5px",
            fontWeight: 700,
            color: "var(--approval, #D97706)",
            letterSpacing: "0.04em",
          }}
        >
          <ShieldAlert size={14} />
          <span>SAFETY INTERLOCK · HUMAN AUTHORIZATION REQUIRED</span>
        </div>

        <div className="font-mono" style={{ fontSize: "11px", color: "var(--ink-tertiary, #8A92A0)" }}>
          Instrument: <span style={{ color: "var(--ink, #111318)", fontWeight: 600 }}>{toolName}</span>
        </div>
      </div>

      {/* Main Split Grid (55% Physical Diagram / 45% Safety & Action) */}
      <div
        data-testid="bench-agent-approval"
        style={{
          flex: 1,
          display: "grid",
          gridTemplateColumns: "1.2fr 1fr",
          gap: "1.5rem",
          minHeight: "440px",
          background: "var(--ohmni-lab-raised)",
          border: "1.5px solid var(--ohmni-lab-action)",
          borderRadius: "var(--radius-xl)",
          padding: "1.75rem",
          boxShadow: "0 8px 32px rgba(255, 181, 74, 0.12)",
          alignItems: "stretch",
        }}
      >
        {/* Left 55%: Physical Hardware & Relay Schematics Diagram */}
        <div
          style={{
            background: "#0D1118",
            border: "1px solid #1E293B",
            borderRadius: "var(--radius-lg)",
            padding: "1.5rem",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            position: "relative",
            overflow: "hidden",
          }}
        >
          {/* Subtle PCB Grid background */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              backgroundImage: "radial-gradient(#26334D 1px, transparent 1px)",
              backgroundSize: "20px 20px",
              opacity: 0.45,
              pointerEvents: "none",
            }}
          />

          {/* Diagram Header */}
          <div style={{ position: "relative", zIndex: 2, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <Zap size={15} color="var(--ohmni-lab-action)" />
              <span className="font-mono" style={{ fontSize: "11px", fontWeight: 700, color: "#94A3B8", textTransform: "uppercase" }}>
                VIRTUAL DUT INTERVENTION: RELAY & 3V3 RAIL
              </span>
            </div>
            <div
              className="font-mono"
              style={{
                fontSize: "10px",
                padding: "3px 8px",
                borderRadius: "4px",
                background: isApproved ? "rgba(39, 150, 107, 0.2)" : "rgba(255, 181, 74, 0.15)",
                color: isApproved ? "#27966B" : "var(--ohmni-lab-action)",
                fontWeight: 700,
              }}
            >
              {isApproved ? "ENERGIZING" : "ARMED"}
            </div>
          </div>

          {/* Interactive Relay Armature & Fan Load SVG Diagram */}
          <div
            id="relay-module-group"
            data-testid="relay-module-group"
            data-relay-state={isApproved ? "closed" : "open"}
            style={{
              position: "relative",
              zIndex: 2,
              width: "100%",
              height: "220px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "1rem 0",
            }}
          >
            <svg viewBox="0 0 460 220" style={{ width: "100%", height: "100%", maxHeight: "220px" }}>
              {/* MCU Node Box */}
              <rect x="20" y="50" width="100" height="120" rx="8" fill="#151D2A" stroke="#334155" strokeWidth="1.5" />
              <text x="70" y="85" fill="#94A3B8" fontSize="11" fontFamily="monospace" fontWeight="bold" textAnchor="middle">ESP32-S3</text>
              <circle cx="70" cy="115" r="8" fill="#4967FF" />
              <text x="70" y="145" fill="#64748B" fontSize="9" fontFamily="monospace" textAnchor="middle">3.3V MCU</text>

              {/* 3.3V Power Bus Trace */}
              <path
                d="M 120 115 L 200 115"
                stroke={isApproved ? "#DC5050" : "#4967FF"}
                strokeWidth="3.5"
                strokeDasharray={isApproved ? "4 4" : "none"}
                fill="none"
              />
              <text x="160" y="105" fill="#94A3B8" fontSize="9" fontFamily="monospace" textAnchor="middle">3.3V Rail</text>

              {/* Relay Module Box */}
              <rect
                x="200"
                y="35"
                width="130"
                height="150"
                rx="8"
                fill={isApproved ? "rgba(255, 181, 74, 0.12)" : "#131924"}
                stroke={isApproved ? "var(--ohmni-lab-action)" : "#475569"}
                strokeWidth="2"
              />
              <text x="265" y="60" fill="var(--ohmni-lab-action)" fontSize="11" fontFamily="monospace" fontWeight="bold" textAnchor="middle">
                RELAY (GPIO14)
              </text>

              {/* Contacts */}
              <circle cx="230" cy="115" r="5" fill="#D4AF37" />
              <circle cx="300" cy="85" r="5" fill="#D4AF37" />
              <circle cx="300" cy="145" r="5" fill="#D4AF37" />
              <text x="312" y="88" fill="#64748B" fontSize="8" fontFamily="monospace">NO</text>
              <text x="312" y="148" fill="#64748B" fontSize="8" fontFamily="monospace">NC</text>

              {/* Armature Lever */}
              <line
                id="relay-armature-lever"
                data-testid="relay-armature-lever"
                data-relay-state={isApproved ? "closed" : "open"}
                x1="230"
                y1="115"
                x2={isApproved ? "296" : "295"}
                y2={isApproved ? "87" : "142"}
                stroke={isApproved ? "var(--ohmni-lab-action)" : "#F5F7FA"}
                strokeWidth="4"
                strokeLinecap="round"
              />

              {/* Fan Trace */}
              <path
                d="M 300 85 L 370 85"
                stroke={isApproved ? "var(--ohmni-lab-action)" : "#334155"}
                strokeWidth="2.5"
                fill="none"
              />

              {/* Fan Motor Box */}
              <rect x="370" y="50" width="70" height="120" rx="8" fill="#151D2A" stroke="#334155" strokeWidth="1.5" />
              <text x="405" y="80" fill="#94A3B8" fontSize="10" fontFamily="monospace" fontWeight="bold" textAnchor="middle">12V FAN</text>
              {/* Spinning Fan Blades in SVG */}
              <g transform="translate(405, 120)">
                <circle cx="0" cy="0" r="18" fill="none" stroke="#475569" strokeWidth="1" />
                <path
                  d="M -12 0 C -6 -10, 6 -10, 12 0 C 6 10, -6 10, -12 0"
                  fill={isApproved ? "var(--ohmni-lab-action)" : "#64748B"}
                >
                  {isApproved && (
                    <animateTransform
                      attributeName="transform"
                      type="rotate"
                      from="0"
                      to="360"
                      dur="0.25s"
                      repeatCount="indefinite"
                    />
                  )}
                </path>
              </g>
            </svg>
          </div>

          {/* Diagram Footer Status */}
          <div style={{ position: "relative", zIndex: 2, display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "11px", color: "#64748B" }}>
            <span>Relay coil: <strong style={{ color: "var(--ohmni-lab-action)" }}>MCU supply rail</strong></span>
            <span>Load: <strong style={{ color: "#94A3B8" }}>12V cooling fan</strong></span>
          </div>
        </div>

        {/* Right 45%: Safety Explanation, Safety Envelope & Actions */}
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", gap: "1rem" }}>
          <div>
            <h2
              style={{
                fontSize: "22px",
                fontWeight: 750,
                color: "var(--ink, #111318)",
                margin: "0 0 14px",
                letterSpacing: "-0.02em",
                lineHeight: 1.3,
              }}
            >
              Your agent wants to run a controlled load test
            </h2>

            {/* Purpose */}
            <div style={{ margin: "10px 0" }}>
              <div style={{ fontSize: "11.5px", fontWeight: 700, color: "var(--ink-secondary, #5C6470)", marginBottom: "4px" }}>
                Purpose:
              </div>
              <p style={{ margin: 0, fontSize: "14px", color: "var(--ink, #111318)", lineHeight: 1.5 }}>
                See whether relay activation collapses the MCU supply.
              </p>
            </div>

            {/* What will happen */}
            <div style={{ margin: "14px 0" }}>
              <div style={{ fontSize: "11.5px", fontWeight: 700, color: "var(--ink-secondary, #5C6470)", marginBottom: "6px" }}>
                What will happen:
              </div>
              <ul style={{ margin: 0, paddingLeft: "1.25rem", fontSize: "13.5px", color: "var(--ink, #111318)", lineHeight: 1.6 }}>
                <li>Relay energizes briefly</li>
                <li>Supply voltage is measured</li>
                <li>Test stops immediately if the MCU resets</li>
              </ul>
            </div>

            {/* Safety envelope */}
            <div
              style={{
                background: "rgba(217, 119, 6, 0.05)",
                border: "1px solid rgba(217, 119, 6, 0.20)",
                borderRadius: "var(--radius-md, 10px)",
                padding: "0.85rem 1rem",
                display: "flex",
                flexDirection: "column",
                gap: "6px",
                marginTop: "12px",
              }}
            >
              <div className="font-mono" style={{ fontSize: "11px", fontWeight: 750, color: "var(--approval, #D97706)", letterSpacing: "0.04em" }}>
                Safety envelope:
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", color: "var(--ink, #111318)" }}>
                <Clock size={14} color="var(--approval, #D97706)" />
                <span>Maximum actuation: 500 ms</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", color: "var(--ink, #111318)" }}>
                <AlertTriangle size={14} color="var(--approval, #D97706)" />
                <span>Auto-abort on reset</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", color: "var(--ink, #111318)" }}>
                <Activity size={14} color="var(--verified, #16A34A)" />
                <span>Relay returns open automatically</span>
              </div>
            </div>

            <div className="font-mono" style={{ marginTop: "8px", fontSize: "11px", color: "var(--ink-tertiary, #8A92A0)" }}>
              Technical name: <span style={{ color: "var(--ink-secondary, #5C6470)" }}>{toolName}</span>
            </div>
          </div>

          {/* Single Action Controls */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-end",
              gap: "12px",
              paddingTop: "1rem",
              borderTop: "1px solid var(--ohmni-lab-border)",
            }}
          >
            <button
              data-testid="bench-agent-deny"
              id="deny-test-btn"
              onClick={onDeny}
              className="btn-secondary"
              style={{
                borderColor: "var(--ohmni-lab-border)",
                color: "var(--ohmni-lab-text)",
                padding: "10px 18px",
                fontSize: "13px",
                fontWeight: 600,
              }}
            >
              <X size={14} />
              <span>Deny [D]</span>
            </button>

            <button
              data-testid="bench-agent-approve"
              id="approve-test-btn"
              onClick={handleApproveClick}
              disabled={isApproved}
              className="btn-primary"
              style={{
                background: isApproved ? "var(--ohmni-lab-verified)" : "var(--ohmni-lab-action)",
                color: "#090B10",
                fontWeight: 800,
                fontSize: "13.5px",
                padding: "10px 22px",
                boxShadow: "0 0 20px rgba(255, 181, 74, 0.35)",
              }}
            >
              <div id="approve-btn-inner" style={{ display: "flex", alignItems: "center", gap: "7px" }}>
                <Check size={16} />
                <span>{isApproved ? "APPROVED" : "Approve test [A]"}</span>
              </div>
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
};
