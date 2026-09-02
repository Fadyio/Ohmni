/**
 * Top Status Bar Component.
 * Milestone 7.13 — Visual Rescue: 3D OHMNI Identity + Cohesive Product UI
 *
 * Displays compact 3D OHMNI Wordmark, contextual target hardware metadata,
 * real-time connection status, and WebMCP capability drawer.
 */

import React, { useState } from "react";
import { motion } from "motion/react";
import { Radio, Sliders, Cpu, Bot, CheckCircle2, AlertTriangle, ShieldCheck } from "lucide-react";
import type { DeviceDescriptor } from "@/domain/device/descriptor";
import { useWebMCPTools } from "../../hooks/useWebMCPTools";
import { WebMCPCapabilityDrawer } from "./WebMCPCapabilityDrawer";
import { Ohmni3DWordmark } from "../brand/Ohmni3DWordmark";

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

  const deviceName = descriptor?.name ?? (isConnected ? "ESP32 ENVIRONMENTAL CONTROLLER" : "Virtual Workbench");
  const isReset = statusVisual === "reset";

  return (
    <>
      <header
        id="lab-header"
        data-testid="lab-header"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0.75rem 2.25rem",
          background: "var(--ohmni-lab-nav, rgba(255, 255, 255, 0.88))",
          backdropFilter: "blur(12px)",
          borderBottom: "1px solid var(--ohmni-lab-border)",
          flex: "none",
          zIndex: 10,
        }}
      >
        {/* Left: Compact 3D Brand Wordmark + Target Title */}
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div id="navbar-brand-wordmark" data-testid="navbar-brand-wordmark">
            <Ohmni3DWordmark variant="compact" />
          </div>

          <div style={{ height: "18px", width: "1px", background: "var(--ohmni-lab-border)" }} />

          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span
              style={{
                width: "7px",
                height: "7px",
                borderRadius: "50%",
                background: isReset
                  ? "var(--ohmni-lab-fault)"
                  : isConnected
                  ? "var(--ohmni-lab-verified)"
                  : "var(--ohmni-lab-muted)",
                boxShadow: isConnected && !isReset ? "0 0 8px rgba(39, 150, 107, 0.5)" : "none",
              }}
            />
            <span className="font-mono" style={{ fontSize: "13px", fontWeight: 700, color: "var(--ohmni-lab-text)" }}>
              {deviceName}
            </span>
          </div>
        </div>

        {/* Center: WebMCP Mesh & Dynamic Status */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span
            data-testid="webmcp-mode-badge"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "4px 12px",
              borderRadius: "var(--radius-full)",
              background: isNative ? "rgba(39, 150, 107, 0.08)" : "rgba(18, 21, 26, 0.04)",
              border: `1px solid ${isNative ? "rgba(39, 150, 107, 0.25)" : "var(--ohmni-lab-border)"}`,
              color: isNative ? "var(--ohmni-lab-verified)" : "var(--ohmni-lab-muted)",
              fontSize: "11px",
              fontWeight: 600,
            }}
          >
            <ShieldCheck size={12} />
            <span>{isNative ? "Native WebMCP Mesh" : "Standard WebMCP"}</span>
          </span>

          <span
            data-testid="gemini-provider-badge"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "4px 12px",
              borderRadius: "var(--radius-full)",
              background: "rgba(73, 103, 255, 0.08)",
              border: "1px solid rgba(73, 103, 255, 0.25)",
              color: "var(--ohmni-lab-brand)",
              fontSize: "11px",
              fontWeight: 700,
            }}
          >
            <Bot size={12} />
            <span>DEMO AGENT</span>
          </span>
        </div>

        {/* Right: Technical Inspector & Connection Toggle */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <button
            onClick={() => setInspectorOpen(true)}
            className="btn-secondary"
            style={{
              padding: "6px 12px",
              fontSize: "12px",
            }}
          >
            <Radio size={13} color="var(--ohmni-lab-brand)" />
            <span>WebMCP Tools ({toolCount})</span>
          </button>

          {onToggleConnect && (
            <button
              onClick={onToggleConnect}
              className="btn-secondary"
              style={{
                padding: "6px 12px",
                fontSize: "12px",
              }}
            >
              <Sliders size={13} />
              <span>{isConnected ? "Disconnect" : "Connect"}</span>
            </button>
          )}
        </div>
      </header>

      {/* WebMCP Capability Drawer */}
      <WebMCPCapabilityDrawer
        isOpen={inspectorOpen}
        onClose={() => setInspectorOpen(false)}
        tools={tools}
        isNative={isNative}
        isDiscovering={isDiscovering}
      />
    </>
  );
};
