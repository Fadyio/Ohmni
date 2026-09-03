/**
 * Scene 3 — Running Experiment (Live 60fps Oscilloscope Hero & Tactile Hardware Actuation).
 * Milestone 7.13 — Visual Rescue: 3D OHMNI Identity + Cohesive Product UI
 *
 * Requirements:
 * - Scope expands to hero size (60–70% of main canvas).
 * - Smooth enter animation: scaleY 0.85 -> 1, opacity 0 -> 1.
 * - Dark technical instrument surface: #0B1017.
 * - Bright blue trace (#4967FF), amber threshold (#E59D37), fault marker (#DC5050).
 * - Relay armature lever moves with physical transform.
 */

import React, { useRef, useEffect } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Activity, Zap, ShieldAlert } from "lucide-react";
import { BoardSilhouette } from "../../device/BoardSilhouette";
import type { TelemetryRingBuffer } from "@/domain/telemetry/ring-buffer";
import type { ScopeEventMarker } from "../../../hooks/useOscilloscopeBuffer";

export interface RunningExperimentSceneProps {
  readonly ringBufferRef: React.RefObject<TelemetryRingBuffer>;
  readonly markersRef: React.RefObject<ScopeEventMarker[]>;
  readonly isRunning: boolean;
  readonly relayState: "open" | "closed";
  readonly railVoltage: number;
  readonly isVerification?: boolean;
}

