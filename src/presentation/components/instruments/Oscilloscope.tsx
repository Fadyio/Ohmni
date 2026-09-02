/**
 * Real-Time 60fps Canvas Oscilloscope.
 * Renders voltage telemetry trace, subtle graticule, 2.80V safe threshold,
 * fault segment coloring, and event markers directly from TelemetryRingBuffer.
 */

import React, { useRef, useEffect, useState } from "react";
import type { TelemetryRingBuffer } from "@/domain/telemetry/ring-buffer";
import type { ScopeEventMarker } from "../../hooks/useOscilloscopeBuffer";

interface OscilloscopeProps {
  readonly ringBufferRef: React.RefObject<TelemetryRingBuffer>;
  readonly markersRef: React.RefObject<ScopeEventMarker[]>;
  readonly isRunning: boolean;
  readonly nominalVoltage?: number;
  readonly safeThresholdVoltage?: number;
}

export const Oscilloscope: React.FC<OscilloscopeProps> = ({
  ringBufferRef,
  markersRef,
  isRunning,
  nominalVoltage = 3.31,
  safeThresholdVoltage = 2.80,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [liveVoltage, setLiveVoltage] = useState<number>(nominalVoltage);

  useEffect(() => {
    let animationFrameId: number;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

    let lastFpsUpdate = performance.now();

    const render = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const width = rect.width;
      const height = rect.height;

      // Ensure canvas backing store matches display size * DPR
      if (canvas.width !== Math.floor(width * dpr) || canvas.height !== Math.floor(height * dpr)) {
        canvas.width = Math.floor(width * dpr);
        canvas.height = Math.floor(height * dpr);
      }

      ctx.save();
      ctx.scale(dpr, dpr);

      // 1. Scope Background
      ctx.fillStyle = "#07090c";
      ctx.fillRect(0, 0, width, height);

      // Grid margins (generous top padding so markers don't clash with channel header)
      const padLeft = 48;
      const padRight = 70;
      const padTop = 44;
      const padBottom = 26;
      const plotWidth = Math.max(10, width - padLeft - padRight);
      const plotHeight = Math.max(10, height - padTop - padBottom);

      // Voltage Scale: 2.50V to 3.60V
      const vMin = 2.50;
      const vMax = 3.60;
      const vSpan = vMax - vMin;

      const voltToY = (v: number) => {
        const norm = (v - vMin) / vSpan;
        return padTop + plotHeight * (1 - norm);
      };

      // 2. Graticule / Subtle Voltage Grid Lines
      const voltageTicks = [2.60, 2.80, 3.00, 3.20, 3.40, 3.60];

      ctx.lineWidth = 1;
      ctx.font = '10px "JetBrains Mono", monospace';
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";

      for (const vt of voltageTicks) {
        const y = voltToY(vt);
        const isThreshold = Math.abs(vt - safeThresholdVoltage) < 0.01;

        if (isThreshold) {
          // Safe Limit Threshold Line (Amber Dashed)
          ctx.beginPath();
          ctx.setLineDash([4, 4]);
          ctx.strokeStyle = "rgba(245, 158, 11, 0.7)";
          ctx.moveTo(padLeft, y);
          ctx.lineTo(padLeft + plotWidth, y);
          ctx.stroke();
          ctx.setLineDash([]);

          // Threshold label
          ctx.fillStyle = "#f59e0b";
          ctx.fillText(`${vt.toFixed(2)}`, padLeft - 6, y);

          ctx.textAlign = "left";
          ctx.font = 'bold 8.5px "JetBrains Mono", monospace';
          ctx.fillText("SAFE LIMIT", padLeft + plotWidth + 6, y);
          ctx.textAlign = "right";
          ctx.font = '10px "JetBrains Mono", monospace';
        } else {
          // Normal Grid Line
          ctx.beginPath();
          ctx.setLineDash([]);
          ctx.strokeStyle = "rgba(148, 163, 184, 0.08)";
          ctx.moveTo(padLeft, y);
          ctx.lineTo(padLeft + plotWidth, y);
          ctx.stroke();

          ctx.fillStyle = "#64748b";
          ctx.fillText(`${vt.toFixed(2)}`, padLeft - 6, y);
        }
      }

      // Vertical Time Division Grid Lines
      const timeDivs = 8;
      ctx.strokeStyle = "rgba(148, 163, 184, 0.05)";
      for (let i = 0; i <= timeDivs; i++) {
        const x = padLeft + (plotWidth / timeDivs) * i;
        ctx.beginPath();
        ctx.moveTo(x, padTop);
        ctx.lineTo(x, padTop + plotHeight);
        ctx.stroke();
      }

      // 3. Telemetry Trace from Ring Buffer
      const ringBuffer = ringBufferRef.current;
      const samples = ringBuffer ? ringBuffer.toArray() : [];

      if (samples.length > 0) {
        const latest = samples[samples.length - 1];
        const firstTMs = samples[0].tMs;
        const lastTMs = latest.tMs;
        const tDuration = Math.max(100, lastTMs - firstTMs);

        const timeToX = (tMs: number) => {
          if (tDuration <= 0) return padLeft;
          const norm = (tMs - firstTMs) / tDuration;
          return padLeft + plotWidth * Math.min(1, Math.max(0, norm));
        };

        // Draw segments with color transition when below safe limit (2.80V)
        ctx.lineWidth = 2.2;
        ctx.lineJoin = "round";
        ctx.lineCap = "round";

        for (let i = 0; i < samples.length - 1; i++) {
          const s1 = samples[i];
          const s2 = samples[i + 1];
          const x1 = timeToX(s1.tMs);
          const y1 = voltToY(s1.value);
          const x2 = timeToX(s2.tMs);
          const y2 = voltToY(s2.value);

          const isSag = s1.value < safeThresholdVoltage || s2.value < safeThresholdVoltage;

          ctx.beginPath();
          ctx.strokeStyle = isSag ? "#ef4444" : "#38bdf8";
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.stroke();
        }

        // Latest Voltage Indicator Dot
        const latestX = timeToX(latest.tMs);
        const latestY = voltToY(latest.value);
        const isFaultDot = latest.value < safeThresholdVoltage;

        ctx.beginPath();
        ctx.arc(latestX, latestY, 4, 0, Math.PI * 2);
        ctx.fillStyle = isFaultDot ? "#ef4444" : "#38bdf8";
        ctx.fill();
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 1.2;
        ctx.stroke();

        // Latest voltage text callout
        ctx.textAlign = "left";
        ctx.font = 'bold 10px "JetBrains Mono", monospace';
        ctx.fillStyle = isFaultDot ? "#ef4444" : "#38bdf8";
        ctx.fillText(` ${latest.value.toFixed(2)} V`, latestX + 5, latestY - 4);

        if (performance.now() - lastFpsUpdate > 100) {
          lastFpsUpdate = performance.now();
          setLiveVoltage(latest.value);
        }
      } else {
        // Idle baseline flat line
        const baselineY = voltToY(nominalVoltage);
        ctx.beginPath();
        ctx.strokeStyle = "rgba(56, 189, 248, 0.4)";
        ctx.lineWidth = 1.5;
        ctx.moveTo(padLeft, baselineY);
        ctx.lineTo(padLeft + plotWidth, baselineY);
        ctx.stroke();
      }

      // 4. Scope Event Markers (RELAY ON, BROWNOUT, RESET)
      const markers = markersRef.current || [];
      if (samples.length > 0 && markers.length > 0) {
        const firstTMs = samples[0].tMs;
        const lastTMs = samples[samples.length - 1].tMs;
        const tDuration = Math.max(100, lastTMs - firstTMs);

        const timeToX = (tMs: number) => {
          if (tDuration <= 0) return padLeft;
          const norm = (tMs - firstTMs) / tDuration;
          return padLeft + plotWidth * Math.min(1, Math.max(0, norm));
        };

        // Render markers with subtle offset to avoid overlap
        markers.forEach((marker, idx) => {
          const mx = timeToX(marker.tMs);
          const isBrownout = marker.type === "brownout";
          const isReset = marker.type === "reset";
          const isRelay = marker.type === "relay_on" || marker.type === "relay_off";

          const markerColor = isBrownout || isReset ? "#ef4444" : isRelay ? "#f59e0b" : "#38bdf8";

          // Vertical Marker Line
          ctx.beginPath();
          ctx.setLineDash([3, 3]);
          ctx.strokeStyle = markerColor;
          ctx.lineWidth = 1;
          ctx.moveTo(mx, padTop);
          ctx.lineTo(mx, padTop + plotHeight);
          ctx.stroke();
          ctx.setLineDash([]);

          // Marker Label Tag positioned above plot area
          const tagY = padTop - 6 - (idx % 2 === 1 ? 12 : 0);
          ctx.fillStyle = markerColor;
          ctx.font = 'bold 8.5px "JetBrains Mono", monospace';
          ctx.textAlign = "center";
          ctx.fillText(marker.label, mx, tagY);
        });
      }

      // 5. Time Axis Bottom Labels
      ctx.fillStyle = "#64748b";
      ctx.font = '9px "JetBrains Mono", monospace';
      ctx.textAlign = "left";
      ctx.fillText("0 ms (Trigger)", padLeft, height - 8);
      ctx.textAlign = "right";
      const totalElapsed = samples.length > 1 ? `${(samples[samples.length - 1].tMs - samples[0].tMs).toFixed(0)} ms` : "Window";
      ctx.fillText(`+${totalElapsed}`, padLeft + plotWidth, height - 8);

      ctx.restore();
      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [ringBufferRef, markersRef, nominalVoltage, safeThresholdVoltage]);

  return (
    <div
      ref={containerRef}
      style={{
        width: "100%",
        height: "100%",
        minHeight: "280px",
        background: "var(--ohmni-scope-bg)",
        border: "1px solid var(--ohmni-border)",
        borderRadius: "var(--radius-md)",
        position: "relative",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* Top Scope Channel Header */}
      <div
        style={{
          position: "absolute",
          top: "8px",
          left: "14px",
          right: "14px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          zIndex: 10,
          pointerEvents: "none",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span
            className="font-mono"
            style={{
              fontSize: "0.6875rem",
              fontWeight: 700,
              letterSpacing: "0.06em",
              color: "var(--ohmni-accent)",
              background: "rgba(56, 189, 248, 0.12)",
              padding: "2px 8px",
              borderRadius: "var(--radius-sm)",
              border: "1px solid rgba(56, 189, 248, 0.3)",
            }}
          >
            CH1: SUPPLY — 3V3 RAIL
          </span>
          <span
            className="font-mono"
            style={{
              fontSize: "0.625rem",
              color: "var(--ohmni-text-muted)",
            }}
          >
            200 mV / DIV • 50 MS / DIV
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span
            className="font-mono"
            style={{
              fontSize: "0.75rem",
              fontWeight: 700,
              color: liveVoltage < safeThresholdVoltage ? "var(--ohmni-fault)" : "var(--ohmni-accent)",
              background: liveVoltage < safeThresholdVoltage ? "rgba(239, 68, 68, 0.12)" : "rgba(56, 189, 248, 0.08)",
              padding: "2px 8px",
              borderRadius: "var(--radius-sm)",
              border: `1px solid ${liveVoltage < safeThresholdVoltage ? "rgba(239, 68, 68, 0.3)" : "rgba(56, 189, 248, 0.2)"}`,
            }}
          >
            V_LIVE: {liveVoltage.toFixed(2)} V
          </span>
        </div>
      </div>

      {/* Main High-Performance Canvas */}
      <canvas
        ref={canvasRef}
        style={{
          width: "100%",
          height: "100%",
          display: "block",
        }}
      />
    </div>
  );
};
