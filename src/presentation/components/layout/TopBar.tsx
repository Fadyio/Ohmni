/**
 * Top Status Bar Component.
 * Master Milestone 8 — Precision Workbench Header.
 *
 * Displays the OHMNI brand, contextual target hardware metadata,
 * sealed scenario badge, real-time connection status, and WebMCP capability drawer.
 */

import React, { useState } from "react";
import { Radio, Sliders, Cpu, Bot, CheckCircle2, AlertTriangle, ShieldCheck, Lock, Terminal } from "lucide-react";
import type { DeviceDescriptor } from "@/domain/device/descriptor";
import type { ScenarioSession } from "@/domain/scenario/types";
import { useWebMCPTools } from "../../hooks/useWebMCPTools";
import { WebMCPCapabilityDrawer } from "./WebMCPCapabilityDrawer";

export interface TopBarProps {
  readonly isConnected: boolean;
  readonly descriptor: DeviceDescriptor | null;
  readonly statusVisual?: "nominal" | "reset" | "disconnected";
  readonly activeScenario?: ScenarioSession | null;
  readonly onToggleConnect?: () => void;
  readonly onOpenDevInspector?: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  isConnected,
  descriptor,
  statusVisual = "nominal",
  activeScenario,
  onToggleConnect,
  onOpenDevInspector,
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
          borderBottom: "1px solid var(--ohmni-lab-border, #E2E4E9)",
          flex: "none",
          zIndex: 10,
        }}
      >
        {/* Left: Brand + Target Title */}
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div id="navbar-brand-wordmark" data-testid="navbar-brand-wordmark">
            <img
              src="/brand/ohmni-logo.svg"
              alt="OHMNI"
              style={{ height: "26px", width: "auto" }}
            />
          </div>

          <div style={{ height: "18px", width: "1px", background: "var(--ohmni-lab-border, #E2E4E9)" }} />

          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span
              style={{
                width: "7px",
                height: "7px",
                borderRadius: "50%",
                background: isReset
                  ? "var(--ohmni-lab-fault, #DC5050)"
                  : isConnected
                  ? "var(--ohmni-lab-verified, #27966B)"
                  : "var(--ohmni-lab-muted, #64748B)",
                boxShadow: isConnected && !isReset ? "0 0 8px rgba(39, 150, 107, 0.5)" : "none",
              }}
            />
            <span className="font-mono" style={{ fontSize: "13px", fontWeight: 700, color: "var(--ohmni-lab-text, #0F172A)" }}>
              {deviceName}
            </span>
          </div>
        </div>

        {/* Center: Sealed Ground Truth & WebMCP Mesh Status */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          {/* Sealed Fault Badge */}
          {activeScenario && (
            <span
              data-testid="sealed-fault-badge"
              title="The scenario state is held outside the model/tool context and is revealed only after verification."
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
                padding: "4px 10px",
                borderRadius: "var(--radius-full, 9999px)",
                background: activeScenario.isSealed ? "rgba(15, 23, 42, 0.05)" : "rgba(39, 150, 107, 0.1)",
                border: `1px solid ${activeScenario.isSealed ? "rgba(15, 23, 42, 0.15)" : "rgba(39, 150, 107, 0.3)"}`,
                color: activeScenario.isSealed ? "var(--ohmni-lab-secondary, #64748B)" : "var(--ohmni-lab-verified, #27966B)",
                fontSize: "11px",
                fontWeight: 700,
                cursor: "help",
              }}
            >
              <Lock size={12} />
              <span>{activeScenario.isSealed ? "SEALED FAULT" : "VERIFIED FAULT"}</span>
            </span>
          )}

          <span
            data-testid="webmcp-mode-badge"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "4px 12px",
              borderRadius: "var(--radius-full, 9999px)",
              background: isNative ? "rgba(39, 150, 107, 0.08)" : "rgba(18, 21, 26, 0.04)",
              border: `1px solid ${isNative ? "rgba(39, 150, 107, 0.25)" : "var(--ohmni-lab-border, #E2E4E9)"}`,
              color: isNative ? "var(--ohmni-lab-verified, #27966B)" : "var(--ohmni-lab-muted, #64748B)",
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
              borderRadius: "var(--radius-full, 9999px)",
              background: "rgba(73, 103, 255, 0.08)",
              border: "1px solid rgba(73, 103, 255, 0.25)",
              color: "var(--ohmni-lab-brand, #4967FF)",
              fontSize: "11px",
              fontWeight: 700,
            }}
          >
            <Bot size={12} />
            <span>BENCH AGENT</span>
          </span>
        </div>

        {/* Right: Technical Inspector & Connection Toggle */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          {onOpenDevInspector && (
            <button
              type="button"
              data-testid="open-dev-inspector-btn"
              onClick={onOpenDevInspector}
              className="btn-secondary"
              title="Developer Inspector [Cmd+Shift+D]"
              style={{
                padding: "6px 10px",
                fontSize: "12px",
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
              }}
            >
              <Terminal size={13} color="var(--ohmni-lab-brand, #4967FF)" />
              <span>Inspector</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setInspectorOpen(true)}
            className="btn-secondary"
            style={{
              padding: "6px 12px",
              fontSize: "12px",
            }}
          >
            <Radio size={13} color="var(--ohmni-lab-brand, #4967FF)" />
            <span>WebMCP Tools ({toolCount})</span>
          </button>

          {onToggleConnect && (
            <button
              type="button"
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
