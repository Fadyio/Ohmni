/**
 * src/presentation/components/investigation-story/scenes/MeasurementScene.tsx
 *
 * Scene: Passive Measurement (measure_supply_voltage).
 * Section 11 of OHMNI Product Design Specification.
 *
 * Invariants:
 * 1. One beautiful physical instrument presentation.
 * 2. Large numeric measurement (3.31 V).
 * 3. Secondary: MCU supply rail.
 * 4. Status: Within expected range.
 * 5. Not wrapped in 4 cards; single physical instrument surface.
 */

import React from "react";
import { motion } from "motion/react";
import { Activity, CheckCircle2 } from "lucide-react";
import { OHMNI_COPY } from "../../../copy/copy";

export interface MeasurementSceneProps {
  readonly railVoltage?: number;
  readonly unit?: string;
  readonly status?: string;
}

export const MeasurementScene: React.FC<MeasurementSceneProps> = ({
  railVoltage = 3.31,
  unit = "V",
  status = "normal",
}) => {
  const displayVoltage = typeof railVoltage === "number" ? railVoltage.toFixed(2) : "3.31";

  return (
    <motion.div
      data-scene="measurement"
      data-testid="measurement-scene"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "1.5rem",
        height: "100%",
        color: "var(--ink, #111318)",
        padding: "0.5rem 0",
      }}
    >
      {/* Header */}
      <div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            color: "var(--brand, #2B57FF)",
            fontSize: "12px",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}
        >
          <Activity size={14} />
          <span>PASSIVE MEASUREMENT · measure_supply_voltage</span>
        </div>
        <h2
          style={{
            fontSize: "26px",
            fontWeight: 750,
            color: "var(--ink, #111318)",
            margin: "4px 0 0",
            letterSpacing: "-0.02em",
          }}
        >
          {OHMNI_COPY.measureScene.headline}
        </h2>
        <p style={{ margin: "4px 0 0", fontSize: "14px", color: "var(--ink-secondary, #5C6470)" }}>
          {OHMNI_COPY.measureScene.subline}
        </p>
      </div>

      {/* One Physical Instrument Surface */}
      <div
        data-testid="voltage-display"
        style={{
          background: "var(--surface, #FFFFFF)",
          border: "1px solid var(--border, rgba(18, 21, 26, 0.08))",
          borderRadius: "var(--radius-lg, 14px)",
          padding: "2.5rem",
          boxShadow: "var(--shadow-soft)",
          display: "flex",
          flexDirection: "column",
          gap: "1.25rem",
          maxWidth: "680px",
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", gap: "10px" }}>
          <span
            className="font-mono metric-large"
            style={{
              fontSize: "64px",
              fontWeight: 800,
              letterSpacing: "-0.03em",
              color: "var(--ink, #111318)",
              lineHeight: 1,
            }}
          >
            {displayVoltage}
          </span>
          <span
            className="font-mono"
            style={{
              fontSize: "28px",
              fontWeight: 700,
              color: "var(--ink-secondary, #5C6470)",
            }}
          >
            {unit}
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
          <div
            style={{
              fontSize: "14px",
              fontWeight: 600,
              color: "var(--ink, #111318)",
            }}
          >
            {OHMNI_COPY.measureScene.nominalLabel}
          </div>

          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              fontSize: "13px",
              fontWeight: 600,
              color: "var(--verified, #16A34A)",
              background: "rgba(22, 163, 74, 0.08)",
              padding: "4px 10px",
              borderRadius: "var(--radius-full, 9999px)",
            }}
          >
            <CheckCircle2 size={14} />
            <span>{OHMNI_COPY.measureScene.statusNormal}</span>
          </div>
        </div>

        <div
          style={{
            borderTop: "1px solid var(--border, rgba(18, 21, 26, 0.06))",
            paddingTop: "1rem",
            fontSize: "13px",
            color: "var(--ink-secondary, #5C6470)",
            lineHeight: 1.45,
          }}
        >
          Measured at quiescent baseline while relay is de-energized. Power rail delivers nominal operating voltage with no load sag.
        </div>
      </div>
    </motion.div>
  );
};
