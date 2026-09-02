/**
 * Signal Pulse Animation Component.
 *
 * Requirements:
 * An electric-blue pulse that travels from the Agent Rail across to the Target Instrument / Hardware
 * when Gemini executes a tool call, and returns with the measured result.
 */

import React from "react";
import { useReducedMotion } from "motion/react";

export interface SignalPulseProps {
  readonly isActive: boolean;
  readonly direction?: "agent-to-device" | "device-to-agent";
  readonly color?: string;
  readonly label?: string;
}

export const SignalPulse: React.FC<SignalPulseProps> = ({
  isActive,
  direction = "agent-to-device",
  color = "#45B8FF",
  label,
}) => {
  const shouldReduceMotion = useReducedMotion();

  if (!isActive || shouldReduceMotion) return null;

  return (
    <div
      data-testid="signal-pulse"
      id="signal-pulse"
      style={{
        position: "absolute",
        top: "50%",
        left: direction === "agent-to-device" ? "75%" : "25%",
        transform: "translate(-50%, -50%)",
        width: "14px",
        height: "14px",
        borderRadius: "50%",
        background: color,
        boxShadow: `0 0 20px ${color}, 0 0 40px ${color}`,
        pointerEvents: "none",
        zIndex: 999,
        transition: "left 0.45s cubic-bezier(0.16, 1, 0.3, 1)",
      }}
    >
      {label && (
        <span
          className="font-mono"
          style={{
            position: "absolute",
            top: "-20px",
            left: "50%",
            transform: "translateX(-50%)",
            fontSize: "10px",
            fontWeight: 700,
            color: color,
            whiteSpace: "nowrap",
            textShadow: `0 0 8px ${color}`,
          }}
        >
          {label}
        </span>
      )}
    </div>
  );
};
