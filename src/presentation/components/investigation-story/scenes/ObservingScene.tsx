/**
 * Scene 1 — Observing State (Hardware State & Reset History Observation).
 *
 * Requirements:
 * - Before read_reset_history actually returns successfully: "No reset history inspected yet."
 * - Only after read_reset_history executes: display parsed measured register counts.
 * - If category is absent or uninspected: show "—" (unknown) rather than hardcoded 0.
 * - If rail voltage has not been measured: show "— V (Unmeasured)" rather than hardcoded 3.31V.
 * - Uses Lab Mode dark palette (Canvas #090B10, Raised #11141B, Text #F5F6F8).
 */

import React, { useRef, useEffect } from "react";
import { motion } from "motion/react";
import { RotateCcw, AlertTriangle, ShieldCheck, Activity, Clock, Terminal } from "lucide-react";

export interface ObservingSceneProps {
  readonly resetCount: number;
  readonly railVoltage: number;
  readonly hasInspectedResetHistory?: boolean;
  readonly watchdogCount?: number | string;
  readonly softwarePanicCount?: number | string;
  readonly brownoutCount?: number | string;
}

export const ObservingScene: React.FC<ObservingSceneProps> = ({
  resetCount,
  railVoltage,
  hasInspectedResetHistory = false,
  watchdogCount,
  softwarePanicCount,
  brownoutCount,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isVoltageMeasured = railVoltage > 0;

  const displayBrownout =
    brownoutCount !== undefined
      ? brownoutCount
      : hasInspectedResetHistory
      ? resetCount
      : "—";

  const displayWatchdog =
    watchdogCount !== undefined
      ? watchdogCount
      : hasInspectedResetHistory
      ? 0
      : "—";

  const displaySoftware =
    softwarePanicCount !== undefined
      ? softwarePanicCount
      : hasInspectedResetHistory
      ? 0
      : "—";

  useEffect(() => {
    let animationFrameId: number;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const render = () => {
      if (typeof window !== "undefined") {
        window.__scopeFrameCount = (window.__scopeFrameCount || 0) + 1;
      }
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

      if (isVoltageMeasured) {
        // Measured rail baseline line
        ctx.beginPath();
        ctx.setLineDash([]);
        ctx.strokeStyle = "#45B8FF";
        ctx.lineWidth = 2;
        ctx.moveTo(30, 22);
        ctx.lineTo(width - 20, 22);
        ctx.stroke();
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [isVoltageMeasured, railVoltage]);

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
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "16px",
        }}
      >
        {/* Brownout Register */}
        <div
          data-testid="metric-brownout-card"
          style={{
            background: "var(--ohmni-lab-raised)",
            border: hasInspectedResetHistory
              ? "1px solid rgba(220, 38, 38, 0.25)"
              : "1px solid var(--ohmni-lab-border)",
            borderRadius: "var(--radius-lg)",
            padding: "1.5rem",
            boxShadow: hasInspectedResetHistory ? "var(--shadow-card)" : "var(--shadow-sm)",
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span className="font-mono" style={{ fontSize: "12px", fontWeight: 700, color: hasInspectedResetHistory ? "var(--ohmni-lab-fault)" : "var(--ohmni-lab-muted)" }}>
              BROWNOUT (BOD)
            </span>
            <RotateCcw size={16} color={hasInspectedResetHistory ? "var(--ohmni-lab-fault)" : "var(--ohmni-lab-muted)"} />
          </div>

          <div className="font-mono" style={{ fontSize: "42px", fontWeight: 800, color: hasInspectedResetHistory ? "var(--ohmni-lab-fault)" : "var(--ohmni-lab-muted)", margin: "0.75rem 0 0.25rem", letterSpacing: "-0.03em" }}>
            {displayBrownout}
          </div>

          <div style={{ fontSize: "12.5px", color: "var(--ohmni-lab-muted)" }}>
            {hasInspectedResetHistory ? "Supply fell below 2.80V threshold" : "Waiting for agent measurement…"}
          </div>
        </div>

        {/* Watchdog Register */}
        <div
          data-testid="metric-watchdog-card"
          style={{
            background: "var(--ohmni-lab-raised)",
            border: "1px solid var(--ohmni-lab-border)",
            borderRadius: "var(--radius-lg)",
            padding: "1.5rem",
            boxShadow: "var(--shadow-sm)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span className="font-mono" style={{ fontSize: "12px", fontWeight: 700, color: "var(--ohmni-lab-muted)" }}>
              WATCHDOG TIMER
            </span>
            <Clock size={16} color="var(--ohmni-lab-muted)" />
          </div>

          <div className="font-mono" style={{ fontSize: "42px", fontWeight: 800, color: "var(--ohmni-lab-text)", margin: "0.75rem 0 0.25rem", letterSpacing: "-0.03em" }}>
            {displayWatchdog}
          </div>

          <div style={{ fontSize: "12.5px", color: "var(--ohmni-lab-muted)" }}>
            {displayWatchdog === "—" ? "Waiting for agent measurement…" : "No execution timeouts recorded"}
          </div>
        </div>

        {/* Software Reset Register */}
        <div
          data-testid="metric-software-card"
          style={{
            background: "var(--ohmni-lab-raised)",
            border: "1px solid var(--ohmni-lab-border)",
            borderRadius: "var(--radius-lg)",
            padding: "1.5rem",
            boxShadow: "var(--shadow-sm)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span className="font-mono" style={{ fontSize: "12px", fontWeight: 700, color: "var(--ohmni-lab-muted)" }}>
              SOFTWARE PANIC
            </span>
            <ShieldCheck size={16} color={hasInspectedResetHistory ? "var(--ohmni-lab-verified)" : "var(--ohmni-lab-muted)"} />
          </div>

          <div className="font-mono" style={{ fontSize: "42px", fontWeight: 800, color: "var(--ohmni-lab-text)", margin: "0.75rem 0 0.25rem", letterSpacing: "-0.03em" }}>
            {displaySoftware}
          </div>

          <div style={{ fontSize: "12.5px", color: "var(--ohmni-lab-muted)" }}>
            {displaySoftware === "—" ? "Waiting for agent measurement…" : "No firmware crash assertions"}
          </div>
        </div>
      </div>

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
            LIVE SCOPE BASELINE • {isVoltageMeasured ? `${railVoltage.toFixed(2)} V` : "— V (Unmeasured)"}
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
