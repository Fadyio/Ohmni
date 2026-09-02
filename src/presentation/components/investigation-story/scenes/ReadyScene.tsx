/**
 * Scene 0 — Ready to Investigate (Initial Lab Entry State).
 * Milestone 7.13 — Visual Rescue: 3D OHMNI Identity + Cohesive Product UI
 *
 * Requirements:
 * - After entering the lab: initial state is READY TO INVESTIGATE (not reset history until requested).
 * - Large hardware device in the center of the main canvas.
 * - Layered depth, soft shadows, subtle pointer micro-parallax (rotateX 2deg, rotateY -3deg).
 * - Board connection & boot animation: USB/power enters, power LED turns on, status LED blinks, trace illuminates.
 * - Live baseline telemetry canvas incrementing 60fps frame count.
 */

import React, { useState, useCallback, useRef, useEffect } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Cpu, Zap, Activity, ShieldCheck, Radio } from "lucide-react";
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
  onStartInvestigation,
}) => {
  const shouldReduceMotion = useReducedMotion();
  const [rotX, setRotX] = useState<number>(2);
  const [rotY, setRotY] = useState<number>(-3);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (shouldReduceMotion) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const normX = (e.clientX - (rect.left + rect.width / 2)) / (rect.width / 2);
      const normY = (e.clientY - (rect.top + rect.height / 2)) / (rect.height / 2);
      setRotY(normX * 4 - 2);
      setRotX(-normY * 3 + 1);
    },
    [shouldReduceMotion]
  );

  const handlePointerLeave = useCallback(() => {
    setRotX(2);
    setRotY(-3);
  }, []);

  // 60fps telemetry baseline canvas loop
  useEffect(() => {
    let animationFrameId: number;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let offset = 0;

    const render = () => {
      if (typeof window !== "undefined") {
        window.__scopeFrameCount = (window.__scopeFrameCount || 0) + 1;
      }

      const width = canvas.width;
      const height = canvas.height;

      ctx.fillStyle = "#0B1017";
      ctx.fillRect(0, 0, width, height);

      // Center baseline line at 3.31V
      ctx.beginPath();
      ctx.strokeStyle = "rgba(73, 103, 255, 0.75)";
      ctx.lineWidth = 1.5;

      offset += 0.05;
      for (let x = 0; x < width; x++) {
        const noise = Math.sin(x * 0.06 + offset) * 0.8 + (Math.random() - 0.5) * 0.4;
        const y = height / 2 + noise;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      if (!shouldReduceMotion) {
        animationFrameId = requestAnimationFrame(render);
      }
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [shouldReduceMotion]);

  return (
    <motion.div
      data-testid="ready-scene"
      id="ready-scene"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100%",
        padding: "1rem 2rem 2.5rem",
        gap: "1.75rem",
        width: "100%",
        boxSizing: "border-box",
      }}
    >
      {/* Scene Header */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          textAlign: "center",
          gap: "8px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "4px 12px",
              borderRadius: "var(--radius-full)",
              background: "rgba(39, 150, 107, 0.1)",
              border: "1px solid rgba(39, 150, 107, 0.25)",
              color: "var(--ohmni-lab-verified)",
              fontSize: "12px",
              fontWeight: 700,
              letterSpacing: "0.04em",
            }}
          >
            <span
              style={{
                width: "6px",
                height: "6px",
                borderRadius: "50%",
                background: "var(--ohmni-lab-verified)",
                boxShadow: "0 0 6px rgba(39, 150, 107, 0.8)",
              }}
            />
            TARGET HARDWARE ONLINE
          </span>
        </div>

        <h2
          style={{
            fontSize: "clamp(28px, 3.2vw, 36px)",
            fontWeight: 800,
            letterSpacing: "-0.025em",
            color: "var(--ohmni-lab-text)",
            margin: 0,
          }}
        >
          Ready to Investigate
        </h2>

        <p
          style={{
            fontSize: "15px",
            color: "var(--ohmni-lab-muted)",
            margin: 0,
            maxWidth: "560px",
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
          maxWidth: "680px",
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

      {/* Hardware Instrument Status Badges + Mini Baseline */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "center",
          gap: "12px",
          marginTop: "4px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "8px 16px",
            borderRadius: "var(--radius-md)",
            background: "var(--ohmni-lab-raised)",
            border: "1px solid var(--ohmni-lab-border)",
            boxShadow: "var(--shadow-sm)",
            fontSize: "13px",
            fontWeight: 600,
            color: "var(--ohmni-lab-text)",
          }}
        >
          <Zap size={14} color="var(--ohmni-lab-brand)" />
          <span>VCC Supply: 3.31 V</span>
          <canvas
            ref={canvasRef}
            width={48}
            height={16}
            style={{
              display: "inline-block",
              borderRadius: "3px",
              marginLeft: "4px",
            }}
          />
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "8px 16px",
            borderRadius: "var(--radius-md)",
            background: "var(--ohmni-lab-raised)",
            border: "1px solid var(--ohmni-lab-border)",
            boxShadow: "var(--shadow-sm)",
            fontSize: "13px",
            fontWeight: 600,
            color: "var(--ohmni-lab-text)",
          }}
        >
          <Cpu size={14} color="var(--ohmni-lab-signal)" />
          <span>SoC: ESP32-S3 Dual-Core</span>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "8px 16px",
            borderRadius: "var(--radius-md)",
            background: "var(--ohmni-lab-raised)",
            border: "1px solid var(--ohmni-lab-border)",
            boxShadow: "var(--shadow-sm)",
            fontSize: "13px",
            fontWeight: 600,
            color: "var(--ohmni-lab-text)",
          }}
        >
          <Radio size={14} color="var(--ohmni-lab-warning)" />
          <span>GPIO14 Relay: Standby (Open)</span>
        </div>
      </div>
    </motion.div>
  );
};
