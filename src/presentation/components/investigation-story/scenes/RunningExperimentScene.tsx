/**
 * Scene 3 — Running Experiment (Live 60fps Oscilloscope & Hardware Physical State).
 *
 * Requirements:
 * - Hardware + Scope together.
 * - Real telemetry trace with sweep cursor.
 * - 2.80V threshold changes state on crossing.
 * - At real minimum: freeze marker.
 * - Physical relay & fan driven by real relayState.
 */

import React, { useRef, useEffect, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Activity, Zap, RotateCcw, AlertTriangle, ShieldCheck } from "lucide-react";
import type { TelemetryRingBuffer } from "@/domain/telemetry/ring-buffer";
import type { ScopeEventMarker } from "../../../hooks/useOscilloscopeBuffer";

export interface RunningExperimentSceneProps {
  readonly ringBufferRef: React.RefObject<TelemetryRingBuffer>;
  readonly markersRef: React.RefObject<ScopeEventMarker[]>;
  readonly isRunning: boolean;
  readonly relayState: "open" | "closed";
  readonly railVoltage: number;
}

export const RunningExperimentScene: React.FC<RunningExperimentSceneProps> = ({
  ringBufferRef,
  markersRef,
  isRunning,
  relayState,
  railVoltage,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isClosed = relayState === "closed";
  const shouldReduceMotion = useReducedMotion();
  const safeThresholdVoltage = 2.80;

  useEffect(() => {
    let animationFrameId: number;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

    let sweepProgress = 0;

    const render = () => {
      if (typeof window !== "undefined") {
        window.__scopeFrameCount = (window.__scopeFrameCount || 0) + 1;
      }
      const rect = canvas.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;
      const dpr = window.devicePixelRatio || 1;
      if (canvas.width !== Math.floor(width * dpr) || canvas.height !== Math.floor(height * dpr)) {
        canvas.width = Math.floor(width * dpr);
        canvas.height = Math.floor(height * dpr);
      }

      ctx.save();
      ctx.scale(dpr, dpr);

      // Dark Instrument Canvas Background
      ctx.fillStyle = "#0C1017";
      ctx.fillRect(0, 0, width, height);

      const padLeft = 48;
      const padRight = 80;
      const padTop = 32;
      const padBottom = 26;
      const plotWidth = Math.max(10, width - padLeft - padRight);
      const plotHeight = Math.max(10, height - padTop - padBottom);

      const vMin = 2.50;
      const vMax = 3.60;
      const vSpan = vMax - vMin;

      const voltToY = (v: number) => {
        const norm = (v - vMin) / vSpan;
        return padTop + plotHeight * (1 - norm);
      };

      // Graticule Voltage Grid Lines
      const voltageTicks = [2.60, 2.80, 3.00, 3.20, 3.40, 3.60];
      ctx.lineWidth = 1;
      ctx.font = '10px "JetBrains Mono", monospace';
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";

      for (const vt of voltageTicks) {
        const y = voltToY(vt);
        const isThreshold = Math.abs(vt - safeThresholdVoltage) < 0.01;

        if (isThreshold) {
          // Amber Dashed Safe Limit Threshold Line
          ctx.beginPath();
          ctx.setLineDash([5, 4]);
          ctx.strokeStyle = "rgba(255, 181, 74, 0.85)";
          ctx.lineWidth = 1.5;
          ctx.moveTo(padLeft, y);
          ctx.lineTo(padLeft + plotWidth, y);
          ctx.stroke();
          ctx.setLineDash([]);

          ctx.fillStyle = "#FFB54A";
          ctx.fillText(`${vt.toFixed(2)}`, padLeft - 6, y);

          ctx.textAlign = "left";
          ctx.font = 'bold 9px "JetBrains Mono", monospace';
          ctx.fillText("SAFE LIMIT (2.80V)", padLeft + plotWidth + 6, y);
          ctx.textAlign = "right";
          ctx.font = '10px "JetBrains Mono", monospace';
        } else {
          ctx.beginPath();
          ctx.setLineDash([]);
          ctx.strokeStyle = "rgba(255, 255, 255, 0.06)";
          ctx.moveTo(padLeft, y);
          ctx.lineTo(padLeft + plotWidth, y);
          ctx.stroke();

          ctx.fillStyle = "#64748B";
          ctx.fillText(`${vt.toFixed(2)}`, padLeft - 6, y);
        }
      }

      // Telemetry Trace from Ring Buffer
      if (ringBufferRef.current) {
        const samples = ringBufferRef.current.getSamples();
        const durationMs = 500;

        const timeToX = (tMs: number) => {
          const norm = Math.max(0, Math.min(1, tMs / durationMs));
          return padLeft + plotWidth * norm;
        };

        if (samples.length > 1) {
          let minSample = samples[0];

          ctx.beginPath();
          ctx.lineWidth = 2.5;
          ctx.strokeStyle = "#45B8FF";

          for (let i = 0; i < samples.length; i++) {
            const s = samples[i];
            const x = timeToX(s.tMs);
            const y = voltToY(s.value);

            if (s.value < minSample.value) {
              minSample = s;
            }

            if (i === 0) {
              ctx.moveTo(x, y);
            } else {
              ctx.lineTo(x, y);
            }
          }
          ctx.stroke();

          // If minSample crossed brownout threshold
          if (minSample.value < safeThresholdVoltage) {
            const minX = timeToX(minSample.tMs);
            const minY = voltToY(minSample.value);

            // Red fault dot
            ctx.beginPath();
            ctx.arc(minX, minY, 5, 0, Math.PI * 2);
            ctx.fillStyle = "#FF595F";
            ctx.fill();

            // Fault callout text
            ctx.fillStyle = "#FF595F";
            ctx.font = 'bold 11px "JetBrains Mono", monospace';
            ctx.textAlign = "center";
            ctx.fillText(`MIN ${minSample.value.toFixed(2)} V ↓`, minX, minY + 16);
          }
        }
      }

      // Sweep Cursor
      if (isRunning && !shouldReduceMotion) {
        sweepProgress = (sweepProgress + 0.02) % 1;
        const cursorX = padLeft + plotWidth * sweepProgress;
        ctx.beginPath();
        ctx.strokeStyle = "rgba(69, 184, 255, 0.4)";
        ctx.lineWidth = 1.5;
        ctx.moveTo(cursorX, padTop);
        ctx.lineTo(cursorX, padTop + plotHeight);
        ctx.stroke();
      }

      ctx.restore();
      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [ringBufferRef, markersRef, isRunning, shouldReduceMotion]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "1.5rem",
        height: "100%",
        color: "var(--ohmni-lab-text)",
      }}
    >
      {/* Header Tag */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "var(--ohmni-lab-signal)", fontSize: "12.5px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            <Activity size={14} className={isRunning ? "animate-spin" : ""} />
            REAL-TIME PHYSICAL EXPERIMENT
          </div>
          <h2 style={{ fontSize: "28px", fontWeight: 800, color: "var(--ohmni-lab-text)", margin: "4px 0 0", letterSpacing: "-0.02em" }}>
            Relay Actuation & Oscilloscope Telemetry
          </h2>
        </div>

        {/* Live Status Chip */}
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            padding: "6px 14px",
            borderRadius: "var(--radius-full)",
            background: isClosed ? "rgba(255, 181, 74, 0.15)" : "var(--ohmni-lab-raised)",
            border: `1px solid ${isClosed ? "var(--ohmni-lab-action)" : "var(--ohmni-lab-border)"}`,
          }}
        >
          <Zap size={14} color={isClosed ? "var(--ohmni-lab-action)" : "var(--ohmni-lab-muted)"} />
          <span className="font-mono" style={{ fontSize: "12px", fontWeight: 700, color: isClosed ? "var(--ohmni-lab-action)" : "var(--ohmni-lab-text)" }}>
            RELAY {isClosed ? "CLOSED (ENERGIZED)" : "OPEN (INERT)"}
          </span>
        </div>
      </div>

      {/* Scope Instrument Canvas */}
      <div
        style={{
          background: "var(--ohmni-lab-raised)",
          border: "1px solid var(--ohmni-lab-border)",
          borderRadius: "var(--radius-xl)",
          padding: "1.25rem",
          boxShadow: "0 0 32px rgba(0, 0, 0, 0.4)",
        }}
      >
        <canvas
          data-testid="oscilloscope-canvas"
          ref={canvasRef}
          width={800}
          height={260}
          style={{
            width: "100%",
            height: "260px",
            display: "block",
            borderRadius: "var(--radius-md)",
          }}
        />
      </div>
    </motion.div>
  );
};
