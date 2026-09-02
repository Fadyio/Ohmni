/**
 * Scene 1 — Observing State (Reset History & Sensor Inspection).
 * Displays the diagnostic readout of the ESP32-S3 reset reason registers:
 * - Brownout: 3 events (Active fault trigger)
 * - Watchdog: 0 events
 * - Software: 0 events
 * - Real-time baseline oscilloscope preview canvas
 */

import React, { useRef, useEffect } from "react";
import { motion } from "motion/react";
import { RotateCcw, AlertTriangle, ShieldCheck, Cpu, Activity, Clock } from "lucide-react";

export interface ObservingSceneProps {
  readonly resetCount: number;
  readonly railVoltage: number;
}

export const ObservingScene: React.FC<ObservingSceneProps> = ({
  resetCount,
  railVoltage,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    ctx.fillStyle = "#0C1017";
    ctx.fillRect(0, 0, width, height);

    // 2.80V threshold line
    ctx.beginPath();
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = "rgba(229, 154, 37, 0.6)";
    ctx.lineWidth = 1;
    ctx.moveTo(30, 45);
    ctx.lineTo(width - 20, 45);
    ctx.stroke();

    // 3.31V baseline line
    ctx.beginPath();
    ctx.setLineDash([]);
    ctx.strokeStyle = "#38BDF8";
    ctx.lineWidth = 2;
    ctx.moveTo(30, 22);
    ctx.lineTo(width - 20, 22);
    ctx.stroke();
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "1.5rem",
        height: "100%",
      }}
    >
      {/* Scene Header */}
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "var(--ohmni-brand)", fontSize: "13px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em" }}>
          <Activity size={15} />
          Current Step • Hardware State Observation
        </div>
        <h2 className="scene-heading" style={{ margin: "4px 0 0" }}>
          Microcontroller Reset History
        </h2>
        <p className="body-text" style={{ margin: "4px 0 0", fontSize: "15px" }}>
          The agent read the hardware reset register table via <span className="font-mono" style={{ fontWeight: 600, color: "var(--ohmni-ink)" }}>read_reset_history</span>.
        </p>
      </div>

      {/* 3 Reset Register Metric Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
          gap: "14px",
        }}
      >
        {/* Brownout Card (Critical) */}
        <div
          style={{
            background: "var(--ohmni-surface)",
            border: "1.5px solid rgba(217, 74, 69, 0.3)",
            borderRadius: "var(--radius-lg)",
            padding: "1.25rem 1.4rem",
            boxShadow: "var(--shadow-card)",
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--ohmni-fault)" }}>
              BROWNOUT (BOD)
            </span>
            <RotateCcw size={16} color="var(--ohmni-fault)" />
          </div>

          <div className="major-value" style={{ color: "var(--ohmni-fault)", margin: "0.5rem 0 0.25rem" }}>
            3
          </div>

          <div style={{ fontSize: "12px", color: "var(--ohmni-text-muted)" }}>
            Supply voltage fell below 2.80 V threshold
          </div>
        </div>

        {/* Watchdog Card */}
        <div
          style={{
            background: "var(--ohmni-surface)",
            border: "1px solid var(--ohmni-border)",
            borderRadius: "var(--radius-lg)",
            padding: "1.25rem 1.4rem",
            boxShadow: "var(--shadow-card)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--ohmni-secondary)" }}>
              WATCHDOG TIMER
            </span>
            <Clock size={16} color="var(--ohmni-text-muted)" />
          </div>

          <div className="major-value" style={{ color: "var(--ohmni-ink)", margin: "0.5rem 0 0.25rem" }}>
            0
          </div>

          <div style={{ fontSize: "12px", color: "var(--ohmni-text-muted)" }}>
            No task execution timeouts
          </div>
        </div>

        {/* Software Reset Card */}
        <div
          style={{
            background: "var(--ohmni-surface)",
            border: "1px solid var(--ohmni-border)",
            borderRadius: "var(--radius-lg)",
            padding: "1.25rem 1.4rem",
            boxShadow: "var(--shadow-card)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--ohmni-secondary)" }}>
              SOFTWARE PANIC
            </span>
            <ShieldCheck size={16} color="var(--ohmni-success)" />
          </div>

          <div className="major-value" style={{ color: "var(--ohmni-ink)", margin: "0.5rem 0 0.25rem" }}>
            0
          </div>

          <div style={{ fontSize: "12px", color: "var(--ohmni-text-muted)" }}>
            No firmware crash assertions
          </div>
        </div>
      </div>

      {/* Live Oscilloscope Baseline Strip */}
      <div
        style={{
          background: "var(--ohmni-surface-dark)",
          borderRadius: "var(--radius-lg)",
          padding: "1rem 1.25rem",
          display: "flex",
          flexDirection: "column",
          gap: "8px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span className="font-mono" style={{ fontSize: "12px", fontWeight: 700, color: "#38BDF8" }}>
            LIVE SCOPE BASELINE • {railVoltage.toFixed(2)} V
          </span>
          <span className="font-mono" style={{ fontSize: "11px", color: "#94A3B8" }}>
            2.80V BOD LIMIT ARMED
          </span>
        </div>
        <canvas
          ref={canvasRef}
          width={600}
          height={70}
          style={{
            width: "100%",
            height: "70px",
            display: "block",
            borderRadius: "4px",
          }}
        />
      </div>
    </motion.div>
  );
};
