/**
 * Live Metric Strip Component.
 * High-precision integrated instrument readouts:
 * Baseline, Minimum Voltage, Voltage Sag Drop, and Reset Status.
 */

import React from "react";
import type { VoltageSummary } from "@/domain/experiment/types";
import type { ResetReason } from "@/domain/device/events";
import { Zap, TrendingDown, ArrowDownRight, AlertTriangle, CheckCircle } from "lucide-react";

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
  const minimum = voltageSummary
    ? `${voltageSummary.minimum_v.toFixed(2)} V`
    : isRunning && liveVoltage !== undefined
    ? `${liveVoltage.toFixed(2)} V`
    : `${baselineVoltage.toFixed(2)} V`;
  const drop = voltageSummary ? `−${Math.abs(voltageSummary.drop_v).toFixed(2)} V` : "0.00 V";
  const resetText = resetReason ?? (hasSummary ? "NOMINAL" : "NONE");

  const isFaultSag = voltageSummary ? voltageSummary.minimum_v < 2.80 : false;
  const isBrownout = resetReason === "BROWNOUT";

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(4, 1fr)",
        background: "var(--ohmni-surface-raised)",
        border: "1px solid var(--ohmni-border)",
        borderRadius: "var(--radius-lg)",
        padding: "8px 12px",
        gap: "12px",
      }}
    >
      {/* Baseline Voltage */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "2px",
          paddingRight: "12px",
          borderRight: "1px solid var(--ohmni-border-subtle)",
        }}
      >
        <div className="metadata-text" style={{ display: "flex", alignItems: "center", gap: "4px" }}>
          <Zap size={11} color="var(--ohmni-signal)" />
          BASELINE
        </div>
        <div
          className="font-mono"
          style={{
            fontSize: "17px",
            fontWeight: 700,
            color: "var(--ohmni-text-primary)",
          }}
        >
          {baseline.toFixed(2)} V
        </div>
      </div>

      {/* Minimum Voltage */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "2px",
          paddingRight: "12px",
          borderRight: "1px solid var(--ohmni-border-subtle)",
        }}
      >
        <div className="metadata-text" style={{ display: "flex", alignItems: "center", gap: "4px" }}>
          <TrendingDown size={11} color={isFaultSag ? "var(--ohmni-fault)" : "var(--ohmni-signal)"} />
          MINIMUM
        </div>
        <div
          className="font-mono"
          style={{
            fontSize: "17px",
            fontWeight: 700,
            color: isFaultSag ? "var(--ohmni-fault)" : "var(--ohmni-signal)",
          }}
        >
          {minimum} {isFaultSag && <span style={{ fontSize: "11px", fontWeight: 600 }}>↓ SAG</span>}
        </div>
      </div>

      {/* Voltage Sag Drop */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "2px",
          paddingRight: "12px",
          borderRight: "1px solid var(--ohmni-border-subtle)",
        }}
      >
        <div className="metadata-text" style={{ display: "flex", alignItems: "center", gap: "4px" }}>
          <ArrowDownRight size={11} color={isFaultSag ? "var(--ohmni-fault)" : "var(--ohmni-text-muted)"} />
          COLLAPSE
        </div>
        <div
          className="font-mono"
          style={{
            fontSize: "17px",
            fontWeight: 700,
            color: isFaultSag ? "var(--ohmni-fault)" : "var(--ohmni-text-primary)",
          }}
        >
          {drop}
        </div>
      </div>

      {/* Reset Cause Status */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "2px",
        }}
      >
        <div className="metadata-text" style={{ display: "flex", alignItems: "center", gap: "4px" }}>
          {isBrownout ? (
            <AlertTriangle size={11} color="var(--ohmni-fault)" />
          ) : (
            <CheckCircle size={11} color="var(--ohmni-success)" />
          )}
          RESET STATE
        </div>
        <div
          className="font-mono"
          style={{
            fontSize: "15px",
            fontWeight: 700,
            color: isBrownout
              ? "var(--ohmni-fault)"
              : hasSummary
              ? "var(--ohmni-success)"
              : "var(--ohmni-text-muted)",
          }}
        >
          {resetText}
        </div>
      </div>
    </div>
  );
};
