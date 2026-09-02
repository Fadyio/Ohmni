/**
 * Abstract Agent Node Indicator.
 * Milestone 7.13 — Visual Rescue: 3D OHMNI Identity + Cohesive Product UI
 *
 * Requirements:
 * - Abstract agent visual identity (not a generic bot icon).
 * - Small circular orb with luminous blue/white core and subtle orbital ring.
 * - States:
 *     Idle: Still luminous orb
 *     Requesting / Investigating: Slow breathing pulse
 *     Tool Execution / Actuation: Orbital ring contracts & emits signal
 */

import React from "react";
import { motion, useReducedMotion } from "motion/react";

export interface AgentOrbNodeProps {
  readonly status: "idle" | "investigating" | "approval" | "completed" | "failed" | "stopped" | string;
  readonly isExecutingTool?: boolean;
  readonly size?: number;
  readonly className?: string;
  readonly style?: React.CSSProperties;
}

export const AgentOrbNode: React.FC<AgentOrbNodeProps> = ({
  status,
  isExecutingTool = false,
  size = 24,
  className = "",
  style,
}) => {
  const shouldReduceMotion = useReducedMotion();
  const isActive = status === "investigating" || status === "approval";
  const isFailed = status === "failed";
  const isCompleted = status === "completed";

  const coreColor = isFailed
    ? "var(--ohmni-lab-fault, #DC5050)"
    : isCompleted
    ? "var(--ohmni-lab-verified, #27966B)"
    : "var(--ohmni-lab-brand, #4967FF)";

  return (
    <div
      id="agent-orb-node"
      data-testid="agent-orb-node"
      className={`agent-orb-node ${className}`}
      style={{
        position: "relative",
        width: `${size}px`,
        height: `${size}px`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        ...style,
      }}
    >
      {/* Outer Subtle Orbital Ring */}
      <motion.div
        animate={
          shouldReduceMotion
            ? {}
            : isExecutingTool
            ? { scale: 0.82, opacity: 1, borderColor: coreColor }
            : isActive
            ? { scale: [1, 1.25, 1], opacity: [0.4, 0.85, 0.4] }
            : { scale: 1, opacity: 0.35 }
        }
        transition={{
          duration: isExecutingTool ? 0.2 : isActive ? 1.8 : 0.4,
          repeat: isActive && !isExecutingTool ? Infinity : 0,
          ease: "easeInOut",
        }}
        style={{
          position: "absolute",
          top: "-3px",
          left: "-3px",
          right: "-3px",
          bottom: "-3px",
          borderRadius: "50%",
          border: `1.5px solid ${coreColor}`,
          pointerEvents: "none",
        }}
      />

      {/* Luminous Inner Core Orb */}
      <motion.div
        animate={
          shouldReduceMotion
            ? {}
            : isActive
            ? { scale: [1, 1.08, 1], opacity: [0.9, 1, 0.9] }
            : { scale: 1, opacity: 0.95 }
        }
        transition={{
          duration: 1.4,
          repeat: isActive ? Infinity : 0,
          ease: "easeInOut",
        }}
        style={{
          width: "100%",
          height: "100%",
          borderRadius: "50%",
          background: `radial-gradient(circle at 35% 35%, #FFFFFF 0%, ${coreColor} 65%, #0B1017 100%)`,
          boxShadow: `0 0 10px ${coreColor}88, 0 0 20px ${coreColor}44`,
        }}
      />
    </div>
  );
};
