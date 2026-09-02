/**
 * Simplified Technical Vector Silhouette of the ESP32-S3 Environmental Controller PCB.
 * Renders MCU package, relay footprint, power rails, and dynamic status LEDs.
 */

import React from "react";
import { motion } from "framer-motion";

interface BoardSilhouetteProps {
  readonly isConnected: boolean;
  readonly relayState: "open" | "closed";
  readonly statusVisual: "nominal" | "reset" | "disconnected";
}

export const BoardSilhouette: React.FC<BoardSilhouetteProps> = ({
  isConnected,
  relayState,
  statusVisual,
}) => {
  const isRelayEnergized = relayState === "closed";

  const ledColor =
    statusVisual === "reset"
      ? "#ef4444"
      : isConnected
      ? "#10b981"
      : "#475569";

  const relayColor = isRelayEnergized ? "#f59e0b" : "#1e293b";

  return (
    <div
      style={{
        width: "100%",
        padding: "10px",
        background: "var(--ohmni-surface-raised)",
        border: "1px solid var(--ohmni-border-subtle)",
        borderRadius: "var(--radius-md)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <svg
        viewBox="0 0 240 130"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ width: "100%", height: "auto", display: "block" }}
      >
        {/* PCB Board Outline */}
        <rect
          x="2"
          y="2"
          width="236"
          height="126"
          rx="6"
          fill="#0c1015"
          stroke="#1e293b"
          strokeWidth="1.5"
        />

        {/* Copper / Subdued Grid Traces */}
        <path
          d="M 16 16 L 40 16 L 55 35 L 90 35 M 16 30 L 35 30 L 45 42 M 16 114 L 60 114 L 80 95 L 140 95"
          stroke="#1e293b"
          strokeWidth="1"
          strokeDasharray="2 2"
        />
        <path
          d="M 150 35 L 175 35 L 195 55 M 150 95 L 180 95 L 200 75 L 224 75"
          stroke="#1e293b"
          strokeWidth="1"
        />

        {/* ESP32-S3 SoC / RF Shield */}
        <g transform="translate(24, 38)">
          <rect
            x="0"
            y="0"
            width="65"
            height="54"
            rx="3"
            fill="#141a23"
            stroke="#334155"
            strokeWidth="1"
          />
          {/* SoC Notch / Pins */}
          <line x1="0" y1="12" x2="65" y2="12" stroke="#1e293b" strokeWidth="0.75" />
          <text
            x="32"
            y="26"
            fill="#94a3b8"
            fontSize="7"
            fontFamily="var(--font-mono)"
            fontWeight="bold"
            textAnchor="middle"
          >
            ESP32-S3
          </text>
          <text
            x="32"
            y="37"
            fill="#64748b"
            fontSize="5.5"
            fontFamily="var(--font-mono)"
            textAnchor="middle"
          >
            WROOM-1
          </text>
          {/* Antenna Notch */}
          <rect x="2" y="2" width="61" height="6" fill="#0f172a" rx="1" />
        </g>

        {/* Status LED */}
        <g transform="translate(100, 42)">
          <circle cx="6" cy="6" r="4" fill="#0f172a" stroke="#334155" strokeWidth="0.75" />
          <circle
            cx="6"
            cy="6"
            r="2.5"
            fill={ledColor}
            style={{
              filter: isConnected ? `drop-shadow(0 0 4px ${ledColor})` : "none",
              transition: "fill 0.2s, filter 0.2s",
            }}
          />
          <text x="14" y="8" fill="#64748b" fontSize="5" fontFamily="var(--font-mono)">
            PWR / STAT
          </text>
        </g>

        {/* LDO / 3V3 Rail Regulator */}
        <g transform="translate(100, 64)">
          <rect x="0" y="0" width="22" height="16" rx="2" fill="#141a23" stroke="#334155" strokeWidth="0.75" />
          <text x="11" y="10" fill="#64748b" fontSize="5" fontFamily="var(--font-mono)" textAnchor="middle">
            3V3 REG
          </text>
        </g>

        {/* Relay Module (K1 / GPIO14) */}
        <g transform="translate(145, 34)">
          <rect
            x="0"
            y="0"
            width="75"
            height="62"
            rx="4"
            fill="#0f172a"
            stroke={isRelayEnergized ? "var(--ohmni-warning)" : "#334155"}
            strokeWidth={isRelayEnergized ? "1.5" : "1"}
            style={{ transition: "stroke 0.15s" }}
          />
          <rect x="4" y="4" width="67" height="20" rx="2" fill={relayColor} style={{ transition: "fill 0.15s" }} />
          <text
            x="37"
            y="17"
            fill={isRelayEnergized ? "#1c1917" : "#94a3b8"}
            fontSize="7"
            fontFamily="var(--font-mono)"
            fontWeight="bold"
            textAnchor="middle"
          >
            RELAY K1
          </text>
          <text x="37" y="36" fill="#64748b" fontSize="5.5" fontFamily="var(--font-mono)" textAnchor="middle">
            OMRON G5V
          </text>
          <text
            x="37"
            y="48"
            fill={isRelayEnergized ? "var(--ohmni-warning)" : "#475569"}
            fontSize="6"
            fontFamily="var(--font-mono)"
            fontWeight="600"
            textAnchor="middle"
          >
            {isRelayEnergized ? "COIL ENERGIZED" : "COIL OPEN (PIN 14)"}
          </text>
        </g>

        {/* Pin Header / Terminal Blocks */}
        <g transform="translate(8, 12)">
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
            <circle key={i} cx="6" cy={i * 13 + 6} r="2.5" fill="#1e293b" stroke="#334155" strokeWidth="0.5" />
          ))}
        </g>
        <g transform="translate(222, 12)">
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
            <circle key={i} cx="6" cy={i * 13 + 6} r="2.5" fill="#1e293b" stroke="#334155" strokeWidth="0.5" />
          ))}
        </g>
      </svg>
    </div>
  );
};
