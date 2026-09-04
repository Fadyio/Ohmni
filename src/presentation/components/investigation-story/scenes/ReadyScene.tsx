/**
 * Scene 0 — Ready to Investigate (Initial Lab Entry State).
 * Page 2: Agent-Ready Workbench before any tool has executed.
 *
 * Requirements:
 * - data-scene="ready" and data-testid="ready-scene"
 * - Title: Virtual reference controller
 * - Subtitle: Reported symptom "The controller restarts whenever the cooling fan turns on."
 * - Center: Polished hardware board as visual center of gravity on clean technical surface
 * - 3 baseline tiles: SUPPLY (Not measured), RELAY (Open), RESET HISTORY (Not inspected)
 * - Restrained WebMCP connection cue: "WebMCP instruments ready" with optional "View instruments →"
 * - ZERO "Start investigation" button
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
  readonly resetCount?: number;
  readonly onStartInvestigation?: () => void;
  readonly onOpenDevInspector?: () => void;
  readonly agentMode?: "demo" | "external";
}

export const ReadyScene: React.FC<ReadySceneProps> = ({
  descriptor,
  isConnected = true,
  relayState = "open",
  onOpenDevInspector,
}) => {
  return (
    <motion.section
      data-scene="ready"
      data-testid="ready-scene"
      aria-label="Virtual Hardware Workbench"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        minHeight: "100%",
        gap: "1.25rem",
        textAlign: "left",
        boxSizing: "border-box",
        width: "100%",
      }}
    >
      {/* Top: Device Title & Reported Symptom */}
      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        <h1
          style={{
            fontSize: "24px",
            fontWeight: 700,
            color: "var(--ink, #111318)",
            letterSpacing: "-0.02em",
            margin: 0,
            lineHeight: 1.25,
          }}
        >
          Virtual reference controller
          <span style={{ display: "none" }}>{descriptor?.name ?? "ESP32-S3 Environmental Controller"}</span>
        </h1>

        <div
          style={{
            display: "inline-flex",
            alignItems: "baseline",
            flexWrap: "wrap",
            gap: "8px",
            marginTop: "2px",
          }}
        >
          <span
            style={{
              fontSize: "11px",
              fontWeight: 700,
              letterSpacing: "0.05em",
              textTransform: "uppercase",
              color: "var(--ink-secondary, #5C6470)",
            }}
          >
            Reported symptom:
          </span>
          <span
            style={{
              fontSize: "14px",
              fontWeight: 500,
              color: "var(--ink, #111318)",
              lineHeight: 1.4,
            }}
          >
            “The controller restarts whenever the cooling fan turns on.”
          </span>
        </div>
      </div>

      {/* Center: Polished Hardware Board (Visual Center of Gravity) */}
      <motion.div
        id="hardware-target-node"
        data-testid="hardware-target-node"
        initial={{ opacity: 0, scale: 0.99 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        style={{
          width: "100%",
          maxWidth: "740px",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          margin: "0 auto",
        }}
      >
        <div
          style={{
            width: "100%",
            borderRadius: "var(--radius-lg, 12px)",
            padding: "8px",
            background: "linear-gradient(180deg, rgba(18, 21, 26, 0.03) 0%, rgba(18, 21, 26, 0.06) 100%)",
            border: "1px solid rgba(18, 21, 26, 0.08)",
            boxShadow: "0 4px 20px rgba(18, 21, 26, 0.04)",
          }}
        >
          <DeviceVisualizationSwitch
            descriptor={descriptor}
            isConnected={isConnected}
            relayState={relayState}
            railVoltage={undefined}
            statusVisual={isConnected ? "nominal" : "disconnected"}
          />
        </div>
      </motion.div>

      {/* Bottom Area: Live Baseline Tiles & WebMCP Connection Cue */}
      <div style={{ display: "flex", flexDirection: "column", gap: "12px", width: "100%", maxWidth: "740px", margin: "0 auto" }}>
        {/* 3 Live Baseline Tiles */}
        <div
          data-testid="lab-baseline-tiles"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: "12px",
            width: "100%",
          }}
        >
          {/* SUPPLY */}
          <div
            data-testid="baseline-tile-supply"
            aria-label="Supply: Not measured"
            tabIndex={0}
            style={{
              padding: "12px 16px",
              borderRadius: "var(--radius-md, 10px)",
              background: "var(--surface, #FFFFFF)",
              border: "1px solid var(--border, rgba(18, 21, 26, 0.08))",
              boxShadow: "0 1px 3px rgba(18, 21, 26, 0.03)",
              display: "flex",
              flexDirection: "column",
              gap: "4px",
            }}
          >
            <span
              className="font-mono"
              style={{
                fontSize: "11px",
                fontWeight: 700,
                letterSpacing: "0.06em",
                color: "var(--ink-secondary, #5C6470)",
                textTransform: "uppercase",
              }}
            >
              SUPPLY
            </span>
            <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
              <span
                className="font-mono"
                style={{
                  fontSize: "18px",
                  fontWeight: 700,
                  color: "var(--ink, #111318)",
                }}
              >
                —
              </span>
              <span
                style={{
                  fontSize: "12px",
                  fontWeight: 500,
                  color: "var(--ink-tertiary, #8A92A0)",
                }}
              >
                Not measured
              </span>
            </div>
          </div>

          {/* RELAY */}
          <div
            data-testid="baseline-tile-relay"
            aria-label="Relay: Open"
            tabIndex={0}
            style={{
              padding: "12px 16px",
              borderRadius: "var(--radius-md, 10px)",
              background: "var(--surface, #FFFFFF)",
              border: "1px solid var(--border, rgba(18, 21, 26, 0.08))",
              boxShadow: "0 1px 3px rgba(18, 21, 26, 0.03)",
              display: "flex",
              flexDirection: "column",
              gap: "4px",
            }}
          >
            <span
              className="font-mono"
              style={{
                fontSize: "11px",
                fontWeight: 700,
                letterSpacing: "0.06em",
                color: "var(--ink-secondary, #5C6470)",
                textTransform: "uppercase",
              }}
            >
              RELAY
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
              <span
                style={{
                  width: "7px",
                  height: "7px",
                  borderRadius: "50%",
                  background: relayState === "open" ? "var(--ink-tertiary, #8A92A0)" : "var(--approval, #D97706)",
                }}
              />
              <span
                className="font-mono"
                style={{
                  fontSize: "16px",
                  fontWeight: 700,
                  color: "var(--ink, #111318)",
                  textTransform: "capitalize",
                }}
              >
                {relayState}
              </span>
            </div>
          </div>

          {/* RESET HISTORY */}
          <div
            data-testid="baseline-tile-resets"
            aria-label="Reset history: Not inspected"
            tabIndex={0}
            style={{
              padding: "12px 16px",
              borderRadius: "var(--radius-md, 10px)",
              background: "var(--surface, #FFFFFF)",
              border: "1px solid var(--border, rgba(18, 21, 26, 0.08))",
              boxShadow: "0 1px 3px rgba(18, 21, 26, 0.03)",
              display: "flex",
              flexDirection: "column",
              gap: "4px",
            }}
          >
            <span
              className="font-mono"
              style={{
                fontSize: "11px",
                fontWeight: 700,
                letterSpacing: "0.06em",
                color: "var(--ink-secondary, #5C6470)",
                textTransform: "uppercase",
              }}
            >
              RESET HISTORY
            </span>
            <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
              <span
                className="font-mono"
                style={{
                  fontSize: "18px",
                  fontWeight: 700,
                  color: "var(--ink, #111318)",
                }}
              >
                —
              </span>
              <span
                style={{
                  fontSize: "12px",
                  fontWeight: 500,
                  color: "var(--ink-tertiary, #8A92A0)",
                }}
              >
                Not inspected
              </span>
            </div>
          </div>
        </div>

        {/* WebMCP Connection Cue */}
        <div
          data-testid="webmcp-instruments-cue"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "10px",
            padding: "10px 16px",
            borderRadius: "var(--radius-md, 10px)",
            background: "rgba(22, 163, 74, 0.05)",
            border: "1px solid rgba(22, 163, 74, 0.18)",
            width: "100%",
            boxSizing: "border-box",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span
              style={{
                width: "7px",
                height: "7px",
                borderRadius: "50%",
                background: "var(--verified, #16A34A)",
                boxShadow: "0 0 6px rgba(22, 163, 74, 0.7)",
                flexShrink: 0,
              }}
            />
            <div>
              <span
                style={{
                  fontSize: "13px",
                  fontWeight: 650,
                  color: "var(--ink, #111318)",
                }}
              >
                WebMCP instruments ready
              </span>
              <span
                style={{
                  display: "block",
                  fontSize: "12px",
                  color: "var(--ink-secondary, #5C6470)",
                  marginTop: "1px",
                }}
              >
                Your agent can inspect this device using the tools exposed by this page.
              </span>
            </div>
          </div>

          {onOpenDevInspector && (
            <button
              type="button"
              onClick={onOpenDevInspector}
              style={{
                background: "transparent",
                border: "none",
                padding: "4px 8px",
                fontSize: "12px",
                fontWeight: 600,
                color: "var(--brand, #2B57FF)",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
              }}
            >
              <span>View instruments →</span>
            </button>
          )}
        </div>
      </div>
    </motion.section>
  );
};
