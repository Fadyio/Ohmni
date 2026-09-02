/**
 * Device Inspector Panel Component.
 * Left-side inspector displaying connected target hardware identity,
 * board silhouette, MCU voltage rail, reset telemetry, and capability count.
 */

import React from "react";
import { motion } from "framer-motion";
import type { DeviceDescriptor } from "@/domain/device/descriptor";
import { BoardSilhouette } from "./BoardSilhouette";
import { faultFlashVariants, microTransition } from "../motion/transitions";

interface DevicePanelProps {
  readonly isConnected: boolean;
  readonly descriptor: DeviceDescriptor | null;
  readonly relayState: "open" | "closed";
  readonly resetCount: number;
  readonly railVoltage: number;
  readonly statusVisual: "nominal" | "reset" | "disconnected";
}

export const DevicePanel: React.FC<DevicePanelProps> = ({
  isConnected,
  descriptor,
  relayState,
  resetCount,
  railVoltage,
  statusVisual,
}) => {
  const modelName = isConnected ? "ESP32-S3" : "Unknown";
  const deviceTitle = descriptor?.name ?? (isConnected ? "Environmental Controller" : "No Device Attached");
  const firmwareVersion = descriptor?.firmwareVersion ?? (isConnected ? "2.4.1" : "—");
  const capabilitiesCount = descriptor?.capabilities?.length ?? (isConnected ? 6 : 0);

  return (
    <aside
      style={{
        width: "260px",
        minWidth: "260px",
        background: "var(--ohmni-surface)",
        borderRight: "1px solid var(--ohmni-border)",
        display: "flex",
        flexDirection: "column",
        gap: "1rem",
        padding: "1.25rem 1rem",
        overflowY: "auto",
      }}
    >
      {/* Section Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span className="label-technical">DEVICE INSPECTOR</span>
        <span
          className="font-mono"
          style={{
            fontSize: "0.625rem",
            color: isConnected ? "var(--ohmni-accent)" : "var(--ohmni-text-muted)",
          }}
        >
          {isConnected ? "UART/USB" : "OFFLINE"}
        </span>
      </div>

      {/* Primary Device Identity Card */}
      <div
        style={{
          padding: "12px",
          background: "var(--ohmni-surface-raised)",
          border: "1px solid var(--ohmni-border)",
          borderRadius: "var(--radius-md)",
          display: "flex",
          flexDirection: "column",
          gap: "8px",
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
          <div>
            <div
              className="font-mono"
              style={{
                fontSize: "0.9375rem",
                fontWeight: 700,
                color: "var(--ohmni-text-primary)",
              }}
            >
              {modelName}
            </div>
            <div
              style={{
                fontSize: "0.75rem",
                color: "var(--ohmni-text-secondary)",
                marginTop: "2px",
              }}
            >
              {deviceTitle}
            </div>
          </div>

          <motion.span
            variants={faultFlashVariants}
            animate={statusVisual}
            transition={microTransition}
            className="font-mono"
            style={{
              fontSize: "0.625rem",
              fontWeight: 700,
              padding: "2px 6px",
              borderRadius: "var(--radius-sm)",
              border: "1px solid transparent",
              letterSpacing: "0.05em",
            }}
          >
            {statusVisual === "reset"
              ? "RESET"
              : isConnected
              ? "CONNECTED"
              : "DISCONNECTED"}
          </motion.span>
        </div>

        {/* Board Silhouette Graphic */}
        <div style={{ marginTop: "4px" }}>
          <BoardSilhouette
            isConnected={isConnected}
            relayState={relayState}
            statusVisual={statusVisual}
          />
        </div>
      </div>

      {/* Hardware Telemetry & Specifications */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "8px",
        }}
      >
        {/* Firmware */}
        <div
          style={{
            padding: "8px 10px",
            background: "var(--ohmni-surface-raised)",
            border: "1px solid var(--ohmni-border-subtle)",
            borderRadius: "var(--radius-sm)",
          }}
        >
          <div className="label-technical" style={{ fontSize: "0.5625rem" }}>
            FIRMWARE
          </div>
          <div
            className="font-mono"
            style={{
              fontSize: "0.8125rem",
              fontWeight: 600,
              color: "var(--ohmni-text-primary)",
              marginTop: "2px",
            }}
          >
            {firmwareVersion}
          </div>
        </div>

        {/* MCU Rail Voltage */}
        <div
          style={{
            padding: "8px 10px",
            background: "var(--ohmni-surface-raised)",
            border: "1px solid var(--ohmni-border-subtle)",
            borderRadius: "var(--radius-sm)",
          }}
        >
          <div className="label-technical" style={{ fontSize: "0.5625rem" }}>
            MCU RAIL
          </div>
          <div
            className="font-mono"
            style={{
              fontSize: "0.8125rem",
              fontWeight: 600,
              color: isConnected ? "var(--ohmni-accent)" : "var(--ohmni-text-muted)",
              marginTop: "2px",
            }}
          >
            {isConnected ? `${railVoltage.toFixed(2)} V` : "—"}
          </div>
        </div>

        {/* Reset Count */}
        <div
          style={{
            padding: "8px 10px",
            background: "var(--ohmni-surface-raised)",
            border: "1px solid var(--ohmni-border-subtle)",
            borderRadius: "var(--radius-sm)",
          }}
        >
          <div className="label-technical" style={{ fontSize: "0.5625rem" }}>
            RESET COUNT
          </div>
          <div
            className="font-mono"
            style={{
              fontSize: "0.8125rem",
              fontWeight: 600,
              color: resetCount > 0 ? "var(--ohmni-warning)" : "var(--ohmni-text-primary)",
              marginTop: "2px",
            }}
          >
            {isConnected ? resetCount : "—"}
          </div>
        </div>

        {/* Capabilities */}
        <div
          style={{
            padding: "8px 10px",
            background: "var(--ohmni-surface-raised)",
            border: "1px solid var(--ohmni-border-subtle)",
            borderRadius: "var(--radius-sm)",
          }}
        >
          <div className="label-technical" style={{ fontSize: "0.5625rem" }}>
            CAPABILITIES
          </div>
          <div
            className="font-mono"
            style={{
              fontSize: "0.8125rem",
              fontWeight: 600,
              color: "var(--ohmni-text-primary)",
              marginTop: "2px",
            }}
          >
            {isConnected ? capabilitiesCount : "—"}
          </div>
        </div>
      </div>

      {/* Actuation / Circuit Configuration Note */}
      <div
        style={{
          marginTop: "auto",
          padding: "10px",
          background: "rgba(15, 23, 42, 0.4)",
          border: "1px solid var(--ohmni-border-subtle)",
          borderRadius: "var(--radius-sm)",
          fontSize: "0.6875rem",
          color: "var(--ohmni-text-muted)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
          <span
            style={{
              width: "5px",
              height: "5px",
              borderRadius: "50%",
              background: relayState === "closed" ? "var(--ohmni-warning)" : "var(--ohmni-text-disabled)",
            }}
          />
          <span className="label-technical" style={{ fontSize: "0.5625rem" }}>
            RELAY ACTUATION STATE
          </span>
        </div>
        <div className="font-mono" style={{ color: "var(--ohmni-text-secondary)" }}>
          {relayState === "closed" ? "K1 CLOSED (COIL ACTIVE)" : "K1 OPEN (NOMINAL)"}
        </div>
        <div style={{ marginTop: "4px", fontSize: "0.625rem", color: "var(--ohmni-text-disabled)" }}>
          Hardware rail: 3.3V supply branch
        </div>
      </div>
    </aside>
  );
};
