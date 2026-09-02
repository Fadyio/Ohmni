/**
 * Scene 1 — Observing State (Hardware State & Reset History Observation).
 *
 * Requirements:
 * - Before read_reset_history actually returns: "No reset history inspected yet."
 * - Only after read_reset_history executes: animate values from blank -> measured values.
 * - Shows hardware schematic & live baseline oscilloscope preview.
 * - Uses Lab Mode dark palette (Canvas #090B10, Raised #11141B, Text #F5F6F8).
 */

import React, { useRef, useEffect } from "react";
import { motion } from "motion/react";
import { RotateCcw, AlertTriangle, ShieldCheck, Activity, Clock, Terminal } from "lucide-react";

export interface ObservingSceneProps {
  readonly resetCount: number;
  readonly railVoltage: number;
  readonly hasInspectedResetHistory?: boolean;
}

export const ObservingScene: React.FC<ObservingSceneProps> = ({
  resetCount,
  railVoltage,
  hasInspectedResetHistory = false,
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
    ctx.strokeStyle = "rgba(255, 181, 74, 0.6)";
    ctx.lineWidth = 1;
    ctx.moveTo(30, 45);
    ctx.lineTo(width - 20, 45);
    ctx.stroke();

    // 3.31V baseline line
    ctx.beginPath();
    ctx.setLineDash([]);
    ctx.strokeStyle = "#45B8FF";
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
        gap: "1.75rem",
        height: "100%",
        color: "var(--ohmni-lab-text)",
      }}
    >
      {/* Scene Header */}
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "var(--ohmni-lab-signal)", fontSize: "12.5px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
          <Activity size={14} />
          OBSERVING • HARDWARE STATE
        </div>
        <h2 style={{ fontSize: "28px", fontWeight: 800, color: "var(--ohmni-lab-text)", margin: "6px 0 0", letterSpacing: "-0.02em" }}>
          Microcontroller Reset History
        </h2>
        <p style={{ margin: "6px 0 0", fontSize: "14.5px", color: "var(--ohmni-lab-muted)" }}>
          {hasInspectedResetHistory
            ? "Diagnostic registers read via read_reset_history."
            : "No reset history inspected yet."}
        </p>
      </div>

      {/* 3 Reset Register Metric Display */}
      {!hasInspectedResetHistory ? (
        <div
          style={{
            background: "var(--ohmni-lab-raised)",
            border: "1px dashed var(--ohmni-lab-border)",
            borderRadius: "var(--radius-lg)",
            padding: "2rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--ohmni-lab-muted)",
            fontSize: "14px",
          }}
        >
          <span>No reset history inspected yet. Agent is preparing observation tool call.</span>
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: "14px",
          }}
        >
          {/* Brownout Register */}
          <div
            style={{
              background: "var(--ohmni-lab-raised)",
              border: "1px solid rgba(255, 89, 95, 0.35)",
              borderRadius: "var(--radius-lg)",
              padding: "1.25rem 1.4rem",
              boxShadow: "0 0 20px rgba(255, 89, 95, 0.08)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span className="font-mono" style={{ fontSize: "12px", fontWeight: 700, color: "var(--ohmni-lab-fault)" }}>
                BROWNOUT (BOD)
              </span>
              <RotateCcw size={16} color="var(--ohmni-lab-fault)" />
            </div>

            <div className="font-mono" style={{ fontSize: "36px", fontWeight: 800, color: "var(--ohmni-lab-fault)", margin: "0.5rem 0 0.25rem" }}>
              {resetCount}
            </div>

            <div style={{ fontSize: "12px", color: "var(--ohmni-lab-muted)" }}>
              Supply fell below 2.80V threshold
            </div>
          </div>

          {/* Watchdog Register */}
          <div
            style={{
              background: "var(--ohmni-lab-raised)",
              border: "1px solid var(--ohmni-lab-border)",
              borderRadius: "var(--radius-lg)",
              padding: "1.25rem 1.4rem",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span className="font-mono" style={{ fontSize: "12px", fontWeight: 700, color: "var(--ohmni-lab-muted)" }}>
                WATCHDOG TIMER
              </span>
              <Clock size={16} color="var(--ohmni-lab-muted)" />
            </div>

            <div className="font-mono" style={{ fontSize: "36px", fontWeight: 800, color: "var(--ohmni-lab-text)", margin: "0.5rem 0 0.25rem" }}>
              0
            </div>

            <div style={{ fontSize: "12px", color: "var(--ohmni-lab-muted)" }}>
              No execution timeouts recorded
            </div>
          </div>

          {/* Software Reset Register */}
          <div
            style={{
              background: "var(--ohmni-lab-raised)",
              border: "1px solid var(--ohmni-lab-border)",
              borderRadius: "var(--radius-lg)",
              padding: "1.25rem 1.4rem",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span className="font-mono" style={{ fontSize: "12px", fontWeight: 700, color: "var(--ohmni-lab-muted)" }}>
                SOFTWARE PANIC
              </span>
              <ShieldCheck size={16} color="var(--ohmni-lab-verified)" />
            </div>

            <div className="font-mono" style={{ fontSize: "36px", fontWeight: 800, color: "var(--ohmni-lab-text)", margin: "0.5rem 0 0.25rem" }}>
              0
            </div>

            <div style={{ fontSize: "12px", color: "var(--ohmni-lab-muted)" }}>
              No firmware crash assertions
            </div>
          </div>
        </div>
      )}

      {/* Live Oscilloscope Baseline Strip */}
      <div
        style={{
          background: "var(--ohmni-lab-raised)",
          border: "1px solid var(--ohmni-lab-border)",
          borderRadius: "var(--radius-lg)",
          padding: "1rem 1.25rem",
          display: "flex",
          flexDirection: "column",
          gap: "8px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span className="font-mono" style={{ fontSize: "12px", fontWeight: 700, color: "var(--ohmni-lab-signal)" }}>
            LIVE SCOPE BASELINE • {railVoltage > 0 ? railVoltage.toFixed(2) : "3.31"} V
          </span>
          <span className="font-mono" style={{ fontSize: "11px", color: "var(--ohmni-lab-action)" }}>
            2.80V BOD LIMIT ARMED
          </span>
        </div>
        <canvas
          ref={canvasRef}
          width={600}
          height={65}
          style={{
            width: "100%",
            height: "65px",
            display: "block",
            borderRadius: "4px",
          }}
        />
      </div>
    </motion.div>
  );
};
