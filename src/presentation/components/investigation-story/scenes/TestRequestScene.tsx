/**
 * Scene 2 — Controlled Physical Test Request & Human Approval Interlock.
 *
 * Requirements:
 * - Headline: "Gemini needs your approval."
 * - Subtext: "It wants to energize the fan relay while monitoring the MCU supply rail."
 * - Shows explicit execution safety bounds (500 ms max, auto-abort, live monitoring).
 * - On Approve: transforms to APPROVED, amber pulse travels to relay, armature snaps, fan spins.
 * - Uses GSAP timeline for tactile response.
 */

import React, { useState } from "react";
import { motion } from "motion/react";
import { ShieldAlert, Check, X, Zap, Clock, Activity, AlertTriangle } from "lucide-react";
import gsap from "gsap";

export interface TestRequestSceneProps {
  readonly onApprove: () => void;
  readonly onDeny: () => void;
  readonly toolName?: string;
}

export const TestRequestScene: React.FC<TestRequestSceneProps> = ({
  onApprove,
  onDeny,
  toolName = "run_relay_stress_test",
}) => {
  const [isApproved, setIsApproved] = useState(false);

  const handleApproveClick = () => {
    setIsApproved(true);
    onApprove();
    gsap.to("#approve-btn-inner", {
      scale: 0.95,
      duration: 0.1,
      yoyo: true,
      repeat: 1,
    });
  };
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "1.75rem",
        height: "100%",
        color: "var(--ohmni-lab-text)",
      }}
    >
      {/* Header Tag */}
      <div>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "7px",
            padding: "4px 10px",
            borderRadius: "var(--radius-full)",
            background: "rgba(255, 181, 74, 0.12)",
            border: "1px solid rgba(255, 181, 74, 0.25)",
            fontSize: "12px",
            fontWeight: 700,
            color: "var(--ohmni-lab-action)",
            letterSpacing: "0.05em",
          }}
        >
          <ShieldAlert size={14} />
          AMBER SAFETY GATE • HUMAN AUTHORIZATION
        </div>

        <h2 style={{ fontSize: "32px", fontWeight: 800, color: "var(--ohmni-lab-text)", margin: "8px 0 0", letterSpacing: "-0.02em" }}>
          Gemini needs your approval.
        </h2>

        <p style={{ margin: "6px 0 0", fontSize: "16px", color: "var(--ohmni-lab-muted)", maxWidth: "600px", lineHeight: 1.5 }}>
          It wants to energize the fan relay while monitoring the MCU supply rail.
        </p>
      </div>

      {/* Main Approval Card with Highlighted Relay */}
      <div
        style={{
          background: "var(--ohmni-lab-raised)",
          border: "1.5px solid var(--ohmni-lab-action)",
          borderRadius: "var(--radius-xl)",
          padding: "2rem",
          boxShadow: "0 0 32px rgba(255, 181, 74, 0.12)",
          display: "flex",
          flexDirection: "column",
          gap: "1.5rem",
        }}
      >
        {/* Relay Schematics & Intent */}
        <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: "2rem", alignItems: "center" }}>
          <div>
            <div className="font-mono" style={{ fontSize: "11px", fontWeight: 700, color: "var(--ohmni-lab-action)", textTransform: "uppercase" }}>
              TARGET INSTRUMENT CALL
            </div>
            <div className="font-mono" style={{ fontSize: "18px", fontWeight: 800, color: "var(--ohmni-lab-text)", marginTop: "4px" }}>
              {toolName}
            </div>
            <p style={{ fontSize: "14px", color: "var(--ohmni-lab-muted)", lineHeight: 1.5, marginTop: "8px" }}>
              Controlled physical actuation of the 12V cooling fan relay to test for inductive inrush current collapse on the shared 3.3V power bus.
            </p>
          </div>

          {/* Safety Bounds Box */}
          {/* Safety Bounds & Target Relay Preview */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 140px",
              gap: "12px",
              background: "var(--ohmni-lab-soft-raised)",
              border: "1px solid var(--ohmni-lab-border)",
              borderRadius: "var(--radius-lg)",
              padding: "1rem 1.25rem",
              alignItems: "center",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <div className="font-mono" style={{ fontSize: "11px", fontWeight: 700, color: "var(--ohmni-lab-text)", textTransform: "uppercase" }}>
                CONTROLLED SAFETY ENVELOPE
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12.5px", color: "var(--ohmni-lab-muted)" }}>
                <Clock size={13} color="var(--ohmni-lab-action)" />
                <span>500 ms maximum actuation</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12.5px", color: "var(--ohmni-lab-muted)" }}>
                <AlertTriangle size={13} color="var(--ohmni-lab-fault)" />
                <span>Automatic abort on reset</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12.5px", color: "var(--ohmni-lab-muted)" }}>
                <Activity size={13} color="var(--ohmni-lab-signal)" />
                <span>Live voltage monitoring</span>
              </div>
            </div>

            {/* Relay Armature Open State Preview */}
            <div
              id="relay-module-group"
              data-testid="relay-module-group"
              data-relay-state={isApproved ? "closed" : "open"}
              style={{
                background: "var(--ohmni-lab-canvas)",
                border: "1px solid var(--ohmni-lab-border)",
                borderRadius: "var(--radius-md)",
                padding: "6px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
              }}
            >
              <svg viewBox="0 0 160 120" style={{ width: "100%", height: "70px" }}>
                <rect x="20" y="30" width="40" height="50" rx="4" fill={isApproved ? "rgba(255, 181, 74, 0.2)" : "#1E293B"} stroke={isApproved ? "var(--ohmni-lab-action)" : "#475569"} strokeWidth="1.5" />
                <circle cx="85" cy="55" r="4" fill="#D4AF37" />
                <circle cx="130" cy="35" r="4" fill="#D4AF37" />
                <circle cx="130" cy="75" r="4" fill="#D4AF37" />
                <line
                  id="relay-armature-lever"
                  data-testid="relay-armature-lever"
                  data-relay-state={isApproved ? "closed" : "open"}
                  x1="85"
                  y1="55"
                  x2={isApproved ? "128" : "126"}
                  y2={isApproved ? "36" : "70"}
                  stroke={isApproved ? "var(--ohmni-lab-action)" : "#F5F7FA"}
                  strokeWidth="3.5"
                  strokeLinecap="round"
                />
              </svg>
              <span className="font-mono" style={{ fontSize: "9px", color: isApproved ? "var(--ohmni-lab-action)" : "#94A3B8" }}>
                {isApproved ? "ENERGIZING" : "ARMED"}
              </span>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "12px", paddingTop: "1rem", borderTop: "1px solid var(--ohmni-lab-border)" }}>
          <button
            data-testid="deny-test-btn"
            id="deny-test-btn"
            onClick={onDeny}
            className="btn-secondary"
            style={{
              borderColor: "var(--ohmni-lab-border)",
              color: "var(--ohmni-lab-text)",
              padding: "10px 20px",
            }}
          >
            <X size={15} />
            <span>Deny [D]</span>
          </button>

          <button
            data-testid="approve-test-btn"
            id="approve-test-btn"
            onClick={handleApproveClick}
            disabled={isApproved}
            className="btn-primary"
            style={{
              background: isApproved ? "var(--ohmni-lab-verified)" : "var(--ohmni-lab-action)",
              color: "#090B10",
              fontWeight: 800,
              padding: "10px 24px",
              boxShadow: "0 0 20px rgba(255, 181, 74, 0.35)",
            }}
          >
            <div id="approve-btn-inner" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <Check size={16} />
              <span>{isApproved ? "APPROVED" : "Approve test [A]"}</span>
            </div>
          </button>
        </div>
      </div>
    </motion.div>
  );
};
