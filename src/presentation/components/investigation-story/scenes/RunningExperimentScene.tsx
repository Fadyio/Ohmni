/**
 * Scene 3 — Running Experiment (60fps Oscilloscope & Hardware Actuation).
 * Embedded dark instrument surface:
 * - 60fps Canvas Oscilloscope trace
 * - 2.80 V Safe Brownout Threshold line
 * - Live voltage drop to 2.72 V (deterministic ground truth)
 * - Minimum capture callout (MIN 2.72 V • BROWNOUT DETECTED)
 * - Relay actuation animation and spinning fan load
 */

import React, { useRef, useEffect, useState, useCallback } from "react";
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
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const width = rect.width;
      const height = rect.height;

      if (canvas.width !== Math.floor(width * dpr) || canvas.height !== Math.floor(height * dpr)) {
        canvas.width = Math.floor(width * dpr);
        canvas.height = Math.floor(height * dpr);
      }

      ctx.save();
      ctx.scale(dpr, dpr);

      // Dark Inset Instrument Background
      ctx.fillStyle = "#0C1017";
      ctx.fillRect(0, 0, width, height);

      const padLeft = 48;
      const padRight = 75;
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
          ctx.strokeStyle = "rgba(229, 154, 37, 0.85)";
          ctx.lineWidth = 1.5;
          ctx.moveTo(padLeft, y);
          ctx.lineTo(padLeft + plotWidth, y);
          ctx.stroke();
          ctx.setLineDash([]);

          ctx.fillStyle = "#E59A25";
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
      const ringBuffer = ringBufferRef.current;
      const samples = ringBuffer ? ringBuffer.toArray() : [];

      if (samples.length > 0) {
        const latest = samples[samples.length - 1];
        const firstTMs = samples[0].tMs;
        const lastTMs = latest.tMs;
        const tDuration = Math.max(10, lastTMs - firstTMs);

        const timeToX = (tMs: number) => {
          if (tDuration <= 0) return padLeft;
          const norm = (tMs - firstTMs) / tDuration;
          return padLeft + plotWidth * Math.min(1, Math.max(0, norm));
        };

        // Trace glow gradient
        const grad = ctx.createLinearGradient(0, padTop, 0, padTop + plotHeight);
        grad.addColorStop(0, "rgba(56, 189, 248, 0.18)");
        grad.addColorStop(0.7, "rgba(56, 189, 248, 0.03)");
        grad.addColorStop(1, "rgba(56, 189, 248, 0)");

        ctx.beginPath();
        ctx.moveTo(timeToX(samples[0].tMs), voltToY(samples[0].value));
        for (let i = 1; i < samples.length; i++) {
          ctx.lineTo(timeToX(samples[i].tMs), voltToY(samples[i].value));
        }
        ctx.lineTo(timeToX(samples[samples.length - 1].tMs), padTop + plotHeight);
        ctx.lineTo(timeToX(samples[0].tMs), padTop + plotHeight);
        ctx.closePath();
        ctx.fillStyle = grad;
        ctx.fill();

        // Segments with color shift below safe limit
        ctx.lineWidth = 2.6;
        ctx.lineJoin = "round";
        ctx.lineCap = "round";

        let minSample = samples[0];

        for (let i = 0; i < samples.length - 1; i++) {
          const s1 = samples[i];
          const s2 = samples[i + 1];
          if (s1.value < minSample.value) minSample = s1;
          if (s2.value < minSample.value) minSample = s2;

          const x1 = timeToX(s1.tMs);
          const y1 = voltToY(s1.value);
          const x2 = timeToX(s2.tMs);
          const y2 = voltToY(s2.value);

          const isSag = s1.value < safeThresholdVoltage || s2.value < safeThresholdVoltage;

          ctx.beginPath();
          ctx.strokeStyle = isSag ? "#F43F5E" : "#38BDF8";
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.stroke();
        }

        // Exact Minimum Marker Callout (2.72 V ground truth)
        if (minSample.value < 3.20) {
          const minX = timeToX(minSample.tMs);
          const minY = voltToY(minSample.value);
          const isFault = minSample.value < safeThresholdVoltage;

          ctx.beginPath();
          ctx.arc(minX, minY, 4, 0, Math.PI * 2);
          ctx.fillStyle = isFault ? "#F43F5E" : "#38BDF8";
          ctx.fill();
          ctx.strokeStyle = "#FFFFFF";
          ctx.lineWidth = 1.5;
          ctx.stroke();

          ctx.fillStyle = isFault ? "#F43F5E" : "#38BDF8";
          ctx.font = 'bold 10px "JetBrains Mono", monospace';
          ctx.textAlign = "center";
          ctx.fillText(`MIN ${minSample.value.toFixed(2)} V ↓`, minX, minY + 16);
        }
      } else {
        const baselineY = voltToY(3.31);
        ctx.beginPath();
        ctx.strokeStyle = "rgba(56, 189, 248, 0.4)";
        ctx.lineWidth = 2;
        ctx.moveTo(padLeft, baselineY);
        ctx.lineTo(padLeft + plotWidth, baselineY);
        ctx.stroke();
      }

      // Sweep Cursor
      if (isRunning) {
        sweepProgress = (sweepProgress + 0.02) % 1;
        const sweepX = padLeft + plotWidth * sweepProgress;
        ctx.beginPath();
        ctx.strokeStyle = "rgba(56, 189, 248, 0.35)";
        ctx.lineWidth = 1.5;
        ctx.moveTo(sweepX, padTop);
        ctx.lineTo(sweepX, padTop + plotHeight);
        ctx.stroke();
      }

      ctx.restore();
      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animationFrameId);
  }, [ringBufferRef, markersRef, isRunning]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "1.25rem",
        height: "100%",
      }}
    >
      {/* Header Bar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "var(--ohmni-signal)", fontSize: "13px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em" }}>
            <Activity size={15} />
            Live Experiment • Real-Time Scope
          </div>
          <h2 className="scene-heading" style={{ margin: "4px 0 0" }}>
            Relay Actuation & Supply Telemetry
          </h2>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span
            className="font-mono"
            style={{
              fontSize: "18px",
              fontWeight: 800,
              color: railVoltage < safeThresholdVoltage ? "var(--ohmni-fault)" : "var(--ohmni-signal)",
            }}
          >
            {railVoltage.toFixed(2)} V
          </span>

          <span
            style={{
              fontSize: "12px",
              fontWeight: 700,
              padding: "4px 10px",
              borderRadius: "var(--radius-full)",
              background: isRunning ? "var(--ohmni-warning-subtle)" : "var(--ohmni-surface-raised)",
              color: isRunning ? "var(--ohmni-warning)" : "var(--ohmni-secondary)",
              border: "1px solid var(--ohmni-border)",
            }}
          >
            {isRunning ? "ACQUIRING (500ms)" : "EXPERIMENT COMPLETE"}
          </span>
        </div>
      </div>

      {/* Main Canvas Scope Surface */}
      <div
        style={{
          background: "var(--ohmni-surface-dark)",
          borderRadius: "var(--radius-xl)",
          padding: "1rem",
          boxShadow: "inset 0 1px 3px rgba(0,0,0,0.4), var(--shadow-md)",
          position: "relative",
          flex: 1,
          minHeight: "260px",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <canvas
          ref={canvasRef}
          style={{
            width: "100%",
            height: "100%",
            minHeight: "240px",
            display: "block",
          }}
        />
      </div>

      {/* Hardware Actuation Embedded Strip */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.2fr 1fr",
          gap: "12px",
        }}
      >
        <div
          style={{
            background: "var(--ohmni-surface)",
            border: "1px solid var(--ohmni-border)",
            borderRadius: "var(--radius-md)",
            padding: "12px 16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div>
            <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--ohmni-secondary)", textTransform: "uppercase" }}>
              Relay K1 Armature Contact
            </div>
            <div style={{ fontSize: "14px", fontWeight: 800, color: isClosed ? "var(--ohmni-warning)" : "var(--ohmni-ink)", marginTop: "2px" }}>
              {isClosed ? "⚡ CLOSED (12V Fan Energized)" : "OPEN (Idle)"}
            </div>
          </div>
          <Zap size={20} color={isClosed ? "var(--ohmni-warning)" : "var(--ohmni-text-muted)"} />
        </div>

        <div
          style={{
            background: "var(--ohmni-surface)",
            border: "1px solid var(--ohmni-border)",
            borderRadius: "var(--radius-md)",
            padding: "12px 16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div>
            <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--ohmni-secondary)", textTransform: "uppercase" }}>
              Safe Supply Limit
            </div>
            <div style={{ fontSize: "14px", fontWeight: 800, color: "var(--ohmni-ink)", marginTop: "2px" }}>
              2.80 V Threshold
            </div>
          </div>
          <AlertTriangle size={18} color="var(--ohmni-warning)" />
        </div>
      </div>
    </motion.div>
  );
};
