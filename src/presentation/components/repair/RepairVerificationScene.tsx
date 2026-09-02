/**
 * State 3 — Human Intervention & Repair Verification Scene.
 * Full focus shift for physical repair action:
 * - Large hardware diagram with interactive jumper (3.3V -> 5V external power).
 * - Agent dialogue: "I need your hands. Move relay power from the shared 3.3 V rail to external 5 V."
 * - Split-scope comparison:
 *     BEFORE: 2.72 V — BROWNOUT (Collapsed)
 *     AFTER:  3.18 V — STABLE (Nominal Health)
 */

import React, { useState } from "react";
import { motion } from "motion/react";
import { Wrench, CheckCircle2, Zap, ArrowRight, ShieldCheck, Activity, RotateCcw } from "lucide-react";

export interface RepairVerificationSceneProps {
  readonly onReturnToInvestigation: () => void;
}

export const RepairVerificationScene: React.FC<RepairVerificationSceneProps> = ({
  onReturnToInvestigation,
}) => {
  const [jumperPosition, setJumperPosition] = useState<"3V3" | "5V">("3V3");
  const isRepaired = jumperPosition === "5V";

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
      {/* Header */}
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "1rem 2.5rem",
          background: "var(--ohmni-surface)",
          borderBottom: "1px solid var(--ohmni-border)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <img
            src="/brand/ohmni-logo.svg"
            alt="OHMNI"
            style={{ height: "28px", width: "auto" }}
          />
          <div style={{ height: "16px", width: "1px", background: "var(--ohmni-border)" }} />
          <span style={{ fontSize: "14px", fontWeight: 700, color: "var(--ohmni-ink)" }}>
            Physical Repair & Split-Scope Verification
          </span>
        </div>

        <button
          onClick={onReturnToInvestigation}
          className="btn-secondary"
          style={{
            padding: "8px 14px",
            fontSize: "13px",
            fontWeight: 600,
          }}
        >
          Return to Investigation
        </button>
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
            <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "var(--ohmni-brand)", fontSize: "13px", fontWeight: 700, textTransform: "uppercase" }}>
              <Wrench size={15} />
              Human Physical Intervention
            </div>

            <h2 style={{ fontSize: "28px", fontWeight: 800, color: "var(--ohmni-ink)", margin: "8px 0 12px", lineHeight: 1.2 }}>
              "I need your hands. Move relay power from the shared 3.3 V rail to external 5 V."
            </h2>

            <p className="body-text" style={{ fontSize: "15px", lineHeight: 1.6, margin: 0 }}>
              <strong>Root Cause:</strong> The relay coil draws peak inrush current from the same voltage regulator feeding the ESP32-S3 microcontroller. Moving the jumper isolator to the 5 V auxiliary rail eliminates the supply sag.
            </p>
          </div>

          {/* Interactive Hardware Jumper Card */}
          <div
            style={{
              background: "var(--ohmni-surface-dark)",
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
            <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
              <button
                onClick={() => setJumperPosition("3V3")}
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
                3.3 V (Faulty)
              </button>

              <span style={{ color: "#64748B", fontSize: "16px" }}>→</span>

              <button
                onClick={() => setJumperPosition("5V")}
                style={{
                  background: jumperPosition === "5V" ? "var(--ohmni-success)" : "#1E293B",
                  color: "#FFFFFF",
                  border: "none",
                  padding: "10px 18px",
                  borderRadius: "var(--radius-md)",
                  fontSize: "14px",
                  fontWeight: 700,
                  cursor: "pointer",
                  boxShadow: jumperPosition === "5V" ? "0 0 16px rgba(37, 138, 96, 0.4)" : "none",
                }}
              >
                5.0 V (Repaired)
              </button>
            </div>

            <div style={{ fontSize: "12px", color: isRepaired ? "var(--ohmni-success)" : "#94A3B8" }}>
              {isRepaired ? "✓ Jumper set to External 5V Rail" : "Click 5.0 V to move jumper"}
            </div>
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
                  BEFORE REPAIR (3.3V Rail)
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
                  BROWNOUT
                </span>
              </div>

              <div style={{ height: "140px", display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
                <svg viewBox="0 0 300 120" style={{ width: "100%", height: "100%" }}>
                  <line x1="20" y1="60" x2="280" y2="60" stroke="#F59E0B" strokeWidth="1" strokeDasharray="3 3" />
                  <text x="280" y="55" textAnchor="end" fill="#F59E0B" fontSize="9" fontFamily="var(--font-mono)">2.80V SAFE LIMIT</text>
                  <path d="M 20 40 L 90 40 L 140 95 L 180 95 L 230 40 L 280 40" fill="none" stroke="#F43F5E" strokeWidth="2.5" />
                  <circle cx="160" cy="95" r="4" fill="#F43F5E" />
                  <text x="160" y="112" textAnchor="middle" fill="#F43F5E" fontSize="10" fontFamily="var(--font-mono)" fontWeight="700">MIN 2.72 V</text>
                </svg>
              </div>

              <div style={{ fontSize: "12.5px", color: "#94A3B8", textAlign: "center" }}>
                Relay actuation causes 590 mV collapse, breaching brownout threshold.
              </div>
            </div>

            {/* AFTER: Stable */}
            <div
              style={{
                background: "var(--ohmni-surface-dark)",
                borderRadius: "var(--radius-xl)",
                padding: "1.5rem",
                display: "flex",
                flexDirection: "column",
                gap: "1rem",
                border: isRepaired ? "1.5px solid var(--ohmni-success)" : "1px solid transparent",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span className="font-mono" style={{ fontSize: "13px", fontWeight: 800, color: "#22D3EE" }}>
                  AFTER REPAIR (5.0V Aux Rail)
                </span>
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: 800,
                    padding: "2px 8px",
                    borderRadius: "var(--radius-full)",
                    background: "rgba(37, 138, 96, 0.2)",
                    color: "#258A60",
                  }}
                >
                  STABLE • VERIFIED
                </span>
              </div>

              <div style={{ height: "140px", display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
                <svg viewBox="0 0 300 120" style={{ width: "100%", height: "100%" }}>
                  <line x1="20" y1="60" x2="280" y2="60" stroke="#F59E0B" strokeWidth="1" strokeDasharray="3 3" />
                  <text x="280" y="55" textAnchor="end" fill="#F59E0B" fontSize="9" fontFamily="var(--font-mono)">2.80V SAFE LIMIT</text>
                  <path d="M 20 40 L 90 40 L 140 46 L 180 46 L 230 40 L 280 40" fill="none" stroke="#22D3EE" strokeWidth="2.5" />
                  <circle cx="160" cy="46" r="4" fill="#22D3EE" />
                  <text x="160" y="32" textAnchor="middle" fill="#22D3EE" fontSize="10" fontFamily="var(--font-mono)" fontWeight="700">MIN 3.18 V</text>
                </svg>
              </div>

              <div style={{ fontSize: "12.5px", color: "#94A3B8", textAlign: "center" }}>
                Supply remains securely above safe limit during full fan actuation.
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
