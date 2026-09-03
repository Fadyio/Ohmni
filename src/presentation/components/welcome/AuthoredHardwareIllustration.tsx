/**
 * Floating Isometric 2D Hardware Visual for Welcome Experience (World 1).
 *
 * Requirements:
 * - Floats directly in composition (no outer white card container).
 * - Isometric/perspective 2D SVG hardware board: ESP32-S3, relay, fan, power rails.
 * - Sparse clean labels.
 * - Subtle idle animations: power LED breathes, current glow on rail, fan stationary, agent connection node dormant.
 * - Zero fake evidence or pre-scripted diagnostics.
 */

import React from "react";
import { useReducedMotion } from "motion/react";

export interface AuthoredHardwareIllustrationProps {
  readonly toolCount?: number;
  readonly isConnected?: boolean;
}

export const AuthoredHardwareIllustration: React.FC<AuthoredHardwareIllustrationProps> = ({
  toolCount = 13,
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
        maxWidth: "560px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "1rem",
        userSelect: "none",
      }}
    >
      {/* Top Floating Spec Badge */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          marginBottom: "1rem",
          alignSelf: "flex-start",
        }}
      >
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "7px",
            padding: "4px 10px",
            borderRadius: "var(--radius-full)",
            background: "rgba(16, 17, 20, 0.04)",
            border: "1px solid rgba(16, 17, 20, 0.08)",
            fontSize: "12px",
            fontWeight: 600,
            color: "var(--ohmni-intro-ink)",
          }}
        >
          <span
            style={{
              width: "7px",
              height: "7px",
              borderRadius: "50%",
              background: isConnected ? "var(--ohmni-lab-verified)" : "#22C55E",
              boxShadow: "0 0 8px rgba(34, 197, 94, 0.5)",
            }}
          />
          <span className="font-mono">ESP32-S3-WROOM-1</span>
        </div>

      </div>

      {/* Primary SVG Isometric Hardware Composition */}
      <svg
        viewBox="0 0 520 320"
        style={{
          width: "100%",
          height: "auto",
          filter: "drop-shadow(0 20px 40px rgba(16, 17, 20, 0.12))",
          overflow: "visible",
        }}
      >
        <defs>
          {/* PCB Grid Pattern */}
          <pattern id="pcb-dot-grid" width="16" height="16" patternUnits="userSpaceOnUse">
            <circle cx="8" cy="8" r="0.75" fill="rgba(255, 255, 255, 0.07)" />
          </pattern>

          {/* Copper Trace Glow Filters */}
          <filter id="trace-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Linear Gradient for PCB Substrate */}
          <linearGradient id="pcb-substrate" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#141822" />
            <stop offset="100%" stopColor="#0D1017" />
          </linearGradient>

          {/* Metal Relay Casing Gradient */}
          <linearGradient id="relay-metal" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#1E283A" />
            <stop offset="100%" stopColor="#0F172A" />
          </linearGradient>
        </defs>

        {/* Main Board PCB Substrate */}
        <rect
          x="20"
          y="20"
          width="480"
          height="280"
          rx="16"
          fill="url(#pcb-substrate)"
          stroke="rgba(255, 255, 255, 0.12)"
          strokeWidth="1.5"
        />
        <rect
          x="20"
          y="20"
          width="480"
          height="280"
          rx="16"
          fill="url(#pcb-dot-grid)"
        />

        {/* Gold Mounting Holes */}
        <circle cx="38" cy="38" r="6" fill="#0C1017" stroke="#E59A25" strokeWidth="2" />
        <circle cx="482" cy="38" r="6" fill="#0C1017" stroke="#E59A25" strokeWidth="2" />
        <circle cx="38" cy="282" r="6" fill="#0C1017" stroke="#E59A25" strokeWidth="2" />
        <circle cx="482" cy="282" r="6" fill="#0C1017" stroke="#E59A25" strokeWidth="2" />

        {/* Ground Plane Edge Border */}
        <rect
          x="30"
          y="30"
          width="460"
          height="260"
          rx="10"
          fill="none"
          stroke="rgba(229, 154, 37, 0.25)"
          strokeWidth="1"
          strokeDasharray="4 4"
        />

        {/* =====================================================================
           COPPER TRACES & BUS POWER RAILS
           ===================================================================== */}
        {/* 3.3V Shared Power Rail Trace (Blue) */}
        <path
          d="M 180 120 L 260 120 L 260 170 L 330 170"
          fill="none"
          stroke="#3B5BFF"
          strokeWidth="2.5"
          filter="url(#trace-glow)"
          opacity="0.85"
        />
        {/* Idle Current Pulse Animation on Power Rail */}
        {!shouldReduceMotion && (
          <circle cx="180" cy="120" r="3" fill="#60A5FA">
            <animateMotion
              path="M 180 120 L 260 120 L 260 170 L 330 170"
              dur="3s"
              repeatCount="indefinite"
            />
          </circle>
        )}

        {/* GPIO14 Relay Control Trace (Orange) */}
        <path
          d="M 180 145 L 240 145 L 240 195 L 330 195"
          fill="none"
          stroke="#FFB54A"
          strokeWidth="1.8"
          opacity="0.75"
        />

        {/* Fan Power Connector Trace (Green) */}
        <path
          d="M 410 185 L 440 185 L 440 120 L 460 120"
          fill="none"
          stroke="#4FD19A"
          strokeWidth="2"
          opacity="0.7"
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
            fill="#1E2430"
            stroke="rgba(255, 255, 255, 0.2)"
            strokeWidth="1.5"
          />
          {/* Pin Rows (Left & Right) */}
          {Array.from({ length: 8 }).map((_, i) => (
            <React.Fragment key={`esp-pin-${i}`}>
              <rect x="-8" y={20 + i * 14} width="8" height="6" fill="#F59E0B" rx="1" />
              <rect x="130" y={20 + i * 14} width="8" height="6" fill="#F59E0B" rx="1" />
            </React.Fragment>
          ))}
          {/* PCB Antenna */}
          <path
            d="M 15 15 L 115 15 M 15 22 L 40 22 L 40 28 L 65 28 L 65 22 L 90 22 L 90 28 L 115 28"
            stroke="#F59E0B"
            strokeWidth="2"
            fill="none"
            opacity="0.7"
          />
          {/* Silkscreen Text */}
          <text
            x="65"
            y="75"
            textAnchor="middle"
            fill="#F5F6F8"
            fontSize="11"
            fontFamily="var(--font-mono)"
            fontWeight="700"
            letterSpacing="0.05em"
          >
            ESP32-S3
          </text>
          <text
            x="65"
            y="92"
            textAnchor="middle"
            fill="#8C94A3"
            fontSize="8.5"
            fontFamily="var(--font-mono)"
          >
            Dual Core 240MHz
          </text>

          {/* Breathing Power / Status LED */}
          <circle cx="25" cy="115" r="4" fill="#22C55E">
            {!shouldReduceMotion && (
              <animate
                attributeName="opacity"
                values="0.4;1.0;0.4"
                dur="2.4s"
                repeatCount="indefinite"
              />
            )}
          </circle>
          <text x="35" y="118" fill="#8C94A3" fontSize="8" fontFamily="var(--font-mono)">
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
            rx="5"
            fill="url(#relay-metal)"
            stroke="#3B5BFF"
            strokeWidth="1.5"
          />
          <text
            x="40"
            y="32"
            textAnchor="middle"
            fill="#F5F6F8"
            fontSize="10"
            fontFamily="var(--font-mono)"
            fontWeight="700"
          >
            RELAY
          </text>
          <text
            x="40"
            y="48"
            textAnchor="middle"
            fill="#8C94A3"
            fontSize="8"
            fontFamily="var(--font-mono)"
          >
            SRD-03VDC
          </text>

          {/* Armature Schematic Symbol Inside Relay */}
          <circle cx="25" cy="64" r="3" fill="#64748B" />
          <circle cx="55" cy="64" r="3" fill="#64748B" />
          <line x1="25" y1="64" x2="50" y2="58" stroke="#E2E8F0" strokeWidth="2" strokeLinecap="round" />
        </g>

        {/* =====================================================================
           COMPONENT 3: DC Cooling Fan Load (Top Right)
           ===================================================================== */}
        <g transform="translate(380, 50)">
          {/* Fan Outer Housing */}
          <rect
            width="75"
            height="75"
            rx="8"
            fill="#1E2430"
            stroke="rgba(255, 255, 255, 0.15)"
            strokeWidth="1.2"
          />
          <circle cx="37.5" cy="37.5" r="30" fill="#0C1017" stroke="rgba(255, 255, 255, 0.08)" />
          {/* Stationary Fan Blades (Idle in Intro) */}
          <g transform="translate(37.5, 37.5)">
            <circle cx="0" cy="0" r="8" fill="#3B5BFF" />
            <path d="M 0 -8 C 10 -18 16 -18 16 -8 C 16 0 10 0 0 0 Z" fill="#64748B" opacity="0.8" />
            <path d="M 8 0 C 18 10 18 16 8 16 C 0 16 0 10 0 0 Z" fill="#64748B" opacity="0.8" />
            <path d="M 0 8 C -10 18 -16 18 -16 8 C -16 0 -10 0 0 0 Z" fill="#64748B" opacity="0.8" />
            <path d="M -8 0 C -18 -10 -18 -16 -8 -16 C 0 -16 0 -10 0 0 Z" fill="#64748B" opacity="0.8" />
          </g>
          <text
            x="37.5"
            y="92"
            textAnchor="middle"
            fill="#8C94A3"
            fontSize="8"
            fontFamily="var(--font-mono)"
          >
            12V FAN LOAD (IDLE)
          </text>
        </g>

        {/* =====================================================================
           COMPONENT 4: Physical Jumper JP1 (Selectable Power Source)
           ===================================================================== */}
        <g transform="translate(230, 230)">
          <rect width="70" height="35" rx="4" fill="#141923" stroke="#F59E0B" strokeWidth="1" />
          <text x="35" y="16" textAnchor="middle" fill="#F59E0B" fontSize="8" fontFamily="var(--font-mono)" fontWeight="700">
            JUMPER JP1
          </text>
          <circle cx="20" cy="25" r="3" fill="#F59E0B" />
          <circle cx="35" cy="25" r="3" fill="#F59E0B" />
          <circle cx="50" cy="25" r="3" fill="#64748B" />
          <rect x="17" y="22" width="21" height="6" rx="2" fill="#E59A25" />
          <text x="35" y="46" textAnchor="middle" fill="#8C94A3" fontSize="7.5" fontFamily="var(--font-mono)">
            3.3V POS (DEFAULT)
          </text>
        </g>
      </svg>
    </div>
  );
};
