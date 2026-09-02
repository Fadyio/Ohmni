/**
 * Top Status Bar Component.
 * Displays brand identity, contextual target hardware metadata,
 * real-time device connection status, and compact WebMCP tool inspector button.
 */

import React, { useState } from "react";
import { motion } from "motion/react";
import { Radio, Sliders, Cpu, Bot, CheckCircle2, AlertTriangle, Shield } from "lucide-react";
import type { DeviceDescriptor } from "@/domain/device/descriptor";
import { useWebMCPTools } from "../../hooks/useWebMCPTools";
import { WebMCPCapabilityDrawer } from "./WebMCPCapabilityDrawer";

interface TopBarProps {
  readonly isConnected: boolean;
  readonly descriptor: DeviceDescriptor | null;
  readonly statusVisual: "nominal" | "reset" | "disconnected";
  readonly onToggleConnect?: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  isConnected,
  descriptor,
  statusVisual,
  onToggleConnect,
}) => {
  const { tools, toolCount, isNative, isDiscovering } = useWebMCPTools();
  const [inspectorOpen, setInspectorOpen] = useState<boolean>(false);

  const firmwareVersion = descriptor?.firmwareVersion ?? (isConnected ? "v2.4.1" : "—");
  const deviceName = descriptor?.name ?? (isConnected ? "ESP32-S3 Environmental Controller" : "Virtual Workbench");
  const isReset = statusVisual === "reset";

  return (
    <>
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 1.25rem",
          height: "52px",
          minHeight: "52px",
          background: "var(--ohmni-surface)",
          borderBottom: "1px solid var(--ohmni-border)",
          userSelect: "none",
          zIndex: 100,
        }}
      >
        {/* Left: Brand Logo & Title */}
        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          <img
            src="/brand/ohmni-logo.svg"
            alt="OHMNI"
            style={{ height: "22px", width: "auto" }}
          />

          <div
            style={{
              height: "16px",
              width: "1px",
              background: "var(--ohmni-border-subtle)",
            }}
          />

          <span
            style={{
              fontSize: "13px",
              fontWeight: 600,
              color: "var(--ohmni-text-primary)",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            {deviceName}
          </span>
        </div>

        {/* Center: Device Connection Status & Telemetry Mode */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span
            className="font-mono"
            style={{
              fontSize: "11px",
              padding: "3px 9px",
              borderRadius: "var(--radius-full)",
              background: isConnected
                ? isReset
                  ? "rgba(255, 93, 104, 0.15)"
                  : "rgba(53, 211, 154, 0.12)"
                : "rgba(102, 112, 133, 0.12)",
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
            {isConnected ? (isReset ? "BROWNOUT RESET" : "DEVICE CONNECTED") : "STANDBY"}
          </span>

          {isConnected && (
            <span className="metadata-text font-mono">
              Firmware {firmwareVersion}
            </span>
          )}
        </div>

        {/* Right: WebMCP Inspector Button & Agent Provider Trust Badge */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          {/* WebMCP Instruments Button */}
          <button
            onClick={() => setInspectorOpen(true)}
            className="btn-secondary"
            style={{
              padding: "4px 10px",
              fontSize: "12px",
              fontWeight: 500,
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              background: "rgba(79, 107, 255, 0.08)",
              border: "1px solid rgba(79, 107, 255, 0.2)",
              color: "var(--ohmni-brand-hover)",
            }}
            title="Inspect dynamic WebMCP instruments"
          >
            <Radio size={13} />
            <span>{toolCount} instruments</span>
            <span
              style={{
                fontSize: "10px",
                color: isNative ? "var(--ohmni-brand)" : "var(--ohmni-text-muted)",
                paddingLeft: "2px",
              }}
            >
              • {isNative ? "Native WebMCP" : "Compatibility Mode"}
            </span>
          </button>

          {/* Provider Trust Badge */}
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "4px 10px",
              borderRadius: "var(--radius-sm)",
              background: "var(--ohmni-surface-raised)",
              border: "1px solid var(--ohmni-border-subtle)",
              fontSize: "11px",
            }}
          >
            <Bot size={12} color="#C084FC" />
            <span style={{ fontWeight: 600, color: "var(--ohmni-text-primary)" }}>BENCH AGENT</span>
            <span style={{ color: "var(--ohmni-text-muted)", fontSize: "10px" }}>Deterministic</span>
          </div>

          {onToggleConnect && (
            <button
              onClick={onToggleConnect}
              className="btn-secondary"
              style={{
                padding: "4px 10px",
                fontSize: "12px",
              }}
            >
              {isConnected ? "Disconnect" : "Connect"}
            </button>
          )}
        </div>
      </header>

      {/* Inspector Modal */}
      <WebMCPCapabilityDrawer
        isOpen={inspectorOpen}
        tools={tools}
        isDiscovering={isDiscovering}
        isNative={isNative}
        onClose={() => setInspectorOpen(false)}
      />
    </>
  );
};
