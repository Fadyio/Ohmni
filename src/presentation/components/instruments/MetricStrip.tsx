/**
 * Live Metric Strip Component.
 * Displays high-precision numerical telemetry metrics: Baseline, Minimum, Sag Drop, and Reset Cause.
 */

import React from "react";
import type { VoltageSummary } from "@/domain/experiment/types";
import type { ResetReason } from "@/domain/device/events";

interface MetricStripProps {
  readonly baselineVoltage: number;
  readonly voltageSummary: VoltageSummary | null;
  readonly isRunning: boolean;
  readonly resetReason: ResetReason | null;
  readonly liveVoltage?: number;
}

export const MetricStrip: React.FC<MetricStripProps> = ({
  baselineVoltage,
  voltageSummary,
  isRunning,
  resetReason,
  liveVoltage,
}) => {
  const hasSummary = Boolean(voltageSummary);
  const baseline = voltageSummary?.baseline_v ?? baselineVoltage;
  const minimum = voltageSummary ? `${voltageSummary.minimum_v.toFixed(2)} V` : isRunning && liveVoltage !== undefined ? `${liveVoltage.toFixed(2)} V` : "—";
  const drop = voltageSummary ? `−${Math.abs(voltageSummary.drop_v).toFixed(2)} V` : "—";
  const resetText = resetReason ?? (hasSummary ? "NONE" : "—");

  const isFaultSag = voltageSummary ? voltageSummary.minimum_v < 2.80 : false;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(4, 1fr)",
        gap: "10px",
      }}
    >
      {/* Baseline Voltage */}
      <div
        style={{
          padding: "10px 14px",
          background: "var(--ohmni-surface-raised)",
          border: "1px solid var(--ohmni-border)",
          borderRadius: "var(--radius-sm)",
        }}
      >
        <div className="label-technical">BASELINE</div>
        <div
          className="font-mono"
          style={{
            fontSize: "1.125rem",
            fontWeight: 700,
            color: "var(--ohmni-text-primary)",
            marginTop: "2px",
          }}
        >
          {baseline.toFixed(2)} V
        </div>
      </div>

      {/* Minimum Voltage */}
      <div
        style={{
          padding: "10px 14px",
          background: "var(--ohmni-surface-raised)",
          border: `1px solid ${isFaultSag ? "rgba(239, 68, 68, 0.4)" : "var(--ohmni-border)"}`,
          borderRadius: "var(--radius-sm)",
        }}
      >
        <div className="label-technical">MINIMUM</div>
        <div
          className="font-mono"
          style={{
            fontSize: "1.125rem",
            fontWeight: 700,
            color: isFaultSag ? "var(--ohmni-fault)" : "var(--ohmni-text-primary)",
            marginTop: "2px",
          }}
        >
          {minimum}
        </div>
      </div>

      {/* Voltage Sag Drop */}
      <div
        style={{
          padding: "10px 14px",
          background: "var(--ohmni-surface-raised)",
          border: `1px solid ${isFaultSag ? "rgba(239, 68, 68, 0.4)" : "var(--ohmni-border)"}`,
          borderRadius: "var(--radius-sm)",
        }}
      >
        <div className="label-technical">DROP</div>
        <div
          className="font-mono"
          style={{
            fontSize: "1.125rem",
            fontWeight: 700,
            color: isFaultSag ? "var(--ohmni-fault)" : "var(--ohmni-text-primary)",
            marginTop: "2px",
          }}
        >
          {drop}
        </div>
      </div>

      {/* Reset Cause */}
      <div
        style={{
          padding: "10px 14px",
          background: "var(--ohmni-surface-raised)",
          border: `1px solid ${resetReason ? "rgba(239, 68, 68, 0.4)" : "var(--ohmni-border)"}`,
          borderRadius: "var(--radius-sm)",
        }}
      >
        <div className="label-technical">RESET CAUSE</div>
        <div
          className="font-mono"
          style={{
            fontSize: "1.125rem",
            fontWeight: 700,
            color: resetReason ? "var(--ohmni-fault)" : "var(--ohmni-text-secondary)",
            marginTop: "2px",
          }}
        >
          {resetText}
        </div>
      </div>
    </div>
  );
};
