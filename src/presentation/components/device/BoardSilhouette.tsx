/**
 * Technical Vector Hardware PCB of the ESP32-S3 Environmental Controller.
 * Master Diagnostic Instrumentation & Circuit Animation.
 *
 * Requirements:
 * - Real technical depth, layered components:
 *     ESP32-S3 SoC (metal RF shield, Xtensa LX7, internal BOD brownout detector),
 *     AMS1117 3.3V LDO regulator & decoupling capacitors,
 *     JP1 3-pin power selector jumper (3V3 vs 5V AUX) with movable physical shunt,
 *     Mechanical relay K1 with flyback diode, switching transistor Q1, and moving armature lever,
 *     12V fan load with rotating rotor,
 *     Real PCB silkscreen, test points (TP1-TP4), and ground plane.
 * - Dynamic electrical cause-and-effect animation:
 *     1. Current flow along active traces (SVG animated stroke-dash).
 *     2. Voltage sag ripple when inrush current pulls 3.3V rail down.
 *     3. BOD Brownout Detection trip callout (2.72V < 2.80V threshold -> CPU Reset).
 *     4. Isolated 5V power path verification (3.18V stable -> No Reset).
 * - Exact Test IDs:
 *     id="hardware-target-node" / data-testid="hardware-silhouette"
 *     data-diagnostic-phase={diagnosticPhase}
 *     id="relay-armature-lever" / data-testid="relay-armature-lever"
 *     id="relay-module-group" / data-testid="relay-module-group"
 *     id="power-led" / data-testid="power-led"
 *     id="esp32-status-led" / data-testid="esp32-status-led"
 */

import React from "react";
import { motion, useReducedMotion } from "motion/react";

export interface BoardSilhouetteProps {
  readonly isConnected: boolean;
  readonly relayState: "open" | "closed";
  readonly statusVisual: "nominal" | "reset" | "disconnected";
  readonly diagnosticPhase?: "idle" | "sampling" | "brownout" | "verified";
  readonly railVoltage?: number;
  readonly jumperPosition?: "3V3" | "5V";
  readonly onMoveJumper?: () => void;
  readonly interactiveJumper?: boolean;
  readonly className?: string;
  readonly style?: React.CSSProperties;
}

