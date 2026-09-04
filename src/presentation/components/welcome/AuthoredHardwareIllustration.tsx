/**
 * Floating 2D Hardware Visual for Reference Device Illustration.
 * Polished SVG hardware board: ESP32-S3, relay, fan, power rails.
 */

import React from "react";
import { useReducedMotion } from "motion/react";

export interface AuthoredHardwareIllustrationProps {
  readonly isConnected?: boolean;
}

export const AuthoredHardwareIllustration: React.FC<AuthoredHardwareIllustrationProps> = ({
  isConnected = false,
}) => {
  const shouldReduceMotion = useReducedMotion();

  return (
    <div
      data-testid="hardware-illustration"
      id="hardware-illustration"
      style={{
        position: "relative",
        width: "100%",
        maxWidth: "520px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        userSelect: "none",
      }}
    >
      {/* Single quiet external device identity label */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          marginBottom: "0.75rem",
          alignSelf: "flex-start",
          marginLeft: "3.85%",
        }}
      >
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "7px",
            padding: "4px 10px",
            borderRadius: "var(--radius-full, 9999px)",
            background: "rgba(18, 21, 26, 0.04)",
            border: "1px solid rgba(18, 21, 26, 0.08)",
            fontSize: "12px",
            fontWeight: 600,
            color: "var(--ink-secondary, #5C6470)",
          }}
        >
          <span
            style={{
              width: "7px",
              height: "7px",
              borderRadius: "50%",
              background: isConnected ? "var(--ohmni-lab-verified, #16A34A)" : "#22C55E",
            }}
          />
          <span className="font-mono">Virtual reference device</span>
        </div>
      </div>

      {/* Primary SVG Hardware Board */}
      <svg
        viewBox="0 0 520 320"
        style={{
          width: "100%",
          height: "auto",
          filter: "drop-shadow(0 12px 28px rgba(18, 21, 26, 0.08))",
          overflow: "visible",
        }}
      >
        <defs>
          {/* Subtle PCB Dot Grid Pattern */}
          <pattern id="pcb-dot-grid" width="16" height="16" patternUnits="userSpaceOnUse">
            <circle cx="8" cy="8" r="0.75" fill="rgba(255, 255, 255, 0.05)" />
          </pattern>

          {/* Linear Gradient for PCB Substrate */}
          <linearGradient id="pcb-substrate" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#141824" />
            <stop offset="100%" stopColor="#0D1017" />
          </linearGradient>

          {/* Metal Relay Casing Gradient */}
          <linearGradient id="relay-metal" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#1C2638" />
            <stop offset="100%" stopColor="#111827" />
          </linearGradient>
        </defs>

        {/* Main Board PCB Substrate */}
        <rect
          x="20"
          y="20"
          width="480"
          height="280"
          rx="14"
          fill="url(#pcb-substrate)"
          stroke="rgba(255, 255, 255, 0.1)"
          strokeWidth="1.5"
        />
        <rect
          x="20"
          y="20"
          width="480"
          height="280"
          rx="14"
          fill="url(#pcb-dot-grid)"
        />

        {/* Mounting Holes */}
        <circle cx="38" cy="38" r="6" fill="#0C1017" stroke="#E59A25" strokeWidth="1.5" />
        <circle cx="482" cy="38" r="6" fill="#0C1017" stroke="#E59A25" strokeWidth="1.5" />
        <circle cx="38" cy="282" r="6" fill="#0C1017" stroke="#E59A25" strokeWidth="1.5" />
        <circle cx="482" cy="282" r="6" fill="#0C1017" stroke="#E59A25" strokeWidth="1.5" />

        {/* Ground Plane Edge Guideline */}
        <rect
          x="30"
          y="30"
          width="460"
          height="260"
          rx="10"
          fill="none"
          stroke="rgba(229, 154, 37, 0.2)"
          strokeWidth="1"
          strokeDasharray="4 4"
        />

        {/* =====================================================================
           COPPER TRACES & BUS POWER RAILS (Clean Static Routing)
           ===================================================================== */}
        {/* 3.3V Shared Power Rail Trace (Blue) */}
        <path
          d="M 180 120 L 260 120 L 260 170 L 330 170"
          fill="none"
          stroke="#3B82F6"
          strokeWidth="2.2"
          opacity="0.9"
        />

        {/* GPIO14 Relay Control Trace (Orange) */}
        <path
          d="M 180 145 L 240 145 L 240 195 L 330 195"
          fill="none"
          stroke="#F59E0B"
          strokeWidth="1.8"
          opacity="0.8"
        />

        {/* Fan Power Connector Trace (Green, routed with clear margin away from labels) */}
        <path
          d="M 410 185 L 472 185 L 472 85 L 458 85"
          fill="none"
          stroke="#10B981"
          strokeWidth="2"
          opacity="0.8"
        />

        {/* =====================================================================
           COMPONENT 1: ESP32-S3 SoC Module (Left)
           ===================================================================== */}
        <g transform="translate(50, 70)">
          {/* Metal RF Shield */}
          <rect
            width="130"
            height="140"
            rx="6"
            fill="#181F2C"
            stroke="rgba(255, 255, 255, 0.16)"
            strokeWidth="1.2"
          />
          {/* Pin Rows (Left & Right) */}
          {Array.from({ length: 8 }).map((_, i) => (
            <React.Fragment key={`esp-pin-${i}`}>
              <rect x="-7" y={20 + i * 14} width="7" height="6" fill="#F59E0B" rx="1" />
              <rect x="130" y={20 + i * 14} width="7" height="6" fill="#F59E0B" rx="1" />
            </React.Fragment>
          ))}
          {/* PCB Antenna */}
          <path
            d="M 15 15 L 115 15 M 15 22 L 40 22 L 40 28 L 65 28 L 65 22 L 90 22 L 90 28 L 115 28"
            stroke="#F59E0B"
            strokeWidth="1.8"
            fill="none"
            opacity="0.65"
          />
          {/* Silkscreen Text */}
          <text
            x="65"
            y="75"
            textAnchor="middle"
            fill="#F8FAFC"
            fontSize="12"
            fontFamily="var(--font-mono)"
            fontWeight="700"
            letterSpacing="0.06em"
          >
            ESP32-S3
          </text>
          <text
            x="65"
            y="92"
            textAnchor="middle"
            fill="#94A3B8"
            fontSize="9"
            fontFamily="var(--font-mono)"
          >
            Dual Core 240MHz
          </text>

          {/* Power / Status LED */}
          <circle cx="25" cy="116" r="3.5" fill="#22C55E">
            {!shouldReduceMotion && (
              <animate
                attributeName="opacity"
                values="0.5;1.0;0.5"
                dur="2.4s"
                repeatCount="indefinite"
              />
            )}
          </circle>
          <text x="34" y="119" fill="#94A3B8" fontSize="8.5" fontFamily="var(--font-mono)">
            3V3 OK
          </text>
        </g>

        {/* =====================================================================
           COMPONENT 2: Mechanical Relay Cube (Center Right)
           ===================================================================== */}
        <g id="visual-relay-module" transform="translate(330, 140)">
          {/* Relay Casing */}
          <rect
            width="80"
            height="85"
            rx="6"
            fill="url(#relay-metal)"
            stroke="#3B82F6"
            strokeWidth="1.5"
          />
          <text
            x="40"
            y="30"
            textAnchor="middle"
            fill="#F8FAFC"
            fontSize="10.5"
            fontFamily="var(--font-mono)"
            fontWeight="700"
            letterSpacing="0.04em"
          >
            RELAY
          </text>
          <text
            x="40"
            y="46"
            textAnchor="middle"
            fill="#94A3B8"
            fontSize="8.5"
            fontFamily="var(--font-mono)"
          >
            SRD-03VDC
          </text>

          {/* Armature Schematic Symbol Inside Relay */}
          <circle cx="25" cy="64" r="2.5" fill="#64748B" />
          <circle cx="55" cy="64" r="2.5" fill="#64748B" />
          <line x1="25" y1="64" x2="48" y2="57" stroke="#E2E8F0" strokeWidth="1.8" strokeLinecap="round" />
        </g>

        {/* =====================================================================
           COMPONENT 3: DC Cooling Fan Load (Top Right)
           ===================================================================== */}
        <g transform="translate(378, 46)">
          {/* Fan Outer Housing */}
          <rect
            width="80"
            height="80"
            rx="8"
            fill="#181F2C"
            stroke="rgba(255, 255, 255, 0.14)"
            strokeWidth="1.2"
          />
          <circle cx="40" cy="36" r="26" fill="#0C1017" stroke="rgba(255, 255, 255, 0.08)" />
          {/* Fan Blades (Clean stationary turbine) */}
          <g transform="translate(40, 36)">
            <circle cx="0" cy="0" r="7" fill="#3B82F6" />
            <path d="M 0 -7 C 8 -16 14 -16 14 -7 C 14 0 8 0 0 0 Z" fill="#64748B" opacity="0.85" />
            <path d="M 7 0 C 16 8 16 14 7 14 C 0 14 0 8 0 0 Z" fill="#64748B" opacity="0.85" />
            <path d="M 0 7 C -8 16 -14 16 -14 7 C -14 0 -8 0 0 0 Z" fill="#64748B" opacity="0.85" />
            <path d="M -7 0 C -16 -8 -16 -14 -7 -14 C 0 -14 0 -8 0 0 Z" fill="#64748B" opacity="0.85" />
          </g>
          {/* Fan Label placed cleanly with no trace overlap */}
          <text
            x="40"
            y="72"
            textAnchor="middle"
            fill="#94A3B8"
            fontSize="8"
            fontFamily="var(--font-mono)"
            letterSpacing="0.02em"
          >
            12V FAN LOAD
          </text>
        </g>

        {/* =====================================================================
           COMPONENT 4: Physical Jumper JP1 (Selectable Power Source)
           ===================================================================== */}
        <g transform="translate(226, 226)">
          <rect width="76" height="38" rx="4" fill="#141923" stroke="#F59E0B" strokeWidth="1" />
          <text x="38" y="14" textAnchor="middle" fill="#F59E0B" fontSize="8" fontFamily="var(--font-mono)" fontWeight="700">
            JUMPER JP1
          </text>
          <circle cx="21" cy="24" r="2.5" fill="#F59E0B" />
          <circle cx="38" cy="24" r="2.5" fill="#F59E0B" />
          <circle cx="55" cy="24" r="2.5" fill="#64748B" />
          <rect x="18" y="21" width="23" height="6" rx="1.5" fill="#E59A25" />
          <text x="38" y="34" textAnchor="middle" fill="#94A3B8" fontSize="7.5" fontFamily="var(--font-mono)">
            3.3V (DEFAULT)
          </text>
        </g>
      </svg>

      {/* Understandable Live Instrument Readings */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          width: "92.3%",
          marginTop: "12px",
          background: "#FFFFFF",
          border: "1px solid rgba(18, 21, 26, 0.08)",
          borderRadius: "10px",
          padding: "10px 18px",
          boxShadow: "0 1px 3px rgba(18, 21, 26, 0.04)",
          boxSizing: "border-box",
        }}
      >
        <div>
          <div
            style={{
              fontSize: "10.5px",
              fontWeight: 600,
              color: "var(--ink-tertiary, #8A92A0)",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
            }}
          >
            Supply
          </div>
          <div
            style={{
              fontSize: "14.5px",
              fontWeight: 700,
              color: "var(--ink, #111318)",
              fontFamily: "var(--font-mono)",
              marginTop: "2px",
            }}
          >
            3.31 V
          </div>
        </div>
        <div>
          <div
            style={{
              fontSize: "10.5px",
              fontWeight: 600,
              color: "var(--ink-tertiary, #8A92A0)",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
            }}
          >
            Relay
          </div>
          <div
            style={{
              fontSize: "14.5px",
              fontWeight: 700,
              color: "var(--brand, #2B57FF)",
              fontFamily: "var(--font-mono)",
              marginTop: "2px",
            }}
          >
            OPEN
          </div>
        </div>
        <div>
          <div
            style={{
              fontSize: "10.5px",
              fontWeight: 600,
              color: "var(--ink-tertiary, #8A92A0)",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
            }}
          >
            Resets
          </div>
          <div
            style={{
              fontSize: "14.5px",
              fontWeight: 700,
              color: "var(--ink, #111318)",
              fontFamily: "var(--font-mono)",
              marginTop: "2px",
            }}
          >
            0
          </div>
        </div>
      </div>
    </div>
  );
};
