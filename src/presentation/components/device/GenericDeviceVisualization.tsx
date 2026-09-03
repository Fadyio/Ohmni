/**
 * Generic Physical Hardware Visualization.
 *
 * Truthful, descriptor-driven visualization for real devices connected over Web Serial.
 * Does NOT fabricate a fake PCB schematic.
 * Instead, renders:
 * 1. Physical Hardware Identity & Firmware Metadata
 * 2. Live Signal Readouts (Telemetry Bus & MCU Rails)
 * 3. Discovered WebMCP Instrument Taxonomy (OBSERVE vs TEST vs ACTUATE)
 */

import React from "react";
import {
  Cpu,
  Radio,
  Zap,
  Activity,
  ShieldCheck,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  Lock,
} from "lucide-react";
import type { DeviceDescriptor } from "@/domain/device/descriptor";

export interface GenericDeviceVisualizationProps {
  readonly descriptor?: DeviceDescriptor | null;
  readonly isConnected: boolean;
  readonly relayState: "open" | "closed";
  readonly railVoltage: number;
  readonly resetCount: number;
  readonly statusVisual: "nominal" | "reset" | "disconnected";
  readonly activeCapabilityName?: string;
  readonly isActuating?: boolean;
}

export const GenericDeviceVisualization: React.FC<GenericDeviceVisualizationProps> = ({
  descriptor,
  isConnected,
  relayState,
  railVoltage,
  resetCount,
  statusVisual,
  activeCapabilityName,
  isActuating,
}) => {
  const deviceName = descriptor?.name ?? "Physical Hardware Node";
  const firmwareVersion = descriptor?.firmwareVersion ?? "1.0.0";
  const manufacturer = descriptor?.manufacturer ?? "Microcontroller";
  const model = descriptor?.model ?? descriptor?.id ?? "Serial Device";
  const transport = descriptor?.transport ?? "Web Serial";
  const capabilities = descriptor?.capabilities ?? [];

  const greenCapabilities = capabilities.filter((c) => c.safety === "green");
  const amberCapabilities = capabilities.filter((c) => c.safety === "amber");

  return (
    <div
      data-testid="generic-device-visualization"
      style={{
        width: "100%",
        display: "flex",
        flexDirection: "column",
        gap: "1.25rem",
        padding: "1.25rem",
        boxSizing: "border-box",
        background: "#FFFFFF",
        borderRadius: "var(--radius-lg, 12px)",
        border: "1px solid var(--ohmni-lab-border, #E2E4E9)",
      }}
    >
      {/* 1. Device Identity Header Banner */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          paddingBottom: "1rem",
          borderBottom: "1px solid var(--ohmni-lab-border, #E2E4E9)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div
            style={{
              width: "40px",
              height: "40px",
              borderRadius: "8px",
              background: "rgba(73, 103, 255, 0.08)",
              border: "1px solid rgba(73, 103, 255, 0.2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--ohmni-lab-brand, #4967FF)",
            }}
          >
            <Cpu size={22} />
          </div>

          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <h3
                style={{
                  margin: 0,
                  fontSize: "16px",
                  fontWeight: 800,
                  color: "var(--ohmni-lab-text, #0F172A)",
                }}
              >
                {deviceName}
              </h3>
              <span
                style={{
                  padding: "2px 7px",
                  borderRadius: "4px",
                  fontSize: "10.5px",
                  fontFamily: "var(--font-mono)",
                  fontWeight: 700,
                  background: isConnected ? "rgba(39, 150, 107, 0.1)" : "rgba(100, 116, 139, 0.1)",
                  color: isConnected ? "var(--ohmni-lab-verified, #27966B)" : "#64748B",
                  border: isConnected
                    ? "1px solid rgba(39, 150, 107, 0.3)"
                    : "1px solid rgba(100, 116, 139, 0.3)",
                }}
              >
                {isConnected ? "CONNECTED • 115200 BAUD" : "DISCONNECTED"}
              </span>
            </div>

            <div
              style={{
                fontSize: "12px",
                color: "var(--ohmni-lab-muted, #64748B)",
                marginTop: "2px",
                fontFamily: "var(--font-mono)",
              }}
            >
              {manufacturer} • {model} • Firmware v{firmwareVersion} • {transport}
            </div>
          </div>
        </div>

        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--ohmni-lab-muted, #64748B)" }}>
            DISCOVERED WEBMCP TOOLS
          </div>
          <div
            style={{
              fontSize: "18px",
              fontWeight: 800,
              fontFamily: "var(--font-mono)",
              color: "var(--ohmni-lab-brand, #4967FF)",
            }}
          >
            {capabilities.length} active
          </div>
        </div>
      </div>

      {/* 2. Live Telemetry Signals Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: "0.75rem",
        }}
      >
        {/* Signal Card: Supply Rail Voltage */}
        <div
          style={{
            padding: "0.85rem",
            borderRadius: "8px",
            background: "#F8FAFC",
            border:
              railVoltage < 2.8
                ? "1px solid rgba(239, 68, 68, 0.4)"
                : "1px solid var(--ohmni-lab-border, #E2E4E9)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: "11px", fontWeight: 600, color: "#64748B" }}>SUPPLY RAIL</span>
            <Activity size={13} color={railVoltage < 2.8 ? "#EF4444" : "#27966B"} />
          </div>
          <div
            style={{
              fontSize: "19px",
              fontWeight: 800,
              fontFamily: "var(--font-mono)",
              marginTop: "4px",
              color: railVoltage < 2.8 ? "#EF4444" : "var(--ohmni-lab-text, #0F172A)",
            }}
          >
            {isConnected ? `${railVoltage.toFixed(2)} V` : "—"}
          </div>
          <div style={{ fontSize: "10px", color: "#64748B", marginTop: "2px" }}>
            {railVoltage >= 2.8 ? "Nominal operating rail" : "Brownout threshold crossing"}
          </div>
        </div>

        {/* Signal Card: Actuator Relay */}
        <div
          style={{
            padding: "0.85rem",
            borderRadius: "8px",
            background: "#F8FAFC",
            border:
              relayState === "closed"
                ? "1px solid rgba(245, 158, 11, 0.5)"
                : "1px solid var(--ohmni-lab-border, #E2E4E9)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: "11px", fontWeight: 600, color: "#64748B" }}>ACTUATOR STATE</span>
            <Zap size={13} color={relayState === "closed" ? "#F59E0B" : "#64748B"} />
          </div>
          <div
            style={{
              fontSize: "17px",
              fontWeight: 800,
              fontFamily: "var(--font-mono)",
              marginTop: "4px",
              color: relayState === "closed" ? "#D97706" : "var(--ohmni-lab-text, #0F172A)",
            }}
          >
            {isConnected ? (relayState === "closed" ? "ENERGIZED" : "SAFE / OPEN") : "—"}
          </div>
          <div style={{ fontSize: "10px", color: "#64748B", marginTop: "2px" }}>
            {relayState === "closed" ? "Coil active under load" : "Inert de-energized contact"}
          </div>
        </div>

        {/* Signal Card: System Resets */}
        <div
          style={{
            padding: "0.85rem",
            borderRadius: "8px",
            background: "#F8FAFC",
            border:
              resetCount > 0
                ? "1px solid rgba(239, 68, 68, 0.3)"
                : "1px solid var(--ohmni-lab-border, #E2E4E9)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: "11px", fontWeight: 600, color: "#64748B" }}>DETECTED RESETS</span>
            <AlertTriangle size={13} color={resetCount > 0 ? "#EF4444" : "#64748B"} />
          </div>
          <div
            style={{
              fontSize: "19px",
              fontWeight: 800,
              fontFamily: "var(--font-mono)",
              marginTop: "4px",
              color: resetCount > 0 ? "#EF4444" : "var(--ohmni-lab-text, #0F172A)",
            }}
          >
            {isConnected ? resetCount : "—"}
          </div>
          <div style={{ fontSize: "10px", color: "#64748B", marginTop: "2px" }}>
            {resetCount === 0 ? "Zero unexpected boots" : "MCU reset log entries captured"}
          </div>
        </div>

        {/* Signal Card: Protocol Channel */}
        <div
          style={{
            padding: "0.85rem",
            borderRadius: "8px",
            background: "#F8FAFC",
            border: "1px solid var(--ohmni-lab-border, #E2E4E9)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: "11px", fontWeight: 600, color: "#64748B" }}>NDJSON PROTOCOL</span>
            <Radio size={13} color="#4967FF" />
          </div>
          <div
            style={{
              fontSize: "17px",
              fontWeight: 800,
              fontFamily: "var(--font-mono)",
              marginTop: "4px",
              color: "var(--ohmni-lab-text, #0F172A)",
            }}
          >
            v1 STREAM
          </div>
          <div style={{ fontSize: "10px", color: "#64748B", marginTop: "2px" }}>
            Chunked telemetry & correlated RPC
          </div>
        </div>
      </div>

      {/* 3. Discovered WebMCP Capability Taxonomy */}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginTop: "0.25rem" }}>
        <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--ohmni-lab-text, #0F172A)" }}>
          DISCOVERED INSTRUMENT SURFACE (WEBMCP)
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
          {/* Green Observational Tools */}
          <div
            style={{
              padding: "0.75rem",
              borderRadius: "8px",
              background: "#F8FAFC",
              border: "1px solid var(--ohmni-lab-border, #E2E4E9)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                marginBottom: "0.5rem",
                color: "var(--ohmni-lab-verified, #27966B)",
                fontSize: "11.5px",
                fontWeight: 700,
              }}
            >
              <CheckCircle2 size={14} />
              <span>OBSERVE — Read-Only Autonomous Instruments ({greenCapabilities.length})</span>
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
              {greenCapabilities.map((cap) => (
                <div
                  key={cap.name}
                  style={{
                    padding: "4px 8px",
                    borderRadius: "4px",
                    background: "#FFFFFF",
                    border: "1px solid #E2E8F0",
                    fontSize: "11.5px",
                    fontFamily: "var(--font-mono)",
                    color: "#334155",
                    display: "flex",
                    alignItems: "center",
                    gap: "5px",
                  }}
                >
                  <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#27966B" }} />
                  <span>{cap.name}</span>
                </div>
              ))}
              {greenCapabilities.length === 0 && (
                <span style={{ fontSize: "11px", color: "#94A3B8" }}>No green capabilities reported</span>
              )}
            </div>
          </div>

          {/* Amber Actuation Tools */}
          <div
            style={{
              padding: "0.75rem",
              borderRadius: "8px",
              background: "#F8FAFC",
              border: "1px solid var(--ohmni-lab-border, #E2E4E9)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                marginBottom: "0.5rem",
                color: "#D97706",
                fontSize: "11.5px",
                fontWeight: 700,
              }}
            >
              <Lock size={14} />
              <span>TEST & ACTUATE — Human-Gated Actuation ({amberCapabilities.length})</span>
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
              {amberCapabilities.map((cap) => (
                <div
                  key={cap.name}
                  style={{
                    padding: "4px 8px",
                    borderRadius: "4px",
                    background: "#FFFFFF",
                    border: "1px solid #E2E8F0",
                    fontSize: "11.5px",
                    fontFamily: "var(--font-mono)",
                    color: "#334155",
                    display: "flex",
                    alignItems: "center",
                    gap: "5px",
                  }}
                >
                  <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#F59E0B" }} />
                  <span>{cap.name}</span>
                </div>
              ))}
              {amberCapabilities.length === 0 && (
                <span style={{ fontSize: "11px", color: "#94A3B8" }}>No amber actuation tools declared</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
