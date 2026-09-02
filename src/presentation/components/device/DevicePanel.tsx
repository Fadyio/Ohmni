/**
 * Device Inspector Panel Component.
 * Left-side inspector displaying connected target hardware identity,
 * authored interactive PCB schematic, MCU voltage rail, reset telemetry, and capability count.
 */

import React from "react";
import { motion } from "motion/react";
import { Cpu, Zap, RotateCcw, Sliders, Shield, Radio } from "lucide-react";
import type { DeviceDescriptor } from "@/domain/device/descriptor";
import { DeviceSchematic } from "./DeviceSchematic";

interface DevicePanelProps {
  readonly isConnected: boolean;
  readonly descriptor: DeviceDescriptor | null;
  readonly relayState: "open" | "closed";
  readonly resetCount: number;
  readonly railVoltage: number;
  readonly statusVisual: "nominal" | "reset" | "disconnected";
  readonly isRelayTargeted?: boolean;
}

export const DevicePanel: React.FC<DevicePanelProps> = ({
  isConnected,
  descriptor,
  relayState,
  resetCount,
  railVoltage,
  statusVisual,
  isRelayTargeted = false,
}) => {
  const modelName = isConnected ? "ESP32-S3" : "Target Offline";
  const deviceTitle = descriptor?.name ?? (isConnected ? "Environmental Controller" : "No Target Connected");
  const firmwareVersion = descriptor?.firmwareVersion ?? (isConnected ? "v2.4.1" : "—");
  const isReset = statusVisual === "reset";

  return (
    <aside
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "12px",
        padding: "1rem",
        background: "var(--ohmni-surface)",
        borderRight: "1px solid var(--ohmni-border)",
        height: "100%",
        overflowY: "auto",
        minWidth: 0,
      }}
    >
      {/* Panel Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <div
            style={{
              width: "24px",
              height: "24px",
              borderRadius: "var(--radius-sm)",
              background: "rgba(53, 198, 244, 0.12)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--ohmni-signal)",
            }}
          >
            <Cpu size={14} />
          </div>
          <span className="panel-heading">Target Hardware</span>
        </div>

        <span
          className="font-mono"
          style={{
            fontSize: "11px",
            padding: "2px 8px",
            borderRadius: "var(--radius-full)",
            background: isConnected
              ? isReset
                ? "rgba(255, 93, 104, 0.15)"
                : "rgba(53, 211, 154, 0.12)"
              : "rgba(102, 112, 133, 0.15)",
            color: isConnected
              ? isReset
                ? "var(--ohmni-fault)"
                : "var(--ohmni-success)"
              : "var(--ohmni-text-muted)",
            fontWeight: 600,
            display: "inline-flex",
            alignItems: "center",
            gap: "5px",
          }}
        >
          <span
            style={{
              width: "6px",
              height: "6px",
              borderRadius: "50%",
              background: "currentColor",
            }}
          />
          {isConnected ? (isReset ? "RESET FAULT" : "ONLINE") : "OFFLINE"}
        </span>
      </div>

      {/* Authored Interactive PCB Schematic */}
      <DeviceSchematic
        isConnected={isConnected}
        relayState={relayState}
        statusVisual={statusVisual}
        railVoltage={railVoltage}
        isRelayTargeted={isRelayTargeted}
      />

      {/* Target Identity Metadata Card */}
      <div
        style={{
          background: "var(--ohmni-surface-raised)",
          border: "1px solid var(--ohmni-border-subtle)",
          borderRadius: "var(--radius-md)",
          padding: "12px",
          display: "flex",
          flexDirection: "column",
          gap: "8px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--ohmni-text-primary)" }}>
              {deviceTitle}
            </div>
            <div className="metadata-text">{modelName} • Firmware {firmwareVersion}</div>
          </div>
        </div>

        {/* Telemetry Metrics Grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "8px",
            marginTop: "4px",
          }}
        >
          {/* Supply Rail Voltage */}
          <div
            style={{
              background: "var(--ohmni-surface)",
              border: "1px solid var(--ohmni-border-subtle)",
              borderRadius: "var(--radius-sm)",
              padding: "8px 10px",
            }}
          >
            <div className="metadata-text" style={{ display: "flex", alignItems: "center", gap: "4px" }}>
              <Zap size={11} color="var(--ohmni-signal)" />
              SUPPLY RAIL
            </div>
            <div
              className="font-mono"
              style={{
                fontSize: "15px",
                fontWeight: 700,
                color: railVoltage < 2.8 ? "var(--ohmni-fault)" : "var(--ohmni-signal)",
                marginTop: "2px",
              }}
            >
              {isConnected ? `${railVoltage.toFixed(2)} V` : "--"}
            </div>
          </div>

          {/* Reset Counter */}
          <div
            style={{
              background: "var(--ohmni-surface)",
              border: "1px solid var(--ohmni-border-subtle)",
              borderRadius: "var(--radius-sm)",
              padding: "8px 10px",
            }}
          >
            <div className="metadata-text" style={{ display: "flex", alignItems: "center", gap: "4px" }}>
              <RotateCcw size={11} color={resetCount > 0 ? "var(--ohmni-warning)" : "var(--ohmni-text-muted)"} />
              RESETS
            </div>
            <div
              className="font-mono"
              style={{
                fontSize: "15px",
                fontWeight: 700,
                color: resetCount > 0 ? "var(--ohmni-warning)" : "var(--ohmni-text-primary)",
                marginTop: "2px",
              }}
            >
              {isConnected ? `${resetCount} events` : "--"}
            </div>
          </div>
        </div>
      </div>

      {/* Circuit Intervention Point Card */}
      <div
        style={{
          background: "var(--ohmni-surface-raised)",
          border: "1px solid var(--ohmni-border-subtle)",
          borderRadius: "var(--radius-md)",
          padding: "12px",
          display: "flex",
          flexDirection: "column",
          gap: "6px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <Sliders size={13} color="var(--ohmni-brand-hover)" />
          <span className="metadata-text" style={{ fontWeight: 600, color: "var(--ohmni-text-secondary)" }}>
            CIRCUIT TOPOLOGY
          </span>
        </div>
        <div style={{ fontSize: "12px", color: "var(--ohmni-text-secondary)", lineHeight: 1.4 }}>
          Relay Coil Jumper: <span className="font-mono" style={{ color: "var(--ohmni-text-primary)", fontWeight: 600 }}>3.3V (Shared Rail)</span>
        </div>
        <div className="metadata-text" style={{ fontSize: "11px", color: "var(--ohmni-text-muted)" }}>
          High inrush coil current directly loads MCU 3.3V regulator rail.
        </div>
      </div>
    </aside>
  );
};
