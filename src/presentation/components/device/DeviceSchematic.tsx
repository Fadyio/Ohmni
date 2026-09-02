/**
 * Authored Interactive Device Schematic Component.
 * High-detail PCB SVG visualization with real-time animated state:
 * - ESP32-S3 module & Status LED (nominal pulse, brownout flash, disconnected).
 * - Mechanical Relay coil & armature contact animation (energized glow, closed/open contact).
 * - Power rail routing & physical jumper position (3.3V vs 5V).
 * - Active tool call probe signals.
 */

import React from "react";
import { motion, useReducedMotion } from "motion/react";

export interface DeviceSchematicProps {
  readonly isConnected: boolean;
  readonly relayState: "open" | "closed";
  readonly statusVisual: "nominal" | "reset" | "disconnected";
  readonly railVoltage: number;
  readonly isRelayTargeted?: boolean;
}

export const DeviceSchematic: React.FC<DeviceSchematicProps> = ({
  isConnected,
  relayState,
  statusVisual,
  railVoltage,
  isRelayTargeted = false,
}) => {
  const shouldReduceMotion = useReducedMotion();
  const isClosed = relayState === "closed";
  const isReset = statusVisual === "reset";

  // Status LED color calculation
  const getLedColor = () => {
    if (!isConnected) return "#475467";
    if (isReset) return "var(--ohmni-fault)";
    return "var(--ohmni-success)";
  };

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        borderRadius: "var(--radius-lg)",
        overflow: "hidden",
        background: "linear-gradient(145deg, #0D131C 0%, #080C12 100%)",
        border: "1px solid var(--ohmni-border)",
        boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.05), 0 8px 24px rgba(0, 0, 0, 0.4)",
        padding: "8px",
      }}
    >
      <svg
        viewBox="0 0 420 310"
        style={{
          width: "100%",
          height: "auto",
          display: "block",
        }}
      >
        <defs>
          {/* PCB Grid Pattern */}
          <pattern id="pcb-grid" width="20" height="20" patternUnits="userSpaceOnUse">
            <circle cx="10" cy="10" r="0.8" fill="rgba(148, 163, 184, 0.12)" />
          </pattern>

          {/* Copper Trace Glow Filters */}
          <filter id="amber-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>

          <filter id="cyan-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>

          <filter id="fault-glow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="5" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* 1. PCB Substrate */}
        <rect
          x="10"
          y="10"
          width="400"
          height="290"
          rx="12"
          fill="#101722"
          stroke="rgba(148, 163, 184, 0.18)"
          strokeWidth="1.5"
        />

        {/* PCB Dot Grid */}
        <rect x="14" y="14" width="392" height="282" rx="10" fill="url(#pcb-grid)" />

        {/* Board Mounting Holes */}
        <circle cx="28" cy="28" r="5" fill="#0B0E14" stroke="#D4AF37" strokeWidth="1.5" />
        <circle cx="392" cy="28" r="5" fill="#0B0E14" stroke="#D4AF37" strokeWidth="1.5" />
        <circle cx="28" cy="282" r="5" fill="#0B0E14" stroke="#D4AF37" strokeWidth="1.5" />
        <circle cx="392" cy="282" r="5" fill="#0B0E14" stroke="#D4AF37" strokeWidth="1.5" />

        {/* Silkscreen Header */}
        <text
          x="28"
          y="50"
          fill="rgba(148, 163, 184, 0.6)"
          fontSize="9"
          fontFamily="var(--font-mono)"
          fontWeight="600"
          letterSpacing="0.08em"
        >
          OHMNI • ESP32-S3 ENVIRONMENTAL CONTROLLER
        </text>

        {/* 2. Copper Bus Traces */}
        {/* 3.3V Power Rail Trace */}
        <path
          d="M 170 120 L 220 120 L 220 190 L 260 190"
          stroke={isConnected ? (railVoltage < 2.8 ? "var(--ohmni-fault)" : "var(--ohmni-signal)") : "rgba(148, 163, 184, 0.2)"}
          strokeWidth="2.5"
          fill="none"
          strokeDasharray={isConnected ? "none" : "4 3"}
        />

        {/* Relay Signal Trace (GPIO14) */}
        <path
          d="M 170 160 L 235 160 L 235 170 L 260 170"
          stroke={isClosed ? "var(--ohmni-warning)" : "rgba(148, 163, 184, 0.25)"}
          strokeWidth="2"
          fill="none"
        />

        {/* 3. ESP32-S3 SoC Module (Left) */}
        <g transform="translate(30, 70)">
          {/* Metal RF Shield */}
          <rect
            x="0"
            y="0"
            width="140"
            height="180"
            rx="6"
            fill="#151E2B"
            stroke={isReset ? "var(--ohmni-fault)" : "rgba(148, 163, 184, 0.3)"}
            strokeWidth="1.5"
          />

          {/* SoC Chip Marking */}
          <rect x="25" y="45" width="90" height="90" rx="4" fill="#0B0F16" stroke="rgba(148, 163, 184, 0.15)" />
          <text x="70" y="85" textAnchor="middle" fill="#F5F7FA" fontSize="11" fontFamily="var(--font-mono)" fontWeight="700">
            ESP32-S3
          </text>
          <text x="70" y="100" textAnchor="middle" fill="var(--ohmni-text-muted)" fontSize="8" fontFamily="var(--font-mono)">
            WROOM-1 16MB
          </text>

          {/* PCB Antenna */}
          <path
            d="M 20 15 L 120 15 M 35 15 L 35 32 M 55 15 L 55 32 M 75 15 L 75 32 M 95 15 L 95 32 M 115 15 L 115 32"
            stroke="#D4AF37"
            strokeWidth="1.5"
            strokeLinecap="round"
          />

          {/* Status LED (GPIO2) */}
          <g transform="translate(110, 150)">
            <circle cx="0" cy="0" r="5" fill="#0B0F16" stroke="rgba(148, 163, 184, 0.3)" />
            <circle
              cx="0"
              cy="0"
              r="3.5"
              fill={getLedColor()}
              filter={isConnected ? (isReset ? "url(#fault-glow)" : "url(#cyan-glow)") : undefined}
            />
            <text x="-8" y="16" fill="var(--ohmni-text-muted)" fontSize="7" fontFamily="var(--font-mono)">
              SYS_LED
            </text>
          </g>
        </g>

        {/* 4. Mechanical Relay Subsystem (Right) */}
        <g transform="translate(255, 90)">
          {/* Relay Housing */}
          <rect
            x="0"
            y="0"
            width="135"
            height="145"
            rx="8"
            fill={isClosed ? "rgba(244, 184, 96, 0.08)" : "#131A26"}
            stroke={isClosed || isRelayTargeted ? "var(--ohmni-warning)" : "rgba(148, 163, 184, 0.25)"}
            strokeWidth={isClosed || isRelayTargeted ? "2" : "1.5"}
            filter={isClosed ? "url(#amber-glow)" : undefined}
          />

          {/* Relay Markings */}
          <text x="14" y="24" fill="#F5F7FA" fontSize="10" fontFamily="var(--font-mono)" fontWeight="700">
            RELAY K1
          </text>
          <text x="14" y="38" fill="var(--ohmni-text-muted)" fontSize="8" fontFamily="var(--font-mono)">
            SRD-03VDC-SL-C
          </text>

          {/* Coil Inductor Schematic Symbol */}
          <g transform="translate(20, 60)">
            <path
              d="M 0 20 Q 8 5 16 20 Q 24 5 32 20 Q 40 5 48 20"
              stroke={isClosed ? "var(--ohmni-warning)" : "rgba(148, 163, 184, 0.5)"}
              strokeWidth="2"
              fill="none"
            />
            <text x="24" y="38" textAnchor="middle" fill="var(--ohmni-text-muted)" fontSize="7" fontFamily="var(--font-mono)">
              COIL 3.3V
            </text>
          </g>

          {/* Mechanical Armature Switch Contacts */}
          <g transform="translate(85, 55)">
            {/* Terminal Pins */}
            <circle cx="0" cy="10" r="3" fill="#D4AF37" />
            <circle cx="30" cy="0" r="3" fill="#D4AF37" />
            <circle cx="30" cy="22" r="3" fill="#D4AF37" />
            <text x="-8" y="13" fill="var(--ohmni-text-muted)" fontSize="7" fontFamily="var(--font-mono)">
              COM
            </text>
            <text x="36" y="3" fill="var(--ohmni-text-muted)" fontSize="7" fontFamily="var(--font-mono)">
              NO
            </text>
            <text x="36" y="25" fill="var(--ohmni-text-muted)" fontSize="7" fontFamily="var(--font-mono)">
              NC
            </text>

            {/* Armature Contact Lever (Animated on state change) */}
            <line
              x1="0"
              y1="10"
              x2={isClosed ? "28" : "24"}
              y2={isClosed ? "1" : "16"}
              stroke={isClosed ? "var(--ohmni-warning)" : "#F5F7FA"}
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          </g>

          {/* Fan Actuation Output Terminal */}
          <g transform="translate(18, 105)">
            <rect x="0" y="0" width="100" height="24" rx="4" fill="#0B0F16" stroke="rgba(148, 163, 184, 0.2)" />
            <text x="50" y="16" textAnchor="middle" fill={isClosed ? "var(--ohmni-warning)" : "var(--ohmni-text-secondary)"} fontSize="9" fontFamily="var(--font-mono)" fontWeight="600">
              {isClosed ? "⚡ FAN ENERGIZED (12V)" : "FAN LOAD IDLE"}
            </text>
          </g>
        </g>

        {/* 5. Target Actuation Pulse Effect */}
        {isRelayTargeted && !shouldReduceMotion && (
          <circle
            cx="322"
            cy="162"
            r="70"
            fill="none"
            stroke="var(--ohmni-warning)"
            strokeWidth="1.5"
            opacity="0.6"
          >
            <animate attributeName="r" values="50;85;50" dur="1.8s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.8;0;0.8" dur="1.8s" repeatCount="indefinite" />
          </circle>
        )}

        {/* 6. Live Telemetry Readout Overlay on Board */}
        <g transform="translate(185, 252)">
          <rect
            x="0"
            y="0"
            width="170"
            height="32"
            rx="6"
            fill="#090E17"
            stroke={railVoltage < 2.8 ? "var(--ohmni-fault)" : "rgba(53, 198, 244, 0.3)"}
            strokeWidth="1"
          />
          <text x="12" y="16" fill="var(--ohmni-text-muted)" fontSize="8" fontFamily="var(--font-mono)">
            MCU VCC RAIL
          </text>
          <text
            x="12"
            y="27"
            fill={railVoltage < 2.8 ? "var(--ohmni-fault)" : "var(--ohmni-signal)"}
            fontSize="11"
            fontFamily="var(--font-mono)"
            fontWeight="700"
          >
            {isConnected ? `${railVoltage.toFixed(2)} V` : "-- V"}
          </text>

          <text x="95" y="16" fill="var(--ohmni-text-muted)" fontSize="8" fontFamily="var(--font-mono)">
            RELAY COIL
          </text>
          <text
            x="95"
            y="27"
            fill={isClosed ? "var(--ohmni-warning)" : "var(--ohmni-text-secondary)"}
            fontSize="11"
            fontFamily="var(--font-mono)"
            fontWeight="600"
          >
            {isClosed ? "CLOSED" : "OPEN"}
          </text>
        </g>
      </svg>
    </div>
  );
};
