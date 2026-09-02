/**
 * Scene 0 — Ready to Investigate (Initial Lab Entry State).
 * Milestone 7.14 — Cohesive Workbench & Quiet Instrument Strip.
 *
 * Requirements:
 * - data-scene="ready" for state assertion
 * - Central hardware PCB with soft lighting
 * - Quiet instrument strip: 3.31 V supply • Relay open • No active experiment
 * - Less card UI chrome
 */

import React, { useState, useCallback } from "react";
import { motion, useReducedMotion } from "motion/react";
import { BoardSilhouette } from "../../device/BoardSilhouette";

export interface ReadySceneProps {
  readonly isConnected?: boolean;
  readonly relayState?: "open" | "closed";
  readonly railVoltage?: number;
  readonly onStartInvestigation?: () => void;
}

export const ReadyScene: React.FC<ReadySceneProps> = ({
  isConnected = true,
  relayState = "open",
  railVoltage = 3.31,
}) => {
  const shouldReduceMotion = useReducedMotion();
  const [rotX, setRotX] = useState<number>(2);
  const [rotY, setRotY] = useState<number>(-3);

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (shouldReduceMotion) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const normX = (e.clientX - rect.left) / rect.width - 0.5;
      const normY = (e.clientY - rect.top) / rect.height - 0.5;
      setRotY(normX * 6);
      setRotX(-normY * 4);
    },
    [shouldReduceMotion]
  );

  const handlePointerLeave = useCallback(() => {
    setRotX(2);
    setRotY(-3);
  }, []);

  return (
    <motion.div
      data-scene="ready"
      data-testid="ready-scene"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100%",
        gap: "1.5rem",
        textAlign: "center",
        padding: "1rem 0",
      }}
    >
      {/* Title & Description */}
      <div>
        <h2
          style={{
            fontSize: "26px",
            fontWeight: 800,
            color: "var(--ohmni-lab-text)",
            letterSpacing: "-0.02em",
            margin: "0 0 6px",
          }}
        >
          Diagnostic workbench online.
        </h2>
        <p
          style={{
            margin: 0,
            fontSize: "14px",
            color: "var(--ohmni-lab-muted)",
            maxWidth: "540px",
            lineHeight: 1.5,
          }}
        >
          The environmental controller hardware is energized and bound to the WebMCP instrument mesh. The AI agent will begin physical measurements on demand.
        </p>
      </div>

      {/* Hero Hardware Object Container with 3D Parallax */}
      <motion.div
        id="hardware-target-node"
        data-testid="hardware-target-node"
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
        animate={{
          rotateX: rotX,
          rotateY: rotY,
        }}
        transition={{
          type: "spring",
          stiffness: 120,
          damping: 18,
          mass: 0.5,
        }}
        style={{
          perspective: "1000px",
          transformStyle: "preserve-3d",
          width: "100%",
          maxWidth: "660px",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          cursor: "default",
          filter: "drop-shadow(0 24px 48px rgba(18, 21, 26, 0.12))",
        }}
      >
        <div style={{ width: "100%", transformStyle: "preserve-3d" }}>
          <BoardSilhouette
            isConnected={isConnected}
            relayState={relayState}
            statusVisual={isConnected ? "nominal" : "disconnected"}
          />
        </div>
      </motion.div>

      {/* Quiet Instrument Strip */}
      <div
        data-testid="lab-instrument-strip"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "14px",
          padding: "7px 18px",
          borderRadius: "var(--radius-full)",
          background: "var(--ohmni-lab-soft-raised)",
          border: "1px solid var(--ohmni-lab-border)",
          fontSize: "13px",
          fontWeight: 600,
          color: "var(--ohmni-lab-text)",
          marginTop: "4px",
        }}
      >
        <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
          <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: "#4967FF" }} />
          <span>{railVoltage.toFixed(2)} V supply</span>
        </span>
        <span style={{ color: "var(--ohmni-lab-border)" }}>•</span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
          <span
            style={{
              width: "7px",
              height: "7px",
              borderRadius: "50%",
              background: relayState === "open" ? "#94A3B8" : "#E59D37",
            }}
          />
          <span style={{ textTransform: "capitalize" }}>Relay {relayState}</span>
        </span>
        <span style={{ color: "var(--ohmni-lab-border)" }}>•</span>
        <span style={{ color: "var(--ohmni-lab-muted)" }}>
          No active experiment
        </span>
      </div>
    </motion.div>
  );
};
