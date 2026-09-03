/**
 * Scene 1 — Observing State (Hardware State & Reset History Observation).
 *
 * Requirements:
 * - Before read_reset_history actually returns successfully: "No reset history inspected yet."
 * - Only after read_reset_history executes: display parsed measured register counts.
 * - If category is absent or uninspected: show "—" (unknown) rather than hardcoded 0.
 * - If rail voltage has not been measured: show "— V (Unmeasured)" rather than hardcoded 3.31 V.
 * - Uses Lab Mode dark palette (Canvas #090B10, Raised #11141B, Text #F5F6F8).
 */

import React, { useRef, useEffect } from "react";
import { motion } from "motion/react";
import { RotateCcw, AlertTriangle, ShieldCheck, Activity, Clock, Terminal } from "lucide-react";

export interface ObservingSceneProps {
  readonly resetCount?: number;
  readonly railVoltage: number;
  readonly hasInspectedResetHistory?: boolean;
  readonly isParseError?: boolean;
  readonly watchdogCount?: number | string;
  readonly softwarePanicCount?: number | string;
  readonly brownoutCount?: number | string;
}

export const ObservingScene: React.FC<ObservingSceneProps> = ({
  railVoltage,
  hasInspectedResetHistory = false,
  isParseError = false,
  watchdogCount,
  softwarePanicCount,
  brownoutCount,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isVoltageMeasured = railVoltage > 0;

  const displayBrownout =
    brownoutCount !== undefined
      ? brownoutCount
      : "—";

  const displayWatchdog =
    watchdogCount !== undefined
      ? watchdogCount
      : "—";

  const displaySoftware =
    softwarePanicCount !== undefined
      ? softwarePanicCount
      : "—";

  const hasBrownout =
    hasInspectedResetHistory &&
    !isParseError &&
    displayBrownout !== "—" &&
    Number(displayBrownout) > 0;

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

      // 2.80 V threshold line
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
      data-scene="observing"
      data-testid="observing-scene"
      initial={{ opacity: 1 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
      style={{
        flexDirection: "column",
        gap: "1.75rem",
        height: "100%",
        color: "var(--ohmni-lab-text)",
      }}
    >
      {/* Scene Header */}
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "var(--brand, #2B57FF)", fontSize: "12px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
          <Activity size={14} />
          <span>HARDWARE REGISTERS · read_reset_history</span>
        </div>
        <h2 style={{ fontSize: "26px", fontWeight: 750, color: "var(--ink, #111318)", margin: "4px 0 0", letterSpacing: "-0.02em" }}>
          {hasInspectedResetHistory ? "Reset history" : "Microcontroller reset history"}
        </h2>
        <p style={{ margin: "4px 0 0", fontSize: "14px", color: "var(--ink-secondary, #5C6470)" }}>
          {isParseError
            ? "Unable to interpret reset-history response."
            : hasInspectedResetHistory
            ? "Diagnostic registers read via read_reset_history."
            : "Reset history not inspected yet."}
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
            border: hasBrownout
              ? "1px solid rgba(220, 38, 38, 0.25)"
              : "1px solid var(--ohmni-lab-border)",
            borderRadius: "var(--radius-lg)",
            padding: "1.5rem",
            boxShadow: hasBrownout ? "var(--shadow-card)" : "var(--shadow-sm)",
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span className="font-mono" style={{ fontSize: "12px", fontWeight: 700, color: hasBrownout ? "var(--ohmni-lab-fault)" : "var(--ohmni-lab-muted)" }}>
              Brownout reset
            </span>
            <RotateCcw size={16} color={hasBrownout ? "var(--ohmni-lab-fault)" : "var(--ohmni-lab-muted)"} />
          </div>

          <div className="font-mono" style={{ fontSize: "42px", fontWeight: 800, color: hasBrownout ? "var(--ohmni-lab-fault)" : "var(--ohmni-lab-muted)", margin: "0.75rem 0 0.25rem", letterSpacing: "-0.03em" }}>
            {displayBrownout}
          </div>

          <div style={{ fontSize: "12.5px", color: "var(--ohmni-lab-muted)" }}>
            {isParseError
              ? "Unable to interpret reset-history response."
              : hasInspectedResetHistory && displayBrownout !== "—"
              ? (Number(displayBrownout) > 0 ? "Supply fell below 2.80 V threshold" : "No brownout events recorded")
              : "Waiting for agent measurement…"}
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
            <span className="font-mono" style={{ fontSize: "12px", fontWeight: 700, color: "var(--ink-secondary, #5C6470)" }}>
              Watchdog resets
            </span>
            <Clock size={16} color="var(--ink-tertiary, #8A92A0)" />
          </div>

          <div className="font-mono" style={{ fontSize: "42px", fontWeight: 800, color: "var(--ohmni-lab-text)", margin: "0.75rem 0 0.25rem", letterSpacing: "-0.03em" }}>
            {displayWatchdog}
          </div>

          <div style={{ fontSize: "12.5px", color: "var(--ohmni-lab-muted)" }}>
            {isParseError
              ? "Unable to interpret reset-history response."
              : hasInspectedResetHistory && displayWatchdog !== "—"
              ? "No execution timeouts recorded"
              : "Waiting for agent measurement…"}
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
            <span className="font-mono" style={{ fontSize: "12px", fontWeight: 700, color: "var(--ink-secondary, #5C6470)" }}>
              Software crashes
            </span>
            <ShieldCheck size={16} color={hasInspectedResetHistory ? "var(--verified, #16A34A)" : "var(--ink-tertiary, #8A92A0)"} />
          </div>

          <div className="font-mono" style={{ fontSize: "42px", fontWeight: 800, color: "var(--ohmni-lab-text)", margin: "0.75rem 0 0.25rem", letterSpacing: "-0.03em" }}>
            {displaySoftware}
          </div>

          <div style={{ fontSize: "12.5px", color: "var(--ohmni-lab-muted)" }}>
            {isParseError
              ? "Unable to interpret reset-history response."
              : hasInspectedResetHistory && displaySoftware !== "—"
              ? "No firmware crash assertions"
              : "Waiting for agent measurement…"}
          </div>
        </div>
      </div>

      {/* What this tells us statement */}
      {/* Plain-English Interpretation */}
      {hasInspectedResetHistory && hasBrownout && (
        <div
          style={{
            background: "rgba(220, 38, 38, 0.05)",
            border: "1px solid rgba(220, 38, 38, 0.18)",
            borderRadius: "var(--radius-md, 10px)",
            padding: "1rem 1.25rem",
            display: "flex",
            flexDirection: "column",
            gap: "4px",
          }}
        >
          <div style={{ fontSize: "11px", fontWeight: 750, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--fault, #DC2626)" }}>
            Observed diagnostic finding
          </div>
          <div style={{ fontSize: "14.5px", fontWeight: 600, color: "var(--ink, #111318)", lineHeight: 1.45 }}>
            "Recent resets were caused by the power rail falling below the MCU's operating threshold."
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
            LIVE SCOPE BASELINE • {isVoltageMeasured ? `${railVoltage.toFixed(2)} V` : "— V (Unmeasured)"}
          </span>
          <span className="font-mono" style={{ fontSize: "11px", color: "var(--ohmni-lab-action)" }}>
            2.80 V reset threshold armed
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
