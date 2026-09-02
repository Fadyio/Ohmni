/**
 * Factual Experiment Status Card Component.
 * Enforces precise mathematical and semantic reporting:
 * Never claims "3/3 failed" when a brownout terminated during cycle 1.
 */

import React from "react";
import type { ExperimentStatus } from "@/domain/experiment/types";
import type { ResetReason } from "@/domain/device/events";

interface ExperimentStatusCardProps {
  readonly status: ExperimentStatus | "idle";
  readonly requestedCycles: number;
  readonly completedCycles: number;
  readonly faultReproduced: boolean;
  readonly resetOccurred: boolean;
  readonly resetReason: ResetReason | null;
  readonly activeExperimentId: string | null;
}

export const ExperimentStatusCard: React.FC<ExperimentStatusCardProps> = ({
  status,
  requestedCycles,
  completedCycles,
  faultReproduced,
  resetOccurred,
  resetReason,
  activeExperimentId,
}) => {
  const isIdle = status === "idle";
  const isRunning = status === "running";

  return (
    <div
      style={{
        padding: "12px 16px",
        background: "var(--ohmni-surface-raised)",
        border: `1px solid ${
          faultReproduced
            ? "rgba(239, 68, 68, 0.4)"
            : isRunning
            ? "rgba(56, 189, 248, 0.4)"
            : "var(--ohmni-border)"
        }`,
        borderRadius: "var(--radius-md)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      {/* Left: Primary State & Sub-status */}
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <div
          style={{
            width: "10px",
            height: "10px",
            borderRadius: "50%",
            background: faultReproduced
              ? "var(--ohmni-fault)"
              : isRunning
              ? "var(--ohmni-accent)"
              : "var(--ohmni-text-muted)",
            boxShadow: faultReproduced
              ? "0 0 10px var(--ohmni-fault)"
              : isRunning
              ? "0 0 10px var(--ohmni-accent)"
              : "none",
          }}
        />
        <div>
          <div
            className="font-mono"
            style={{
              fontSize: "0.875rem",
              fontWeight: 700,
              color: faultReproduced
                ? "var(--ohmni-fault)"
                : isRunning
                ? "var(--ohmni-accent)"
                : "var(--ohmni-text-primary)",
              letterSpacing: "0.05em",
            }}
          >
            {faultReproduced
              ? "FAULT REPRODUCED — BROWNOUT RESET"
              : isRunning
              ? "RUNNING — RELAY STRESS TEST"
              : "READY — SYSTEM IDLE"}
          </div>

          <div
            style={{
              fontSize: "0.75rem",
              color: "var(--ohmni-text-secondary)",
              marginTop: "2px",
            }}
          >
            {isIdle && "No active physical experiment. Ready for WebMCP actuation."}
            {isRunning && `Actuation in progress (Cycle 1 / requested ${requestedCycles})`}
            {faultReproduced && (
              <span>
                Reset occurred during cycle 1 ({resetReason ?? "BROWNOUT"}). Supply collapsed below safe threshold.
              </span>
            )}
            {!isIdle && !isRunning && !faultReproduced && (
              <span>Experiment completed nominal actuation.</span>
            )}
          </div>
        </div>
      </div>

      {/* Right: Factual Cycle Counts & ID */}
      <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
        {!isIdle && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              padding: "4px 10px",
              background: "var(--ohmni-surface)",
              border: "1px solid var(--ohmni-border-subtle)",
              borderRadius: "var(--radius-sm)",
            }}
          >
            <div>
              <span className="label-technical" style={{ fontSize: "0.5625rem" }}>
                REQUESTED
              </span>
              <div className="font-mono" style={{ fontSize: "0.8125rem", fontWeight: 600 }}>
                {requestedCycles}
              </div>
            </div>

            <div style={{ width: "1px", height: "18px", background: "var(--ohmni-border)" }} />

            <div>
              <span className="label-technical" style={{ fontSize: "0.5625rem" }}>
                COMPLETED
              </span>
              <div
                className="font-mono"
                style={{
                  fontSize: "0.8125rem",
                  fontWeight: 600,
                  color: completedCycles === 0 && resetOccurred ? "var(--ohmni-fault)" : "var(--ohmni-text-primary)",
                }}
              >
                {completedCycles}
              </div>
            </div>
          </div>
        )}

        {activeExperimentId && (
          <div
            className="font-mono"
            style={{
              fontSize: "0.6875rem",
              color: "var(--ohmni-text-muted)",
              background: "var(--ohmni-surface)",
              padding: "4px 8px",
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--ohmni-border-subtle)",
            }}
            title={activeExperimentId}
          >
            {activeExperimentId.slice(0, 18)}...
          </div>
        )}
      </div>
    </div>
  );
};
