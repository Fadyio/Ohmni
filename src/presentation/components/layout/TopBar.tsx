/**
 * Top Status Bar Component.
 * Displays brand identity, contextual target hardware metadata,
 * real-time device connection status, and dynamic WebMCP tool count.
 */

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import type { DeviceDescriptor } from "@/domain/device/descriptor";
import { useWebMCPTools } from "../../hooks/useWebMCPTools";
import { WebMCPCapabilityDrawer } from "./WebMCPCapabilityDrawer";
import { microTransition, faultFlashVariants } from "../motion/transitions";

interface TopBarProps {
  readonly isConnected: boolean;
  readonly descriptor: DeviceDescriptor | null;
  readonly statusVisual: "nominal" | "reset" | "disconnected";
}

export const TopBar: React.FC<TopBarProps> = ({
  isConnected,
  descriptor,
  statusVisual,
}) => {
  const { tools, toolCount, isNative, isDiscovering } = useWebMCPTools();
  const [drawerOpen, setDrawerOpen] = useState<boolean>(false);

  // Automatically open capability drawer briefly when discovery starts to highlight tool surface materialization
  useEffect(() => {
    if (isDiscovering) {
      setDrawerOpen(true);
    }
  }, [isDiscovering]);

  const firmwareVersion = descriptor?.firmwareVersion ?? (isConnected ? "2.4.1" : "--");
  const deviceName = descriptor?.name ?? (isConnected ? "ESP32-S3 Environmental Controller" : "No Target Attached");

  return (
    <header
      style={{
        height: "56px",
        background: "var(--ohmni-surface)",
        borderBottom: "1px solid var(--ohmni-border)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 1.25rem",
        position: "relative",
        zIndex: 50,
      }}
    >
      {/* Left: Brand Identity */}
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "30px",
            height: "30px",
            borderRadius: "var(--radius-sm)",
            background: "var(--ohmni-surface-raised)",
            border: "1px solid var(--ohmni-border)",
            color: "var(--ohmni-accent)",
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 12h5l3-9 4 18 3-9h5" />
          </svg>
        </div>
        <div>
          <div
            style={{
              fontSize: "0.9375rem",
              fontWeight: 700,
              letterSpacing: "0.08em",
              color: "var(--ohmni-text-primary)",
              lineHeight: 1.1,
            }}
          >
            OHMNI
          </div>
          <div
            className="label-technical"
            style={{
              fontSize: "0.625rem",
              color: "var(--ohmni-text-muted)",
              marginTop: "2px",
            }}
          >
            Hardware Investigation Workbench
          </div>
        </div>
      </div>

      {/* Center: Contextual Target Info */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          background: "var(--ohmni-surface-raised)",
          padding: "4px 12px",
          borderRadius: "var(--radius-full)",
          border: "1px solid var(--ohmni-border-subtle)",
        }}
      >
        <span
          style={{
            fontSize: "0.75rem",
            fontWeight: 500,
            color: isConnected ? "var(--ohmni-text-primary)" : "var(--ohmni-text-muted)",
          }}
        >
          {deviceName}
        </span>
        {isConnected && (
          <>
            <span style={{ color: "var(--ohmni-border)" }}>•</span>
            <span
              className="font-mono"
              style={{
                fontSize: "0.6875rem",
                color: "var(--ohmni-text-secondary)",
              }}
            >
              FW {firmwareVersion}
            </span>
          </>
        )}
      </div>

      {/* Right: Telemetry & WebMCP Status */}
      <div style={{ display: "flex", alignItems: "center", gap: "10px", position: "relative" }}>
        {/* WebMCP Compatibility Badge */}
        <span
          className="font-mono"
          style={{
            fontSize: "0.625rem",
            padding: "3px 7px",
            borderRadius: "var(--radius-sm)",
            background: isNative ? "rgba(16, 185, 129, 0.1)" : "rgba(56, 189, 248, 0.1)",
            color: isNative ? "var(--ohmni-success)" : "var(--ohmni-accent)",
            border: `1px solid ${isNative ? "rgba(16, 185, 129, 0.25)" : "rgba(56, 189, 248, 0.25)"}`,
            letterSpacing: "0.04em",
          }}
          title={isNative ? "Chrome native document.modelContext active" : "Standard WebMCP in-memory context active"}
        >
          {isNative ? "WEBMCP NATIVE" : "WEBMCP COMPAT"}
        </span>

        {/* Device Online Status Badge */}
        <motion.div
          variants={faultFlashVariants}
          animate={statusVisual}
          transition={microTransition}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            padding: "3px 8px",
            borderRadius: "var(--radius-sm)",
            border: "1px solid transparent",
            fontSize: "0.6875rem",
            fontWeight: 600,
            letterSpacing: "0.04em",
          }}
        >
          <span
            style={{
              width: "6px",
              height: "6px",
              borderRadius: "50%",
              background:
                statusVisual === "reset"
                  ? "var(--ohmni-fault)"
                  : statusVisual === "nominal"
                  ? "var(--ohmni-success)"
                  : "var(--ohmni-text-muted)",
              boxShadow:
                statusVisual === "reset"
                  ? "0 0 8px var(--ohmni-fault)"
                  : statusVisual === "nominal"
                  ? "0 0 8px var(--ohmni-success)"
                  : "none",
            }}
          />
          <span className="font-mono">
            {statusVisual === "reset"
              ? "RESET OCCURRED"
              : isConnected
              ? "DEVICE ONLINE"
              : "NO DEVICE"}
          </span>
        </motion.div>

        {/* Dynamic WebMCP Tool Counter Button */}
        <button
          onClick={() => setDrawerOpen((prev) => !prev)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            padding: "4px 10px",
            background: drawerOpen ? "var(--ohmni-surface-overlay)" : "var(--ohmni-surface-raised)",
            border: `1px solid ${drawerOpen ? "var(--ohmni-border-focus)" : "var(--ohmni-border)"}`,
            borderRadius: "var(--radius-sm)",
            color: "var(--ohmni-text-primary)",
            cursor: "pointer",
            fontSize: "0.6875rem",
            fontWeight: 500,
            transition: "all var(--duration-micro) var(--ease-workbench)",
          }}
          aria-expanded={drawerOpen}
          aria-label="Toggle WebMCP Capabilities Drawer"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
            <line x1="8" y1="21" x2="16" y2="21" />
            <line x1="12" y1="17" x2="12" y2="21" />
          </svg>
          <span className="font-mono">
            WEBMCP {toolCount} {toolCount === 1 ? "TOOL" : "TOOLS"}
          </span>
          <svg
            width="10"
            height="10"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            style={{
              transform: drawerOpen ? "rotate(180deg)" : "rotate(0deg)",
              transition: "transform var(--duration-micro)",
            }}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>

        {/* Staggered Capability Drawer */}
        <WebMCPCapabilityDrawer
          isOpen={drawerOpen}
          tools={tools}
          isDiscovering={isDiscovering}
          isNative={isNative}
          onClose={() => setDrawerOpen(false)}
        />
      </div>
    </header>
  );
};