export const BoardSilhouette: React.FC<BoardSilhouetteProps> = ({
  isConnected,
  relayState,
  statusVisual,
  diagnosticPhase = "idle",
  railVoltage,
  jumperPosition,
  onMoveJumper,
  interactiveJumper = false,
  className = "",
  style,
}) => {
  const shouldReduceMotion = useReducedMotion();
  const isRelayEnergized = relayState === "closed";
  const isDiagnostic = diagnosticPhase !== "idle";
  const isBrownout = diagnosticPhase === "brownout";
  const isVerified = diagnosticPhase === "verified";
  const isSampling = diagnosticPhase === "sampling";

  // Effective jumper position: explicit prop or derived from verified phase
  const effectiveJumper: "3V3" | "5V" =
    jumperPosition ?? (isVerified ? "5V" : "3V3");
  const isJumperOn5V = effectiveJumper === "5V";

  const statusLedColor =
    statusVisual === "reset" || isBrownout
      ? "var(--ohmni-lab-fault, #DC5050)"
      : isConnected
      ? "var(--ohmni-lab-verified, #27966B)"
      : "#475569";

  const powerLedColor = isConnected
    ? isBrownout
      ? "var(--ohmni-lab-warning, #E59D37)"
      : "var(--ohmni-lab-brand, #4967FF)"
    : "#334155";

  const relayCoilColor = isRelayEnergized
    ? "var(--ohmni-lab-warning, #E59D37)"
    : "#1E293B";

  const effectiveVoltage =
    railVoltage !== undefined
      ? railVoltage
      : isVerified
      ? 3.18
      : isBrownout
      ? 2.72
      : isSampling
      ? 2.75
      : 3.31;

  // Rail trace color based on measured state
  const railTraceColor = isBrownout
    ? "var(--ohmni-lab-fault, #DC5050)"
    : isVerified
    ? "var(--ohmni-lab-verified, #27966B)"
    : isSampling
    ? "var(--ohmni-lab-warning, #E59D37)"
    : "var(--ohmni-lab-measurement, #1687C9)";

  return (
    <div
      id="hardware-target-node"
      data-testid="hardware-silhouette"
      data-diagnostic-phase={diagnosticPhase}
      role="img"
      aria-label={
        isVerified
          ? `Board power path verified: JP1 isolated at 5 volts and 3.3 volt rail stable at ${effectiveVoltage.toFixed(2)} volts.`
          : isBrownout
          ? `Captured board fault: relay load pulled the 3.3 volt rail to ${effectiveVoltage.toFixed(2)} volts and reset the microcontroller.`
          : isSampling
          ? "Live board test: energizing relay K1, starting the fan load, and sampling the 3.3 volt rail."
          : "ESP32-S3 environmental controller board diagram."
      }
      className={`board-silhouette-container ${className}`}
      style={{
        width: "100%",
        padding: "1rem",
        background: "var(--ohmni-lab-dark, #0B0F17)",
        border: "1px solid rgba(255, 255, 255, 0.09)",
        borderRadius: "var(--radius-lg, 12px)",
        position: "relative",
        overflow: "hidden",
        boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.05), 0 12px 32px rgba(0, 0, 0, 0.35)",
        ...style,
      }}
    >
      <svg
        viewBox="0 0 540 290"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ width: "100%", height: "auto", display: "block" }}
      >
        <defs>
          {/* PCB Ground Plane Dot Grid Pattern */}
          <pattern id="board-pcb-dot-grid" width="15" height="15" patternUnits="userSpaceOnUse">
            <circle cx="7.5" cy="7.5" r="0.65" fill="rgba(255, 255, 255, 0.05)" />
          </pattern>

          {/* Copper Substrate Gradient */}
          <linearGradient id="board-fr4-substrate" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#121824" />
            <stop offset="50%" stopColor="#0E131C" />
            <stop offset="100%" stopColor="#080C12" />
          </linearGradient>

          {/* Trace Glow Filter */}
          <filter id="board-trace-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="1.8" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* High Energy Fault Flash Filter */}
          <filter id="board-fault-flash" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="3.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Metal RF Shield Texture */}
          <linearGradient id="board-metal-shield" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#252D3D" />
            <stop offset="45%" stopColor="#1A2230" />
            <stop offset="100%" stopColor="#121822" />
          </linearGradient>

          {/* Gold Plating Gradient */}
          <linearGradient id="board-gold-pad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FFDF73" />
            <stop offset="100%" stopColor="#D4A017" />
          </linearGradient>
        </defs>

        {/* 1. PCB FR4 Substrate */}
        <rect
          x="4"
          y="4"
          width="532"
          height="282"
          rx="12"
          fill="url(#board-fr4-substrate)"
          stroke="rgba(255, 255, 255, 0.12)"
          strokeWidth="1.2"
        />
        <rect x="4" y="4" width="532" height="282" rx="12" fill="url(#board-pcb-dot-grid)" />

        {/* Gold Corner Mounting Holes with Plated Pads */}
        {[
          [22, 22],
          [518, 22],
          [22, 268],
          [518, 268],
        ].map(([cx, cy], i) => (
          <g key={`mount-${i}`}>
            <circle cx={cx} cy={cy} r="8" fill="none" stroke="url(#board-gold-pad)" strokeWidth="1.8" />
            <circle cx={cx} cy={cy} r="5" fill="#070A0F" stroke="#000000" strokeWidth="1" />
          </g>
        ))}

        {/* Gold Silkscreen Guard Ring */}
        <rect
          x="14"
          y="14"
          width="512"
          height="262"
          rx="8"
          fill="none"
          stroke="rgba(212, 160, 23, 0.2)"
          strokeWidth="1"
          strokeDasharray="4 4"
        />

        {/* =====================================================================
           COPPER TRACES & POWER BUS ROUTING
           ===================================================================== */}

        {/* 1. 5V USB/VBUS Input Bus (Orange/Amber) */}
        <path
          d="M 180 50 L 220 50 L 220 120"
          fill="none"
          stroke="#E59D37"
          strokeWidth="2"
          opacity={isConnected ? "0.85" : "0.3"}
        />
        <text x="182" y="44" fill="#94A3B8" fontSize="6.5" fontFamily="var(--font-mono)">
          VBUS (5V)
        </text>

        {/* 2. 5V Auxiliary Power Rail -> JP1 Pin 3 (Isolated Route) */}
        <path
          d="M 220 50 L 285 50 L 285 195 L 305 195"
          className={isJumperOn5V && isRelayEnergized ? "board-power-trace board-power-trace--verified" : undefined}
          fill="none"
          stroke={isJumperOn5V ? "var(--ohmni-lab-verified, #27966B)" : "#2A3649"}
          strokeWidth={isJumperOn5V ? "2.5" : "1.8"}
          opacity={isJumperOn5V ? 0.95 : 0.4}
        />
        <text
          x="290"
          y="190"
          fill={isJumperOn5V ? "#3DD68C" : "#64748B"}
          fontSize="6.5"
          fontFamily="var(--font-mono)"
          fontWeight="600"
        >
          5V AUX
        </text>

        {/* 3. AMS1117 LDO 3.3V Output Rail -> ESP32 & JP1 Pin 1 */}
        {/* Regulator to Main 3.3V Distribution Node */}
        <path
          d="M 220 148 L 220 165 L 180 165"
          fill="none"
          stroke={railTraceColor}
          strokeWidth="2.5"
          opacity={isConnected ? "0.9" : "0.3"}
          filter={isBrownout ? "url(#board-fault-flash)" : "url(#board-trace-glow)"}
        />

        {/* 3.3V Trace to JP1 Pin 1 (Shared Power Path) */}
        <path
          d="M 220 165 L 265 165 L 265 195 L 285 195"
          className={!isJumperOn5V && isRelayEnergized ? "board-power-trace" : undefined}
          fill="none"
          stroke={!isJumperOn5V ? railTraceColor : "#2A3649"}
          strokeWidth={!isJumperOn5V ? "2.5" : "1.8"}
          opacity={!isJumperOn5V ? (isConnected ? 0.95 : 0.3) : 0.35}
          filter={!isJumperOn5V && isBrownout ? "url(#board-fault-flash)" : undefined}
        />
        <text
          x="250"
          y="190"
          fill={!isJumperOn5V ? (isBrownout ? "#FF6B6B" : "#38BDF8") : "#64748B"}
          fontSize="6.5"
          fontFamily="var(--font-mono)"
          fontWeight="600"
        >
          3V3
        </text>

        {/* 4. JP1 Center Pin 2 -> Relay K1 Coil VCC */}
        <path
          d="M 295 205 L 295 220 L 350 220 L 350 175 L 365 175"
          className={isRelayEnergized ? "board-power-trace" : undefined}
          fill="none"
          stroke={
            isRelayEnergized
              ? isJumperOn5V
                ? "var(--ohmni-lab-verified, #27966B)"
                : "var(--ohmni-lab-fault, #DC5050)"
              : "#334155"
          }
          strokeWidth="2.5"
          filter="url(#board-trace-glow)"
          opacity={isRelayEnergized ? 1 : 0.4}
        />

        {/* 5. GPIO14 Relay Gate Signal (Amber) */}
        <path
          d="M 180 135 L 250 135 L 250 148 L 365 148"
          fill="none"
          stroke="var(--ohmni-lab-warning, #E59D37)"
          strokeWidth="1.8"
          opacity={isRelayEnergized ? "1" : "0.5"}
        />
        <text x="184" y="131" fill="#E59D37" fontSize="6.5" fontFamily="var(--font-mono)">
          GPIO14 (RELAY_EN)
        </text>

        {/* 6. Relay NO Contact -> 12V Fan Connector Trace */}
        <path
          d="M 440 145 L 465 145 L 465 95 L 485 95"
          className={isRelayEnergized ? "board-power-trace" : undefined}
          fill="none"
          stroke={isRelayEnergized ? "#38BDF8" : "#334155"}
          strokeWidth="2.2"
          opacity={isRelayEnergized ? 0.95 : 0.4}
        />

        {/* Test Points TP1, TP2, TP3, TP4 */}
        {[
          { name: "TP1 (3V3)", x: 245, y: 155, color: "#38BDF8" },
          { name: "TP2 (5V)", x: 265, y: 40, color: "#E59D37" },
          { name: "TP3 (GND)", x: 245, y: 80, color: "#94A3B8" },
          { name: "TP4 (COIL)", x: 325, y: 228, color: "#E59D37" },
        ].map((tp) => (
          <g key={tp.name}>
            <circle cx={tp.x} cy={tp.y} r="3" fill="#070A0F" stroke={tp.color} strokeWidth="1.2" />
            <circle cx={tp.x} cy={tp.y} r="1.2" fill="url(#board-gold-pad)" />
            <text x={tp.x - 2} y={tp.y - 5} fill="#64748B" fontSize="5.5" fontFamily="var(--font-mono)">
              {tp.name}
            </text>
          </g>
        ))}

        {/* =====================================================================
           COMPONENT 1: ESP32-S3 SoC Package (Left)
           ===================================================================== */}
        <g transform="translate(38, 48)">
          {/* Metal RF Shield */}
          <rect
            width="142"
            height="158"
            rx="6"
            fill="url(#board-metal-shield)"
            stroke={isBrownout ? "var(--ohmni-lab-fault, #DC5050)" : "rgba(255, 255, 255, 0.2)"}
            strokeWidth={isBrownout ? "2" : "1.5"}
            filter={isBrownout ? "url(#board-fault-flash)" : undefined}
            style={{ transition: "stroke 0.2s" }}
          />

          {/* Castellated Pins on Left and Right */}
          {Array.from({ length: 9 }).map((_, i) => (
            <React.Fragment key={`esp-pin-${i}`}>
              <rect x="-7" y={22 + i * 14} width="7" height="6" fill="url(#board-gold-pad)" rx="1" />
              <rect x="142" y={22 + i * 14} width="7" height="6" fill="url(#board-gold-pad)" rx="1" />
            </React.Fragment>
          ))}

          {/* PCB Inverted-F Antenna */}
          <path
            d="M 16 16 L 126 16 M 16 23 L 44 23 L 44 30 L 72 30 L 72 23 L 100 23 L 100 30 L 126 30"
            stroke="#D4A017"
            strokeWidth="2.2"
            fill="none"
            opacity="0.85"
            strokeLinecap="round"
          />

          {/* Espressif Silkscreen Logo & Markings */}
          <text
            x="71"
            y="76"
            fill="#F8FAFC"
            fontSize="12.5"
            fontFamily="var(--font-mono)"
            fontWeight="bold"
            textAnchor="middle"
            letterSpacing="0.06em"
          >
            ESP32-S3
          </text>
          <text
            x="71"
            y="94"
            fill="#94A3B8"
            fontSize="8"
            fontFamily="var(--font-mono)"
            textAnchor="middle"
          >
            Xtensa Dual-Core 240MHz
          </text>
          {/* Internal Brownout Detector Fault Indicator (Rendered only on active fault) */}
          {isBrownout && (
            <>
              <rect
                x="20"
                y="122"
                width="102"
                height="24"
                rx="4"
                fill="rgba(220, 80, 80, 0.25)"
                stroke="var(--ohmni-lab-fault, #DC5050)"
                strokeWidth="1"
              />
              <text
                x="71"
                y="134"
                fill="#FFA3A3"
                fontSize="7"
                fontFamily="var(--font-mono)"
                fontWeight="700"
                textAnchor="middle"
              >
                ⚠ BROWNOUT TRIP (V &lt; 2.80V)
              </text>
              <text
                x="71"
                y="143"
                fill="#FF6B6B"
                fontSize="6"
                fontFamily="var(--font-mono)"
                textAnchor="middle"
              >
                CPU RESET TRIGGERED
              </text>
            </>
          )}
        </g>

        {/* =====================================================================
           COMPONENT 2: AMS1117 3.3V Low-Dropout Voltage Regulator
           ===================================================================== */}
        <g transform="translate(195, 120)">
          {/* SOT-223 Heatsink Tab (GND) */}
          <rect x="12" y="-6" width="22" height="6" fill="#64748B" rx="1" />
          {/* Plastic Body */}
          <rect width="46" height="28" rx="3" fill="#18202D" stroke="#334155" strokeWidth="1" />
          {/* Pins: 1:GND, 2:VOUT, 3:VIN */}
          <rect x="4" y="28" width="6" height="5" fill="url(#board-gold-pad)" rx="1" />
          <rect x="20" y="28" width="6" height="5" fill="url(#board-gold-pad)" rx="1" />
          <rect x="36" y="28" width="6" height="5" fill="url(#board-gold-pad)" rx="1" />

          <text x="23" y="14" fill="#F1F5F9" fontSize="7.5" fontFamily="var(--font-mono)" fontWeight="bold" textAnchor="middle">
            AMS1117
          </text>
          <text x="23" y="23" fill="#38BDF8" fontSize="6.5" fontFamily="var(--font-mono)" textAnchor="middle">
            3.3V LDO
          </text>
        </g>

        {/* =====================================================================
           COMPONENT 3: JUMPER HEADER JP1 (3-Pin Power Rail Selector)
           Pin 1: 3V3 | Pin 2: RELAY_VCC | Pin 3: 5V AUX
           ===================================================================== */}
        <g
          transform="translate(275, 185)"
          style={{ cursor: interactiveJumper || onMoveJumper ? "pointer" : "default" }}
          onClick={interactiveJumper && onMoveJumper ? onMoveJumper : undefined}
        >
          {/* Silkscreen Box around JP1 */}
          <rect
            x="-4"
            y="-4"
            width="44"
            height="26"
            rx="3"
            fill="#0F172A"
            stroke="rgba(255, 255, 255, 0.2)"
            strokeWidth="1"
          />
          <text x="18" y="-7" fill="#CBD5E1" fontSize="6.5" fontFamily="var(--font-mono)" fontWeight="700" textAnchor="middle">
            JP1 PWR SEL
          </text>

          {/* Header 3 Gold Pins */}
          {/* Pin 1: 3.3V Rail */}
          <circle cx="6" cy="9" r="4" fill="#0B0F17" stroke="url(#board-gold-pad)" strokeWidth="1.2" />
          <circle cx="6" cy="9" r="1.8" fill="#FFDF73" />
          <text x="6" y="20" fill="#94A3B8" fontSize="5.5" fontFamily="var(--font-mono)" textAnchor="middle">
            3V3
          </text>

          {/* Pin 2: Center Common to Relay */}
          <circle cx="18" cy="9" r="4" fill="#0B0F17" stroke="url(#board-gold-pad)" strokeWidth="1.2" />
          <circle cx="18" cy="9" r="1.8" fill="#FFDF73" />
          <text x="18" y="20" fill="#94A3B8" fontSize="5.5" fontFamily="var(--font-mono)" textAnchor="middle">
            COIL
          </text>

          {/* Pin 3: 5V Aux Rail */}
          <circle cx="30" cy="9" r="4" fill="#0B0F17" stroke="url(#board-gold-pad)" strokeWidth="1.2" />
          <circle cx="30" cy="9" r="1.8" fill="#FFDF73" />
          <text x="30" y="20" fill="#94A3B8" fontSize="5.5" fontFamily="var(--font-mono)" textAnchor="middle">
            5V
          </text>

          {/* Physical Jumper Shunt (Moves smoothly between [1-2] and [2-3]) */}
          <motion.g
            animate={{
              x: isJumperOn5V ? 12 : 0,
            }}
            transition={{
              type: "spring",
              stiffness: 320,
              damping: 24,
            }}
          >
            {/* Shunt Body: Black thermoplastic block with gold contacts */}
            <rect
              x="2"
              y="4"
              width="20"
              height="10"
              rx="2.5"
              fill="#1E293B"
              stroke={isJumperOn5V ? "var(--ohmni-lab-verified, #27966B)" : "var(--ohmni-lab-warning, #E59D37)"}
              strokeWidth="1.5"
              style={{
                filter: "drop-shadow(0 2px 4px rgba(0, 0, 0, 0.5))",
                transition: "stroke 0.2s",
              }}
            />
            {/* Internal Gold Shorting Clip */}
            <line
              x1="6"
              y1="9"
              x2="18"
              y2="9"
              stroke="url(#board-gold-pad)"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </motion.g>
        </g>

        {/* =====================================================================
           COMPONENT 4: Mechanical Relay Subsystem K1 (GPIO14)
           ===================================================================== */}
        <g
          id="relay-module-group"
          data-testid="relay-module-group"
          data-relay-state={isRelayEnergized ? "closed" : "open"}
          transform="translate(365, 105)"
        >
          {/* Relay Housing */}
          <rect
            width="88"
            height="95"
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
            width="78"
            height="22"
            rx="3"
            fill={relayCoilColor}
            style={{ transition: "fill 0.15s" }}
          />
          <text
            x="44"
            y="19"
            fill={isRelayEnergized ? "#12151A" : "#F4F5F7"}
            fontSize="9"
            fontFamily="var(--font-mono)"
            fontWeight="bold"
            textAnchor="middle"
          >
            RELAY K1
          </text>
          <text x="44" y="39" fill="#8E95A2" fontSize="7.5" fontFamily="var(--font-mono)" textAnchor="middle">
            OMRON G5V-1 • 5V/3V
          </text>
          <text
            x="44"
            y="51"
            fill={isRelayEnergized ? "var(--ohmni-lab-warning, #E59D37)" : "#64748B"}
            fontSize="7"
            fontFamily="var(--font-mono)"
            fontWeight="700"
            textAnchor="middle"
          >
            {isRelayEnergized ? "⚡ COIL ENERGIZED" : "COIL OPEN (PIN 14)"}
          </text>

          {/* Flyback Diode D1 Silkscreen */}
          <g transform="translate(10, 62)">
            <line x1="0" y1="6" x2="20" y2="6" stroke="#64748B" strokeWidth="1" />
            <polygon points="6,2 14,6 6,10" fill="#E59D37" />
            <line x1="14" y1="2" x2="14" y2="10" stroke="#E59D37" strokeWidth="1.5" />
            <text x="10" y="16" fill="#64748B" fontSize="5" fontFamily="var(--font-mono)" textAnchor="middle">
              1N4148
            </text>
          </g>

          {/* Mechanical Armature Switch Contacts */}
          <g transform="translate(30, 60)">
            <circle cx="16" cy="18" r="3.5" fill="#64748B" />
            <circle cx="48" cy="18" r="3.5" fill="#64748B" />
            <line
              id="relay-armature-lever"
              data-testid="relay-armature-lever"
              data-relay-state={isRelayEnergized ? "closed" : "open"}
              x1="16"
              y1="18"
              x2="46"
              y2={isRelayEnergized ? "18" : "9"}
              stroke={isRelayEnergized ? "var(--ohmni-lab-warning, #E59D37)" : "#E2E8F0"}
              strokeWidth="2.5"
              strokeLinecap="round"
              style={{ transition: "all 0.1s cubic-bezier(0.16, 1, 0.3, 1)" }}
            />
            <text x="32" y="32" fill="#64748B" fontSize="5.5" fontFamily="var(--font-mono)" textAnchor="middle">
              {isRelayEnergized ? "CLOSED (NO)" : "OPEN (NO)"}
            </text>
          </g>
        </g>

        {/* =====================================================================
           COMPONENT 5: 12V High-Current Fan Load (Top Right)
           ===================================================================== */}
        <g transform="translate(415, 25)">
          <rect width="84" height="68" rx="6" fill="#181F2C" stroke="rgba(255, 255, 255, 0.15)" strokeWidth="1" />
          <circle cx="42" cy="34" r="24" fill="#0B0F17" stroke="rgba(255, 255, 255, 0.1)" />

          {/* Rotating Fan Blades */}
          <g className={isRelayEnergized ? "board-fan-rotor" : undefined} transform="translate(42, 34)">
            <circle cx="0" cy="0" r="6" fill="var(--ohmni-lab-brand, #4967FF)" />
            <path d="M 0 -6 C 8 -14 14 -14 14 -6 C 14 0 8 0 0 0 Z" fill="#64748B" opacity="0.9" />
            <path d="M 6 0 C 14 8 14 14 6 14 C 0 14 0 8 0 0 Z" fill="#64748B" opacity="0.9" />
            <path d="M 0 6 C -8 14 -14 14 -14 6 C -14 0 -8 0 0 0 Z" fill="#64748B" opacity="0.9" />
            <path d="M -6 0 C -14 -8 -14 -14 -6 -14 C 0 -14 0 -8 0 0 Z" fill="#64748B" opacity="0.9" />
          </g>
          <text x="42" y="62" fill="#94A3B8" fontSize="6.5" fontFamily="var(--font-mono)" textAnchor="middle">
            12V FAN LOAD (M1)
          </text>
        </g>

        {/* =====================================================================
           STATUS & POWER LEDS (Near ESP32)
           ===================================================================== */}
        {/* PWR 3V3 LED */}
        <g transform="translate(195, 60)">
          <circle cx="8" cy="8" r="6" fill="#070A0F" stroke="#334155" strokeWidth="1" />
          <circle
            id="power-led"
            data-testid="power-led"
            cx="8"
            cy="8"
            r="4"
            fill={powerLedColor}
            style={{
              filter: isConnected ? `drop-shadow(0 0 6px ${powerLedColor})` : "none",
              transition: "fill 0.2s, filter 0.2s",
            }}
          />
          <text x="18" y="11" fill="#94A3B8" fontSize="7" fontFamily="var(--font-mono)" fontWeight="600">
            PWR 3V3
          </text>
        </g>

        {/* STAT / RST LED */}
        <g transform="translate(195, 85)">
          <circle cx="8" cy="8" r="6" fill="#070A0F" stroke="#334155" strokeWidth="1" />
          <circle
            id="esp32-status-led"
            data-testid="esp32-status-led"
            cx="8"
            cy="8"
            r="4"
            fill={statusLedColor}
            className={isBrownout ? "board-reset-led" : undefined}
            style={{
              filter: isConnected ? `drop-shadow(0 0 6px ${statusLedColor})` : "none",
              transition: "fill 0.2s, filter 0.2s",
            }}
          />
          <text x="18" y="11" fill="#94A3B8" fontSize="7" fontFamily="var(--font-mono)" fontWeight="600">
            STAT / RST
          </text>
        </g>

        {/* Peripheral I/O Header Terminal Pins (Left & Right Edge) */}
        <g transform="translate(8, 25)">
          {Array.from({ length: 16 }).map((_, i) => (
            <circle key={`lpin-${i}`} cx="6" cy={i * 15 + 6} r="3" fill="#0F172A" stroke="url(#board-gold-pad)" strokeWidth="0.8" />
          ))}
        </g>
        <g transform="translate(526, 25)">
          {Array.from({ length: 16 }).map((_, i) => (
            <circle key={`rpin-${i}`} cx="6" cy={i * 15 + 6} r="3" fill="#0F172A" stroke="url(#board-gold-pad)" strokeWidth="0.8" />
          ))}
        </g>
      </svg>

      {/* =====================================================================
         ELECTRICAL CAUSE-AND-EFFECT HUD READOUT
         ===================================================================== */}
      {isDiagnostic && (
        <div className="board-diagnostic-readout" aria-live="polite">
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span
              style={{
                display: "inline-block",
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                background: isVerified
                  ? "var(--ohmni-lab-verified, #27966B)"
                  : isBrownout
                  ? "var(--ohmni-lab-fault, #DC5050)"
                  : "var(--ohmni-lab-warning, #E59D37)",
                boxShadow: `0 0 8px ${
                  isVerified
                    ? "rgba(39, 150, 107, 0.6)"
                    : isBrownout
                    ? "rgba(220, 80, 80, 0.6)"
                    : "rgba(229, 157, 55, 0.6)"
                }`,
              }}
            />
            <span className="board-diagnostic-state">
              {isVerified ? "POWER PATH VERIFIED" : isBrownout ? "FAULT CAPTURED" : "LOAD TEST RUNNING"}
            </span>
          </div>

          <div className="board-diagnostic-cause">
            {isVerified
              ? `JP1 5V isolated → ${effectiveVoltage.toFixed(2)} V stable`
              : isBrownout
              ? `${effectiveVoltage.toFixed(2)} V minimum → MCU brownout reset`
              : "3V3 rail → K1 coil → fan load"}
          </div>
        </div>
      )}
    </div>
  );
};
