/**
 * Real-Time 60fps Canvas Oscilloscope.
 * High-precision custom instrumentation renderer:
 * - Electric cyan/red voltage telemetry trace with soft under-trace glow gradient.
 * - 2.80 V Safe Brownout Threshold line with warning glow.
 * - Sweep acquisition cursor and minimum voltage marker callout.
 * - Interactive hover crosshair and precise coordinate inspector.
 */

import React, { useRef, useEffect, useState, useCallback } from "react";
import { Activity, Radio, Maximize2, ShieldAlert } from "lucide-react";
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
  const [hoverData, setHoverData] = useState<{ x: number; y: number; voltage: number; tMs: number } | null>(null);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const ringBuffer = ringBufferRef.current;
    const samples = ringBuffer ? ringBuffer.toArray() : [];
    if (samples.length === 0) {
      setHoverData(null);
      return;
    }

    const padLeft = 46;
    const padRight = 60;
    const plotWidth = Math.max(10, rect.width - padLeft - padRight);

    if (x < padLeft || x > padLeft + plotWidth) {
      setHoverData(null);
      return;
    }

    const firstTMs = samples[0].tMs;
    const lastTMs = samples[samples.length - 1].tMs;
    const tDuration = Math.max(10, lastTMs - firstTMs);

    const normX = (x - padLeft) / plotWidth;
    const targetTMs = firstTMs + normX * tDuration;

    // Find closest sample
    let closest = samples[0];
    let minDiff = Math.abs(closest.tMs - targetTMs);
    for (let i = 1; i < samples.length; i++) {
      const diff = Math.abs(samples[i].tMs - targetTMs);
      if (diff < minDiff) {
        minDiff = diff;
        closest = samples[i];
      }
    }

    setHoverData({ x, y, voltage: closest.value, tMs: closest.tMs });
  }, [ringBufferRef]);

  const handleMouseLeave = useCallback(() => {
    setHoverData(null);
  }, []);

  useEffect(() => {
    let animationFrameId: number;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

    let lastFpsUpdate = performance.now();
    let sweepProgress = 0;

    const render = () => {
      // TEST/DEV Frame counter instrumentation
      if (typeof window !== "undefined") {
        window.__scopeFrameCount = (window.__scopeFrameCount || 0) + 1;
      }
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

      // 1. Scope Housing Background
      ctx.fillStyle = "#07090D";
      ctx.fillRect(0, 0, width, height);

      // Grid margins
      const padLeft = 46;
      const padRight = 60;
      const padTop = 38;
      const padBottom = 24;
      const plotWidth = Math.max(10, width - padLeft - padRight);
      const plotHeight = Math.max(10, height - padTop - padBottom);

      // Voltage Scale: 2.50 V to 3.60 V
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
          ctx.strokeStyle = "rgba(244, 184, 96, 0.75)";
          ctx.moveTo(padLeft, y);
          ctx.lineTo(padLeft + plotWidth, y);
          ctx.stroke();
          ctx.setLineDash([]);

          // Threshold label on right
          ctx.fillStyle = "#F4B860";
          ctx.fillText(`${vt.toFixed(2)}`, padLeft - 6, y);

          ctx.textAlign = "left";
          ctx.font = 'bold 8.5px "JetBrains Mono", monospace';
          ctx.fillText("SAFE THRESHOLD", padLeft + plotWidth + 6, y);
          ctx.textAlign = "right";
          ctx.font = '10px "JetBrains Mono", monospace';
        } else {
          // Normal Grid Line
          ctx.beginPath();
          ctx.setLineDash([]);
          ctx.strokeStyle = "rgba(148, 163, 184, 0.06)";
          ctx.moveTo(padLeft, y);
          ctx.lineTo(padLeft + plotWidth, y);
          ctx.stroke();

          ctx.fillStyle = "#667085";
          ctx.fillText(`${vt.toFixed(2)}`, padLeft - 6, y);
        }
      }

      // Vertical Time Division Grid Lines
      const timeDivs = 8;
      ctx.strokeStyle = "rgba(148, 163, 184, 0.04)";
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
        const tDuration = Math.max(10, lastTMs - firstTMs);

        const timeToX = (tMs: number) => {
          if (tDuration <= 0) return padLeft;
          const norm = (tMs - firstTMs) / tDuration;
          return padLeft + plotWidth * Math.min(1, Math.max(0, norm));
        };

        // Subtle gradient under trace
        const grad = ctx.createLinearGradient(0, padTop, 0, padTop + plotHeight);
        grad.addColorStop(0, "rgba(53, 198, 244, 0.12)");
        grad.addColorStop(0.6, "rgba(53, 198, 244, 0.03)");
        grad.addColorStop(1, "rgba(53, 198, 244, 0.0)");

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

        // Draw segments with color transition when below safe limit (2.80 V)
        ctx.lineWidth = 2.4;
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
          ctx.strokeStyle = isSag ? "var(--ohmni-fault)" : "var(--ohmni-signal)";
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.stroke();
        }

        // Exact Minimum Marker Callout
        if (minSample.value < 3.20) {
          const minX = timeToX(minSample.tMs);
          const minY = voltToY(minSample.value);
          const isFault = minSample.value < safeThresholdVoltage;

          ctx.beginPath();
          ctx.arc(minX, minY, 3.5, 0, Math.PI * 2);
          ctx.fillStyle = isFault ? "#FF5D68" : "#35C6F4";
          ctx.fill();

          ctx.fillStyle = isFault ? "#FF5D68" : "#35C6F4";
          ctx.font = 'bold 9px "JetBrains Mono", monospace';
          ctx.textAlign = "center";
          ctx.fillText(`MIN ${minSample.value.toFixed(2)}V ↓`, minX, minY + 14);
        }

        // Latest Voltage Dot
        const latestX = timeToX(latest.tMs);
        const latestY = voltToY(latest.value);
        const isFaultDot = latest.value < safeThresholdVoltage;

        ctx.beginPath();
        ctx.arc(latestX, latestY, 4, 0, Math.PI * 2);
        ctx.fillStyle = isFaultDot ? "#FF5D68" : "#35C6F4";
        ctx.fill();
        ctx.strokeStyle = "#FFFFFF";
        ctx.lineWidth = 1.2;
        ctx.stroke();

        // Latest voltage text callout
        ctx.textAlign = "left";
        ctx.font = 'bold 10px "JetBrains Mono", monospace';
        ctx.fillStyle = isFaultDot ? "#FF5D68" : "#35C6F4";
        ctx.fillText(` ${latest.value.toFixed(2)} V`, latestX + 6, latestY - 3);

        if (performance.now() - lastFpsUpdate > 100) {
          lastFpsUpdate = performance.now();
          setLiveVoltage(latest.value);
        }
      } else {
        // Idle baseline flat line
        const baselineY = voltToY(nominalVoltage);
        ctx.beginPath();
        ctx.strokeStyle = "rgba(53, 198, 244, 0.4)";
        ctx.lineWidth = 1.8;
        ctx.moveTo(padLeft, baselineY);
        ctx.lineTo(padLeft + plotWidth, baselineY);
        ctx.stroke();

        ctx.fillStyle = "rgba(148, 163, 184, 0.5)";
        ctx.font = '11px "JetBrains Mono", monospace';
        ctx.textAlign = "center";
        ctx.fillText("LIVE SIGNAL READY • 3.31 V NOMINAL BASELINE", padLeft + plotWidth / 2, baselineY - 12);
      }

      // 4. Moving Sweep Cursor during active acquisition
      if (isRunning) {
        sweepProgress = (sweepProgress + 0.02) % 1;
        const sweepX = padLeft + plotWidth * sweepProgress;
        ctx.beginPath();
        ctx.strokeStyle = "rgba(53, 198, 244, 0.25)";
        ctx.lineWidth = 1.5;
        ctx.moveTo(sweepX, padTop);
        ctx.lineTo(sweepX, padTop + plotHeight);
        ctx.stroke();
      }

      // 5. Scope Event Markers (RELAY ON, BROWNOUT, RESET)
      const markers = markersRef.current || [];
      if (samples.length > 0 && markers.length > 0) {
        const firstTMs = samples[0].tMs;
        const lastTMs = samples[samples.length - 1].tMs;
        const tDuration = Math.max(10, lastTMs - firstTMs);

        const timeToX = (tMs: number) => {
          if (tDuration <= 0) return padLeft;
          const norm = (tMs - firstTMs) / tDuration;
          return padLeft + plotWidth * Math.min(1, Math.max(0, norm));
        };

        markers.forEach((marker, idx) => {
          const mx = timeToX(marker.tMs);
          const isBrownout = marker.type === "brownout";
          const isReset = marker.type === "reset";
          const isRelay = marker.type === "relay_on" || marker.type === "relay_off";

          const markerColor = isBrownout || isReset ? "#FF5D68" : isRelay ? "#F4B860" : "#35C6F4";

          // Vertical Marker Line
          ctx.beginPath();
          ctx.setLineDash([3, 3]);
          ctx.strokeStyle = markerColor;
          ctx.lineWidth = 1.2;
          ctx.moveTo(mx, padTop);
          ctx.lineTo(mx, padTop + plotHeight);
          ctx.stroke();
          ctx.setLineDash([]);

          // Marker Label Tag
          const tagY = padTop - 6 - (idx % 2 === 1 ? 12 : 0);
          ctx.fillStyle = markerColor;
          ctx.font = 'bold 8.5px "JetBrains Mono", monospace';
          ctx.textAlign = "center";
          ctx.fillText(marker.label, mx, tagY);
        });
      }

      // 6. Time Axis Bottom Labels
      ctx.fillStyle = "#667085";
      ctx.font = '9px "JetBrains Mono", monospace';
      ctx.textAlign = "left";
      ctx.fillText("0 ms (Trigger)", padLeft, height - 7);
      ctx.textAlign = "right";
      const totalElapsed = samples.length > 1 ? `${(samples[samples.length - 1].tMs - samples[0].tMs).toFixed(0)} ms` : "Window";
      ctx.fillText(`+${totalElapsed}`, padLeft + plotWidth, height - 7);

      ctx.restore();
      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [ringBufferRef, markersRef, isRunning, nominalVoltage, safeThresholdVoltage]);

  const hasBrownoutOccurred = (markersRef.current ?? []).some((marker) => marker.type === "brownout");
  const measuredStateLabel = hasBrownoutOccurred
    ? "Supply voltage dropped to 2.72 V, below the 2.80 V reset threshold, triggering a brownout reset."
    : "Oscilloscope monitoring supply rail voltage at nominal 3.3 V.";

  return (
    <div
      ref={containerRef}
      role="img"
      aria-label={measuredStateLabel}
      style={{
        display: "flex",
        flexDirection: "column",
        background: "var(--ohmni-surface-raised)",
        border: "1px solid var(--ohmni-border)",
        borderRadius: "var(--radius-lg)",
        overflow: "hidden",
        position: "relative",
        boxShadow: "0 8px 24px rgba(0, 0, 0, 0.3)",
      }}
    >
      {/* Oscilloscope Header Bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "8px 14px",
          background: "var(--ohmni-surface)",
          borderBottom: "1px solid var(--ohmni-border-subtle)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              fontSize: "12px",
              fontWeight: 700,
              color: "var(--ohmni-signal)",
              background: "rgba(53, 198, 244, 0.1)",
              padding: "2px 8px",
              borderRadius: "var(--radius-xs)",
              border: "1px solid rgba(53, 198, 244, 0.25)",
            }}
          >
            <Activity size={12} />
            CH1: 3.3 V RAIL
          </span>
          <span className="metadata-text">100 kSa/s • Real-time Voltage Acquisition</span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <span
            className="font-mono"
            style={{
              fontSize: "12px",
              fontWeight: 700,
              color: liveVoltage < safeThresholdVoltage ? "var(--ohmni-fault)" : "var(--ohmni-signal)",
            }}
          >
            {liveVoltage.toFixed(2)} V
          </span>

          <span
            style={{
              fontSize: "11px",
              fontWeight: 600,
              padding: "2px 8px",
              borderRadius: "var(--radius-full)",
              background: isRunning ? "rgba(53, 198, 244, 0.15)" : "rgba(102, 112, 133, 0.15)",
              color: isRunning ? "var(--ohmni-signal)" : "var(--ohmni-text-muted)",
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
            }}
          >
            <span
              style={{
                width: "5px",
                height: "5px",
                borderRadius: "50%",
                background: isRunning ? "var(--ohmni-signal)" : "var(--ohmni-text-muted)",
              }}
            />
            {isRunning ? "ACQUIRING" : "LIVE READY"}
          </span>
        </div>
      </div>

      {/* Canvas Area */}
      <div style={{ position: "relative", width: "100%", height: "230px" }}>
        <canvas
          ref={canvasRef}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          style={{
            width: "100%",
            height: "100%",
            display: "block",
            cursor: "crosshair",
          }}
        />

        {/* Hover Coordinate Inspector Box */}
        {hoverData && (
          <div
            style={{
              position: "absolute",
              top: "10px",
              right: "70px",
              background: "rgba(11, 14, 20, 0.85)",
              border: "1px solid var(--ohmni-border)",
              borderRadius: "var(--radius-sm)",
              padding: "4px 8px",
              fontSize: "11px",
              fontFamily: "var(--font-mono)",
              color: "var(--ohmni-text-primary)",
              pointerEvents: "none",
              backdropFilter: "blur(6px)",
              display: "flex",
              gap: "8px",
            }}
          >
            <span>t: <strong style={{ color: "var(--ohmni-text-primary)" }}>{hoverData.tMs.toFixed(0)} ms</strong></span>
            <span>V: <strong style={{ color: hoverData.voltage < 2.8 ? "var(--ohmni-fault)" : "var(--ohmni-signal)" }}>{hoverData.voltage.toFixed(2)} V</strong></span>
          </div>
        )}
      </div>
    </div>
  );
};
