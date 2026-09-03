/**
 * Scene 0 — Ready to Investigate (Initial Lab Entry State).
 * Milestone 7.14 — Cohesive Workbench & Quiet Instrument Strip.
 *
 * Requirements:
 * - data-scene="ready" for state assertion
 * - Central hardware PCB with soft lighting
 * - Quiet instrument strip: 3.31 V supply • Relay open • No active experiment
 * - Less card UI chrome
 */

import React from "react";
import { motion } from "motion/react";
import { DeviceVisualizationSwitch } from "../../device/DeviceVisualizationSwitch";
import type { DeviceDescriptor } from "@/domain/device/descriptor";

export interface ReadySceneProps {
  readonly descriptor?: DeviceDescriptor | null;
  readonly isConnected?: boolean;
  readonly relayState?: "open" | "closed";
  readonly railVoltage?: number;
  readonly onStartInvestigation?: () => void;
}

export const ReadyScene: React.FC<ReadySceneProps> = ({
  descriptor,
  isConnected = true,
  relayState = "open",
  railVoltage = 3.31,
  onStartInvestigation,
}) => {
  return (
    <motion.div
      data-scene="ready"
      data-testid="ready-scene"
      initial={{ opacity: 1 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "stretch",
        justifyContent: "center",
        height: "100%",
        gap: "1.5rem",
        textAlign: "left",
        padding: "0.5rem 0",
      }}
    >
      {/* Title & Symptom Hierarchy */}
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", gap: "1.5rem", alignItems: "end" }}>
        <div>
        <h2
          style={{
            fontSize: "26px",
            fontWeight: 750,
            color: "var(--ohmni-lab-text)",
            letterSpacing: "-0.02em",
            margin: 0,
          }}
        >
          {descriptor?.name ?? "ESP32-S3 Environmental Controller"}
        </h2>
        <p
          style={{
            margin: "2px 0 0",
            fontSize: "14px",
            color: "var(--ohmni-lab-muted)",
            maxWidth: "540px",
            lineHeight: 1.5,
          }}
        >
          {descriptor?.transport === "Web Serial"
            ? "Physical device connected via Web Serial. Discover capabilities, establish baselines, and investigate hardware state."
            : "Controller resets when the fan starts. Establish a baseline, reproduce the fault, and verify the power-path repair."}
        </p>
        </div>
          {onStartInvestigation && (
            <button
              type="button"
              data-testid="start-investigation-btn"
              id="start-investigation-btn"
              onClick={onStartInvestigation}
              className="btn-primary"
              style={{
                padding: "8px 18px",
                fontSize: "13.5px",
                fontWeight: 700,
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <span>Start investigation</span>
            </button>
          )}
      </div>
      {/* Static hardware viewport. Motion is reserved for measured cause and effect. */}
      <div
        id="hardware-target-node"
        data-testid="hardware-target-node"
        style={{
          width: "100%",
          maxWidth: "760px",
          display: "flex",
          justifyContent: "flex-start",
          alignItems: "center",
        }}
      >
        <div style={{ width: "100%" }}>
          <DeviceVisualizationSwitch
            descriptor={descriptor}
            isConnected={isConnected}
            relayState={relayState}
            railVoltage={railVoltage}
            statusVisual={isConnected ? "nominal" : "disconnected"}
          />
        </div>
      </div>
      {/* Quiet Instrument Strip */}
      <div
        data-testid="lab-instrument-strip"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "14px",
          padding: "7px 18px",
          borderRadius: "var(--radius-sm)",
          background: "transparent",
          borderTop: "1px solid var(--ohmni-lab-border)",
          borderBottom: "1px solid var(--ohmni-lab-border)",
          fontSize: "13px",
          fontWeight: 600,
          color: "var(--ohmni-lab-text)",
          width: "fit-content",
        }}
      >
        <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
          <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: "#4967FF" }} />
          <span>{railVoltage.toFixed(2)} V supply</span>
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
          <span
            style={{
              width: "7px",
              height: "7px",
              borderRadius: "50%",
              background: relayState === "open" ? "#94A3B8" : "#E59D37",
            }}
          />
          <span style={{ textTransform: "capitalize" }}>Relay {relayState}</span>
        </span>
        <span style={{ color: "var(--ohmni-lab-muted)", borderLeft: "1px solid var(--ohmni-lab-border)", paddingLeft: "14px" }}>
          No active experiment
        </span>
      </div>
    </motion.div>
  );
};