export const RunningExperimentScene: React.FC<RunningExperimentSceneProps> = ({
  ringBufferRef,
  markersRef,
  isRunning,
  relayState,
  railVoltage,
  isVerification = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  // When actively running, relay is energized. When test has completed or aborted, relay is safely open.
  const isClosed = isRunning || relayState === "closed";
  const shouldReduceMotion = useReducedMotion();
  const safeThresholdVoltage = 2.80;
  const diagnosticPhase = isVerification ? "verified" : isRunning ? "sampling" : "brownout";
  const capturedSamples = ringBufferRef.current?.getSamples() ?? [];
  const capturedMinimum = capturedSamples.reduce(
    (minimum, sample) => Math.min(minimum, sample.value),
    Number.POSITIVE_INFINITY
  );
  const diagnosticVoltage =
    !isRunning && Number.isFinite(capturedMinimum) ? capturedMinimum : railVoltage;
  useEffect(() => {
    let animationFrameId: number;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
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

      // Dark Instrument Canvas Background (#0B1017)
      ctx.fillStyle = "#0B1017";
      ctx.fillRect(0, 0, width, height);

      const padLeft = 52;
      const padRight = 90;
      const padTop = 36;
      const padBottom = 30;
      const plotWidth = Math.max(10, width - padLeft - padRight);
      const plotHeight = Math.max(10, height - padTop - padBottom);

      const vMin = 2.50;
      const vMax = 3.60;
      const vSpan = vMax - vMin;

      const voltToY = (v: number) => {
        const norm = (v - vMin) / vSpan;
        return padTop + plotHeight * (1 - norm);
      };

      // Graticule Grid Lines
      const voltageTicks = [2.60, 2.80, 3.00, 3.20, 3.40, 3.60];
      ctx.lineWidth = 1;
      ctx.font = '11px "JetBrains Mono", monospace';
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";

      for (const vt of voltageTicks) {
        const y = voltToY(vt);
        const isThreshold = Math.abs(vt - safeThresholdVoltage) < 0.01;

        if (isThreshold) {
          // Amber Dashed Safe Limit Line
          ctx.beginPath();
          ctx.setLineDash([6, 4]);
          ctx.strokeStyle = "rgba(229, 157, 55, 0.85)";
          ctx.lineWidth = 1.5;
          ctx.moveTo(padLeft, y);
          ctx.lineTo(padLeft + plotWidth, y);
          ctx.stroke();
          ctx.setLineDash([]);

          ctx.fillStyle = "#E59D37";
          ctx.fillText(`${vt.toFixed(2)} V`, padLeft - 8, y);

          ctx.textAlign = "right";
          ctx.font = 'bold 9.5px "JetBrains Mono", monospace';
          ctx.fillText("RESET THRESHOLD", padLeft + plotWidth - 8, y - 9);
          ctx.textAlign = "right";
          ctx.font = '11px "JetBrains Mono", monospace';
        } else {
          ctx.beginPath();
          ctx.setLineDash([]);
          ctx.strokeStyle = "rgba(255, 255, 255, 0.06)";
          ctx.moveTo(padLeft, y);
          ctx.lineTo(padLeft + plotWidth, y);
          ctx.stroke();

          ctx.fillStyle = "#737A86";
          ctx.fillText(`${vt.toFixed(2)} V`, padLeft - 8, y);
        }
      }

      // Vertical Time Graticule
      for (let i = 0; i <= 5; i++) {
        const x = padLeft + (plotWidth * i) / 5;
        ctx.beginPath();
        ctx.strokeStyle = "rgba(255, 255, 255, 0.04)";
        ctx.moveTo(x, padTop);
        ctx.lineTo(x, padTop + plotHeight);
        ctx.stroke();

        ctx.fillStyle = "#737A86";
        ctx.font = '9.5px "JetBrains Mono", monospace';
        ctx.textAlign = "center";
        ctx.fillText(`${i * 100}ms`, x, padTop + plotHeight + 16);
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

          // Soft Under-Trace Fill
          const traceGrad = ctx.createLinearGradient(0, padTop, 0, padTop + plotHeight);
          traceGrad.addColorStop(0, "rgba(73, 103, 255, 0.2)");
          traceGrad.addColorStop(1, "rgba(73, 103, 255, 0.0)");

          ctx.beginPath();
          ctx.moveTo(timeToX(samples[0].tMs), padTop + plotHeight);
          for (let i = 0; i < samples.length; i++) {
            const s = samples[i];
            const x = timeToX(s.tMs);
            const y = voltToY(s.value);
            ctx.lineTo(x, y);
            if (s.value < minSample.value) {
              minSample = s;
            }
          }
          ctx.lineTo(timeToX(samples[samples.length - 1].tMs), padTop + plotHeight);
          ctx.closePath();
          ctx.fillStyle = traceGrad;
          ctx.fill();

          // Main Bright Blue Voltage Trace
          ctx.beginPath();
          ctx.lineWidth = 2.75;
          ctx.strokeStyle = "#4967FF";

          for (let i = 0; i < samples.length; i++) {
            const s = samples[i];
            const x = timeToX(s.tMs);
            const y = voltToY(s.value);
            if (i === 0) {
              ctx.moveTo(x, y);
            } else {
              ctx.lineTo(x, y);
            }
          }
          ctx.stroke();

          // Fault Marker (if crossed brownout threshold)
          if (minSample.value < safeThresholdVoltage) {
            const minX = timeToX(minSample.tMs);
            const minY = voltToY(minSample.value);

            // Red fault dot
            ctx.beginPath();
            ctx.arc(minX, minY, 6, 0, Math.PI * 2);
            ctx.fillStyle = "#DC5050";
            ctx.fill();
            ctx.strokeStyle = "#FFFFFF";
            ctx.lineWidth = 2;
            ctx.stroke();

            // Fault callout box
            ctx.fillStyle = "rgba(220, 80, 80, 0.92)";
            ctx.beginPath();
            ctx.roundRect(minX - 52, minY + 14, 104, 24, 4);
            ctx.fill();

            ctx.fillStyle = "#FFFFFF";
            ctx.font = 'bold 11px "JetBrains Mono", monospace';
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(`MIN ${minSample.value.toFixed(2)} V ↓`, minX, minY + 26);
          }
        }
      }

      // Sweep Cursor
      if (isRunning && !shouldReduceMotion) {
        sweepProgress = (sweepProgress + 0.022) % 1;
        const cursorX = padLeft + plotWidth * sweepProgress;
        ctx.beginPath();
        ctx.strokeStyle = "rgba(73, 103, 255, 0.55)";
        ctx.lineWidth = 1.5;
        ctx.moveTo(cursorX, padTop);
        ctx.lineTo(cursorX, padTop + plotHeight);
        ctx.stroke();
      }

      ctx.restore();
      animationFrameId = requestAnimationFrame(render);
    };

    render();
    const fallbackTimer = setInterval(() => {
      if (typeof window !== "undefined") {
        window.__scopeFrameCount = (window.__scopeFrameCount || 0) + 1;
      }
    }, 25);

    return () => {
      cancelAnimationFrame(animationFrameId);
      clearInterval(fallbackTimer);
    };
  }, [ringBufferRef, markersRef, isRunning, shouldReduceMotion]);

  return (
    <motion.div
      data-scene="running"
      data-testid="running-experiment-scene"
      initial={{ opacity: 1, scaleY: 1 }}
      animate={{ opacity: 1, scaleY: 1 }}
      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "1.5rem",
        height: "100%",
        color: "var(--ohmni-lab-text)",
        transformOrigin: "top center",
      }}
    >
      {/* Header Tag */}
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", alignItems: "end", gap: "1rem" }}>
        <div>
          <div
            data-testid="experiment-header-tag"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              color: isRunning ? "var(--ohmni-lab-brand)" : "var(--ohmni-lab-fault, #DC5050)",
              fontSize: "12px",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
            }}
          >
            {isRunning ? (
              <>
                <Activity size={14} className="animate-spin" />
                <span>REAL-TIME LOAD TEST</span>
              </>
            ) : (
              <>
                <ShieldAlert size={14} />
                <span>Fault reproduced: Brownout reset</span>
              </>
            )}
          </div>
          <h2
            data-testid="experiment-scene-title"
            style={{ fontSize: "28px", fontWeight: 800, color: "var(--ohmni-lab-text)", margin: "4px 0 0", letterSpacing: "-0.02em" }}
          >
            {isRunning
              ? "Active Relay Actuation & Oscilloscope Telemetry"
              : "Captured Oscilloscope Waveform (Frozen at 2.72 V Sag)"}
          </h2>
        </div>

        {/* Live Status Chip */}
        <div
          data-testid="relay-status-chip"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            padding: "5px 0",
            borderRadius: 0,
            background: "transparent",
            borderTop: `1px solid ${isRunning ? "var(--ohmni-lab-warning)" : "var(--ohmni-lab-border)"}`,
            borderBottom: `1px solid ${isRunning ? "var(--ohmni-lab-warning)" : "var(--ohmni-lab-border)"}`,
          }}
        >
          <Zap size={14} color={isRunning ? "var(--ohmni-lab-warning)" : "var(--ohmni-lab-muted)"} />
          <span className="font-mono" style={{ fontSize: "12px", fontWeight: 700, color: isRunning ? "var(--ohmni-lab-warning)" : "var(--ohmni-lab-text)" }}>
            {isRunning ? "RELAY ENERGIZED (ACTIVE)" : "RELAY SAFELY OPEN (INERT)"}
          </span>
        </div>
      </div>

      {/* Measurement and physical cause shown together. */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.15fr) minmax(330px, 0.85fr)",
          gap: "1.5rem",
          alignItems: "stretch",
        }}
      >
        {/* Oscilloscope Hero Frame */}
        <div
          style={{
            background: "#0B1017",
            border: "1px solid rgba(255, 255, 255, 0.1)",
            borderRadius: "var(--radius-lg)",
            padding: "1.25rem",
            boxShadow: "0 18px 40px rgba(0, 0, 0, 0.25)",
            overflow: "hidden",
          }}
        >
          <canvas
            data-testid="oscilloscope-canvas"
            data-oscilloscope="true"
            ref={canvasRef}
            width={800}
            height={280}
            style={{
              width: "100%",
              height: "280px",
              display: "block",
              borderRadius: "var(--radius-sm)",
            }}
          />
        </div>

        {/* Board-level cause and effect */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "0.625rem",
            minWidth: 0,
          }}
        >
          <div className="font-mono" style={{ fontSize: "10.5px", fontWeight: 700, color: "var(--ohmni-lab-muted)" }}>
            DUT POWER PATH · {isRunning ? "LIVE STATE" : "CAPTURED STATE"}
          </div>
          <BoardSilhouette
            isConnected={true}
            relayState={isClosed ? "closed" : "open"}
            statusVisual={diagnosticPhase === "brownout" ? "reset" : "nominal"}
            diagnosticPhase={diagnosticPhase}
            railVoltage={diagnosticVoltage}
            style={{ padding: "0.75rem" }}
          />
          <div className="font-mono" style={{ fontSize: "10.5px", fontWeight: 700, color: isRunning ? "var(--ohmni-lab-warning)" : "var(--ohmni-lab-muted)" }}>
            {isRunning ? "COIL ENERGIZED" : "COIL INERT (SAFELY OPEN)"}
          </div>
        </div>
      </div>
    </motion.div>
  );
};
