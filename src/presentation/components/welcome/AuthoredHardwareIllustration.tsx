/**
 * Authored Hardware Illustration for Welcome Experience.
 * Warm-light modern industrial visual representing the ESP32-S3 board,
 * mechanical relay load, and live WebMCP instrumentation bridge.
 */

import React from "react";
import { motion, useReducedMotion } from "motion/react";
import { Cpu, Zap, Radio, Bot, ShieldAlert, Sparkles, Activity } from "lucide-react";

export const AuthoredHardwareIllustration: React.FC = () => {
  const shouldReduceMotion = useReducedMotion();

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        maxWidth: "520px",
        background: "var(--ohmni-surface)",
        border: "1px solid var(--ohmni-border)",
        borderRadius: "var(--radius-xl)",
        padding: "2rem",
        boxShadow: "var(--shadow-card)",
        display: "flex",
        flexDirection: "column",
        gap: "1.5rem",
      }}
    >
      {/* Top Spec Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: "1px solid var(--ohmni-border-subtle)",
          paddingBottom: "1rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span
            style={{
              width: "8px",
              height: "8px",
              borderRadius: "50%",
              background: "var(--ohmni-success)",
              boxShadow: "0 0 8px rgba(37, 138, 96, 0.4)",
            }}
          />
          <span className="font-mono" style={{ fontSize: "12px", fontWeight: 700, color: "var(--ohmni-ink)" }}>
            ESP32-S3 • DEV-01
          </span>
        </div>

        <span
          style={{
            fontSize: "11px",
            fontWeight: 600,
            padding: "3px 8px",
            borderRadius: "var(--radius-full)",
            background: "var(--ohmni-brand-subtle)",
            color: "var(--ohmni-brand)",
            border: "1px solid rgba(49, 92, 245, 0.15)",
          }}
        >
          13 WEBMCP INSTRUMENTS
        </span>
      </div>

      {/* SVG Board Circuit Visual */}
      <div
        style={{
          background: "var(--ohmni-surface-dark)",
          borderRadius: "var(--radius-lg)",
          padding: "1.25rem",
          position: "relative",
          overflow: "hidden",
          boxShadow: "inset 0 1px 3px rgba(0, 0, 0, 0.4)",
        }}
      >
        <svg
          viewBox="0 0 380 220"
          style={{
            width: "100%",
            height: "auto",
            display: "block",
          }}
        >
          <defs>
            <pattern id="board-grid" width="16" height="16" patternUnits="userSpaceOnUse">
              <circle cx="8" cy="8" r="0.75" fill="rgba(255, 255, 255, 0.08)" />
            </pattern>
          </defs>

          {/* Grid Background */}
          <rect width="380" height="220" fill="url(#board-grid)" rx="8" />

          {/* Gold Board Mounting Holes */}
          <circle cx="20" cy="20" r="4.5" fill="#0C1017" stroke="#E59A25" strokeWidth="1.5" />
          <circle cx="360" cy="20" r="4.5" fill="#0C1017" stroke="#E59A25" strokeWidth="1.5" />
          <circle cx="20" cy="200" r="4.5" fill="#0C1017" stroke="#E59A25" strokeWidth="1.5" />
          <circle cx="360" cy="200" r="4.5" fill="#0C1017" stroke="#E59A25" strokeWidth="1.5" />

          {/* 3.3V Power Trace */}
          <path
            d="M 140 90 L 190 90 L 190 140 L 240 140"
            stroke="var(--ohmni-scope-trace-bright)"
            strokeWidth="2.5"
            fill="none"
            opacity="0.8"
          />

          {/* GPIO14 Relay Control Trace */}
          <path
            d="M 140 120 L 200 120 L 200 125 L 240 125"
            stroke="var(--ohmni-warning)"
            strokeWidth="1.8"
            fill="none"
            opacity="0.7"
          />

          {/* ESP32-S3 SoC Chip */}
          <g transform="translate(30, 50)">
            <rect
              width="110"
              height="120"
              rx="6"
              fill="#1A212D"
              stroke="rgba(255, 255, 255, 0.15)"
              strokeWidth="1.5"
            />
            {/* Chip Die */}
            <rect x="20" y="30" width="70" height="60" rx="4" fill="#0C1017" stroke="rgba(56, 189, 248, 0.3)" />
            <text x="55" y="60" textAnchor="middle" fill="#FFFFFF" fontSize="10" fontFamily="var(--font-mono)" fontWeight="800">
              ESP32-S3
            </text>
            <text x="55" y="74" textAnchor="middle" fill="#94A3B8" fontSize="7" fontFamily="var(--font-mono)">
              WROOM-1 16MB
            </text>

            {/* LEDs */}
            <circle cx="25" cy="104" r="3" fill="#258A60" />
            <text x="32" y="106" fill="#94A3B8" fontSize="6.5" fontFamily="var(--font-mono)">PWR</text>
            <circle cx="65" cy="104" r="3" fill="#38BDF8" />
            <text x="72" y="106" fill="#94A3B8" fontSize="6.5" fontFamily="var(--font-mono)">SYS</text>
          </g>

          {/* Relay K1 Module */}
          <g transform="translate(235, 60)">
            <rect
              width="115"
              height="100"
              rx="6"
              fill="#1A212D"
              stroke="rgba(229, 154, 37, 0.5)"
              strokeWidth="1.5"
            />
            <text x="14" y="24" fill="#FFFFFF" fontSize="9" fontFamily="var(--font-mono)" fontWeight="700">
              RELAY K1
            </text>
            <text x="14" y="36" fill="#94A3B8" fontSize="7" fontFamily="var(--font-mono)">
              SRD-03VDC-SL-C
            </text>

            {/* Coil Symbol */}
            <path
              d="M 20 60 Q 28 48 36 60 Q 44 48 52 60 Q 60 48 68 60"
              stroke="#E59A25"
              strokeWidth="2"
              fill="none"
            />

            {/* Armature */}
            <line x1="82" y1="58" x2="98" y2="48" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" />
            <circle cx="82" cy="58" r="2.5" fill="#E59A25" />
            <circle cx="98" cy="46" r="2.5" fill="#E59A25" />
          </g>

          {/* Live Signal Pulse Traveling */}
          {!shouldReduceMotion && (
            <circle cx="190" cy="115" r="3.5" fill="#38BDF8">
              <animate attributeName="cy" values="90;140;90" dur="2s" repeatCount="indefinite" />
              <animate attributeName="cx" values="140;240;140" dur="2s" repeatCount="indefinite" />
            </circle>
          )}
        </svg>
      </div>

      {/* Floating Measurement & AI Synthesis Callout */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "10px",
        }}
      >
        <div
          style={{
            background: "var(--ohmni-surface-raised)",
            border: "1px solid var(--ohmni-border-subtle)",
            borderRadius: "var(--radius-md)",
            padding: "10px 12px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "var(--ohmni-signal)", fontSize: "11px", fontWeight: 700 }}>
            <Activity size={13} />
            Supply Voltage
          </div>
          <div className="font-mono" style={{ fontSize: "16px", fontWeight: 800, color: "var(--ohmni-ink)", marginTop: "2px" }}>
            3.31 V
          </div>
          <div style={{ fontSize: "11px", color: "var(--ohmni-text-muted)" }}>
            Nominal 3V3 MCU rail
          </div>
        </div>

        <div
          style={{
            background: "var(--ohmni-surface-raised)",
            border: "1px solid var(--ohmni-border-subtle)",
            borderRadius: "var(--radius-md)",
            padding: "10px 12px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "var(--ohmni-agent)", fontSize: "11px", fontWeight: 700 }}>
            <Sparkles size={13} />
            Diagnostic Ledger
          </div>
          <div className="font-mono" style={{ fontSize: "16px", fontWeight: 800, color: "var(--ohmni-ink)", marginTop: "2px" }}>
            E-001 • E-002
          </div>
          <div style={{ fontSize: "11px", color: "var(--ohmni-text-muted)" }}>
            Immutable empirical facts
          </div>
        </div>
      </div>
    </div>
  );
};
