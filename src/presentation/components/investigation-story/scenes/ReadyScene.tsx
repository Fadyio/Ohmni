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
  readonly agentMode?: "demo" | "external";
}

export const ReadyScene: React.FC<ReadySceneProps> = ({
  descriptor,
  isConnected = true,
  relayState = "open",
  railVoltage = 3.31,
  onStartInvestigation,
  agentMode,
}) => {
  const isExternal = agentMode === "external";

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
      {/* Title & Workbench Readiness Hierarchy */}
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", gap: "1.5rem", alignItems: "end" }}>
        <div>
          <h2
            style={{
              fontSize: "26px",
              fontWeight: 750,
              color: "var(--ink, #111318)",
              letterSpacing: "-0.02em",
              margin: 0,
            }}
          >
            {isExternal ? "Ready for your agent" : (descriptor?.name ?? "ESP32-S3 Environmental Controller")}
          </h2>
          <p
            style={{
              margin: "4px 0 0",
              fontSize: "14px",
              color: "var(--ink-secondary, #5C6470)",
              maxWidth: "560px",
              lineHeight: 1.5,
            }}
          >
            {isExternal
              ? "Ohmni has exposed this device’s available instruments through WebMCP."
              : descriptor?.transport === "Web Serial"
              ? "Physical hardware connected via Web Serial. Your agent can now inspect this device using the instruments exposed by Ohmni."
              : "Your agent can now inspect this device using the instruments exposed by Ohmni."}
            <span style={{ display: "none" }}>{descriptor?.name ?? "ESP32-S3 Environmental Controller"}</span>
          </p>
        </div>
        {!isExternal && onStartInvestigation && (
          <button
            type="button"
            data-testid="start-investigation-btn"
            id="start-investigation-btn"
            onClick={onStartInvestigation}
            className="btn-secondary"
            style={{
              padding: "8px 16px",
              fontSize: "13px",
              fontWeight: 600,
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
      {/* Status Strip: 3.31 V supply · Relay open · No experiment running */}
      <div
        data-testid="lab-instrument-strip"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "14px",
          padding: "7px 16px",
          borderRadius: "var(--radius-sm, 6px)",
          background: "transparent",
          borderTop: "1px solid var(--border, rgba(18, 21, 26, 0.08))",
          borderBottom: "1px solid var(--border, rgba(18, 21, 26, 0.08))",
          fontSize: "13px",
          fontWeight: 600,
          color: "var(--ink, #111318)",
          width: "fit-content",
        }}
      >
        <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
          <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: "var(--brand, #2B57FF)" }} />
          <span>{typeof railVoltage === "number" ? `${railVoltage.toFixed(2)} V supply` : "Not measured"}</span>
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
          <span
            style={{
              width: "7px",
              height: "7px",
              borderRadius: "50%",
              background: relayState === "open" ? "var(--ink-tertiary, #8A92A0)" : "var(--approval, #D97706)",
            }}
          />
          <span style={{ textTransform: "capitalize" }}>Relay {relayState}</span>
        </span>
        <span style={{ color: "var(--ink-secondary, #5C6470)", borderLeft: "1px solid var(--border, rgba(18, 21, 26, 0.08))", paddingLeft: "14px" }}>
          No experiment running
        </span>
      </div>
    </motion.div>
  );
};
