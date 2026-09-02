/**
 * Technical Vector Hardware PCB of the ESP32-S3 Environmental Controller.
 * Milestone 7.13 — Visual Rescue: 3D OHMNI Identity + Cohesive Product UI
 *
 * Requirements:
 * - Real technical depth, layered components: ESP32-S3 module, power traces, relay module, status LEDs, fan load, terminal blocks.
 * - Dark technical surface (#0D1118) with gold/copper accents and blue signal traces.
 * - Dynamic relay armature lever with physical actuation (y2 moves on relay energization).
 * - Live status LEDs with power / reset / nominal glow.
 * - Test IDs:
 *     id="hardware-target-node" / data-testid="hardware-silhouette"
 *     id="relay-armature-lever" / data-testid="relay-armature-lever"
 *     id="relay-module-group" / data-testid="relay-module-group"
 *     id="power-led" / data-testid="power-led"
 *     id="esp32-status-led" / data-testid="esp32-status-led"
 */

import React from "react";
import { motion } from "motion/react";

export interface BoardSilhouetteProps {
  readonly isConnected: boolean;
  readonly relayState: "open" | "closed";
  readonly statusVisual: "nominal" | "reset" | "disconnected";
  readonly className?: string;
  readonly style?: React.CSSProperties;
}

export const BoardSilhouette: React.FC<BoardSilhouetteProps> = ({
  isConnected,
  relayState,
  statusVisual,
  className = "",
  style,
}) => {
  const isRelayEnergized = relayState === "closed";

  const statusLedColor =
    statusVisual === "reset"
      ? "var(--ohmni-lab-fault, #DC5050)"
      : isConnected
      ? "var(--ohmni-lab-verified, #27966B)"
      : "#475569";

  const powerLedColor = isConnected ? "var(--ohmni-lab-brand, #4967FF)" : "#334155";
  const relayCoilColor = isRelayEnergized ? "var(--ohmni-lab-warning, #E59D37)" : "#1E293B";

  return (
    <div
      id="hardware-target-node"
      data-testid="hardware-silhouette"
      className={`board-silhouette-container ${className}`}
      style={{
        width: "100%",
        padding: "1.25rem",
        background: "var(--ohmni-lab-dark, #0D1118)",
        border: "1px solid rgba(255, 255, 255, 0.08)",
        borderRadius: "var(--radius-lg, 14px)",
        position: "relative",
        overflow: "hidden",
        boxShadow: "0 18px 40px rgba(0, 0, 0, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.1)",
        ...style,
      }}
    >
      <svg
        viewBox="0 0 520 280"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ width: "100%", height: "auto", display: "block" }}
      >
        <defs>
          {/* PCB Grid Pattern */}
          <pattern id="board-dot-grid" width="16" height="16" patternUnits="userSpaceOnUse">
            <circle cx="8" cy="8" r="0.75" fill="rgba(255, 255, 255, 0.06)" />
          </pattern>

          {/* Substrate Gradient */}
          <linearGradient id="board-pcb-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#141923" />
            <stop offset="100%" stopColor="#0B0F17" />
          </linearGradient>

          {/* Trace Glow Filter */}
          <filter id="board-trace-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="1.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* PCB Board Substrate */}
        <rect
          x="4"
          y="4"
          width="512"
          height="272"
          rx="12"
          fill="url(#board-pcb-grad)"
          stroke="rgba(255, 255, 255, 0.1)"
          strokeWidth="1.5"
        />
        <rect x="4" y="4" width="512" height="272" rx="12" fill="url(#board-dot-grid)" />

        {/* Gold Corner Mounting Holes */}
        <circle cx="24" cy="24" r="7" fill="#0B0F17" stroke="#E59D37" strokeWidth="2" />
        <circle cx="496" cy="24" r="7" fill="#0B0F17" stroke="#E59D37" strokeWidth="2" />
        <circle cx="24" cy="256" r="7" fill="#0B0F17" stroke="#E59D37" strokeWidth="2" />
        <circle cx="496" cy="256" r="7" fill="#0B0F17" stroke="#E59D37" strokeWidth="2" />

        {/* Gold Guard Ring Border */}
        <rect
          x="16"
          y="16"
          width="488"
          height="248"
          rx="8"
          fill="none"
          stroke="rgba(229, 157, 55, 0.22)"
          strokeWidth="1"
          strokeDasharray="4 4"
        />

        {/* =====================================================================
           COPPER TRACES & POWER BUS
           ===================================================================== */}
        {/* 3.3V Power Rail Trace (Electric Blue) */}
        <path
          d="M 180 110 L 260 110 L 260 145 L 340 145"
          fill="none"
          stroke="var(--ohmni-lab-brand, #4967FF)"
          strokeWidth="2.5"
          filter="url(#board-trace-glow)"
          opacity={isConnected ? "0.9" : "0.3"}
        />

        {/* GPIO14 Relay Control Trace (Amber) */}
        <path
          d="M 180 135 L 240 135 L 240 170 L 340 170"
          fill="none"
          stroke="var(--ohmni-lab-warning, #E59D37)"
          strokeWidth="1.8"
          opacity={isRelayEnergized ? "1" : "0.5"}
        />

        {/* Fan Power Connector Trace (Cyan / Measurement) */}
        <path
          d="M 425 155 L 455 155 L 455 95 L 475 95"
          fill="none"
          stroke="var(--ohmni-lab-measurement, #1687C9)"
          strokeWidth="2"
          opacity="0.75"
        />

        {/* =====================================================================
           COMPONENT 1: ESP32-S3 SoC Package
           ===================================================================== */}
        <g transform="translate(45, 50)">
          {/* Metal RF Shield */}
          <rect
            width="135"
            height="145"
            rx="6"
            fill="#181F2C"
            stroke="rgba(255, 255, 255, 0.2)"
            strokeWidth="1.5"
          />

          {/* SoC Notch / Pins */}
          {Array.from({ length: 8 }).map((_, i) => (
            <React.Fragment key={`esp-pin-${i}`}>
              <rect x="-8" y={22 + i * 14} width="8" height="6" fill="#E59D37" rx="1" />
              <rect x="135" y={22 + i * 14} width="8" height="6" fill="#E59D37" rx="1" />
            </React.Fragment>
          ))}

          {/* PCB Antenna */}
          <path
            d="M 16 16 L 118 16 M 16 23 L 42 23 L 42 29 L 68 29 L 68 23 L 94 23 L 94 29 L 118 29"
            stroke="#E59D37"
            strokeWidth="2"
            fill="none"
            opacity="0.8"
          />

          {/* Silkscreen Typography */}
          <text
            x="67"
            y="75"
            fill="#F4F5F7"
            fontSize="12"
            fontFamily="var(--font-mono)"
            fontWeight="bold"
            textAnchor="middle"
            letterSpacing="0.05em"
          >
            ESP32-S3
          </text>
          <text
            x="67"
            y="92"
            fill="#8E95A2"
            fontSize="8"
            fontFamily="var(--font-mono)"
            textAnchor="middle"
          >
            Xtensa LX7 • 240MHz
          </text>
          <text
            x="67"
            y="108"
            fill="#8E95A2"
            fontSize="7"
            fontFamily="var(--font-mono)"
            textAnchor="middle"
          >
            ESP-IDF v5.2 • N16R8
          </text>
        </g>

        {/* =====================================================================
           STATUS & POWER LEDS
           ===================================================================== */}
        {/* Main 3V3 Power LED */}
        <g transform="translate(200, 60)">
          <circle cx="8" cy="8" r="6" fill="#0B0F17" stroke="#334155" strokeWidth="1" />
          <circle
            id="power-led"
            data-testid="power-led"
            cx="8"
            cy="8"
            r="4"
            fill={powerLedColor}
            style={{
              filter: isConnected ? "drop-shadow(0 0 6px var(--ohmni-lab-brand, #4967FF))" : "none",
              transition: "fill 0.2s, filter 0.2s",
            }}
          />
          <text x="20" y="11" fill="#8E95A2" fontSize="7.5" fontFamily="var(--font-mono)" fontWeight="600">
            PWR 3V3
          </text>
        </g>

        {/* ESP32 Status / Fault LED */}
        <g transform="translate(200, 85)">
          <circle cx="8" cy="8" r="6" fill="#0B0F17" stroke="#334155" strokeWidth="1" />
          <circle
            id="esp32-status-led"
            data-testid="esp32-status-led"
            cx="8"
            cy="8"
            r="4"
            fill={statusLedColor}
            style={{
              filter: isConnected ? `drop-shadow(0 0 6px ${statusLedColor})` : "none",
              transition: "fill 0.2s, filter 0.2s",
            }}
          />
          <text x="20" y="11" fill="#8E95A2" fontSize="7.5" fontFamily="var(--font-mono)" fontWeight="600">
            STAT / RST
          </text>
        </g>

        {/* 3V3 Low-Dropout Regulator */}
        <g transform="translate(200, 115)">
          <rect width="45" height="30" rx="3" fill="#181F2C" stroke="#334155" strokeWidth="1" />
          <text x="22" y="16" fill="#F4F5F7" fontSize="7.5" fontFamily="var(--font-mono)" fontWeight="bold" textAnchor="middle">
            AMS1117
          </text>
          <text x="22" y="25" fill="#8E95A2" fontSize="6.5" fontFamily="var(--font-mono)" textAnchor="middle">
            3.3V LDO
          </text>
        </g>

        {/* =====================================================================
           COMPONENT 2: Relay Module (K1 / GPIO14)
           ===================================================================== */}
        <g
          id="relay-module-group"
          data-testid="relay-module-group"
          data-relay-state={isRelayEnergized ? "closed" : "open"}
          transform="translate(340, 110)"
        >
          {/* Relay Casing */}
          <rect
            width="85"
            height="90"
            rx="6"
            fill="#0F172A"
            stroke={isRelayEnergized ? "var(--ohmni-lab-warning, #E59D37)" : "#334155"}
            strokeWidth={isRelayEnergized ? "2" : "1.2"}
            style={{ transition: "stroke 0.15s" }}
          />

          {/* Coil Status Indicator Bar */}
          <rect
            x="5"
            y="5"
            width="75"
            height="22"
            rx="3"
            fill={relayCoilColor}
            style={{ transition: "fill 0.15s" }}
          />
          <text
            x="42"
            y="19"
            fill={isRelayEnergized ? "#12151A" : "#F4F5F7"}
            fontSize="9"
            fontFamily="var(--font-mono)"
            fontWeight="bold"
            textAnchor="middle"
          >
            RELAY K1
          </text>
          <text x="42" y="40" fill="#8E95A2" fontSize="7.5" fontFamily="var(--font-mono)" textAnchor="middle">
            OMRON G5V-1
          </text>
          <text
            x="42"
            y="52"
            fill={isRelayEnergized ? "var(--ohmni-lab-warning, #E59D37)" : "#64748B"}
            fontSize="7"
            fontFamily="var(--font-mono)"
            fontWeight="700"
            textAnchor="middle"
          >
            {isRelayEnergized ? "COIL ENERGIZED" : "COIL OPEN (PIN 14)"}
          </text>

          {/* Mechanical Armature Lever Schematic */}
          <circle cx="26" cy="72" r="3.5" fill="#64748B" />
          <circle cx="58" cy="72" r="3.5" fill="#64748B" />
          <line
            id="relay-armature-lever"
            data-testid="relay-armature-lever"
            data-relay-state={isRelayEnergized ? "closed" : "open"}
            x1="26"
            y1="72"
            x2="56"
            y2={isRelayEnergized ? "72" : "64"}
            stroke={isRelayEnergized ? "var(--ohmni-lab-warning, #E59D37)" : "#E2E8F0"}
            strokeWidth="2.5"
            strokeLinecap="round"
            style={{ transition: "all 0.1s cubic-bezier(0.16, 1, 0.3, 1)" }}
          />
        </g>

        {/* =====================================================================
           COMPONENT 3: 12V Fan Connector (Top Right)
           ===================================================================== */}
        <g transform="translate(390, 30)">
          <rect width="80" height="65" rx="6" fill="#181F2C" stroke="rgba(255, 255, 255, 0.15)" strokeWidth="1" />
          <circle cx="40" cy="32" r="22" fill="#0B0F17" stroke="rgba(255, 255, 255, 0.1)" />
          {/* Fan Blades */}
          <g transform="translate(40, 32)">
            <circle cx="0" cy="0" r="6" fill="var(--ohmni-lab-brand, #4967FF)" />
            <path d="M 0 -6 C 8 -14 12 -14 12 -6 C 12 0 8 0 0 0 Z" fill="#64748B" opacity="0.85" />
            <path d="M 6 0 C 14 8 14 12 6 12 C 0 12 0 8 0 0 Z" fill="#64748B" opacity="0.85" />
            <path d="M 0 6 C -8 14 -12 14 -12 6 C -12 0 -8 0 0 0 Z" fill="#64748B" opacity="0.85" />
            <path d="M -6 0 C -14 -8 -14 -12 -6 -12 C 0 -12 0 -8 0 0 Z" fill="#64748B" opacity="0.85" />
          </g>
          <text x="40" y="58" fill="#8E95A2" fontSize="6.5" fontFamily="var(--font-mono)" textAnchor="middle">
            12V FAN LOAD
          </text>
        </g>

        {/* Terminal Header Pins */}
        <g transform="translate(8, 25)">
          {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15].map((i) => (
            <circle key={i} cx="6" cy={i * 14 + 6} r="3" fill="#1E293B" stroke="#E59D37" strokeWidth="0.75" />
          ))}
        </g>
        <g transform="translate(506, 25)">
          {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15].map((i) => (
            <circle key={i} cx="6" cy={i * 14 + 6} r="3" fill="#1E293B" stroke="#E59D37" strokeWidth="0.75" />
          ))}
        </g>
      </svg>
    </div>
  );
};
