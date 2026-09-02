/**
 * Mode 1 — Intro / Ready Experience Component.
 * Transforms Ohmni from an internal console into an instantly understandable product.
 * Hero narrative, animated Device ↔ Browser ↔ Agent SVG architecture, and 1-click CTA.
 */

import React from "react";
import { motion, useReducedMotion } from "motion/react";
import {
  Cpu,
  Activity,
  Bot,
  Zap,
  ShieldCheck,
  Search,
  CheckCircle2,
  ArrowRight,
  Radio,
  Sliders,
  Sparkles,
} from "lucide-react";

export interface IntroModeProps {
  readonly onStartDiagnosis: (goal?: string) => void;
  readonly onConnectHardware: () => void;
}

export const IntroMode: React.FC<IntroModeProps> = ({
  onStartDiagnosis,
  onConnectHardware,
}) => {
  const shouldReduceMotion = useReducedMotion();

  const handleStartVirtual = () => {
    onStartDiagnosis("This controller resets whenever the fan turns on. Find out why.");
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100vw",
        height: "100vh",
        background: "radial-gradient(ellipse at 50% 15%, rgba(79, 107, 255, 0.08) 0%, var(--ohmni-bg) 70%)",
        color: "var(--ohmni-text-primary)",
        overflowY: "auto",
        overflowX: "hidden",
      }}
    >
      {/* Top Header */}
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "1.25rem 2.5rem",
          borderBottom: "1px solid var(--ohmni-border-subtle)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <img
            src="/brand/ohmni-logo.svg"
            alt="OHMNI"
            style={{ height: "28px", width: "auto" }}
          />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "4px 10px",
              borderRadius: "var(--radius-full)",
              background: "rgba(79, 107, 255, 0.1)",
              border: "1px solid rgba(79, 107, 255, 0.25)",
              fontSize: "12px",
              fontWeight: 500,
              color: "var(--ohmni-brand-hover)",
            }}
          >
            <Radio size={12} />
            WebMCP Native Instrument Bus
          </span>
        </div>
      </header>

      {/* Main Hero Container */}
      <main
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "2rem 1.5rem 3rem",
          maxWidth: "1160px",
          margin: "0 auto",
          width: "100%",
          gap: "2.5rem",
        }}
      >
        {/* Headline & Subhead */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          style={{
            textAlign: "center",
            maxWidth: "760px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "1rem",
          }}
        >
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              padding: "4px 12px",
              borderRadius: "var(--radius-full)",
              background: "rgba(53, 198, 244, 0.08)",
              border: "1px solid rgba(53, 198, 244, 0.2)",
              fontSize: "12px",
              fontWeight: 600,
              color: "var(--ohmni-signal)",
              letterSpacing: "0.02em",
            }}
          >
            <Sparkles size={13} />
            AGENT-NATIVE HARDWARE DIAGNOSTICS
          </div>

          <h1 className="hero-heading" style={{ margin: 0 }}>
            Hardware debugging that{" "}
            <span
              style={{
                background: "linear-gradient(135deg, #35C6F4 0%, #4F6BFF 60%, #98A3B5 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              measures before it guesses.
            </span>
          </h1>

          <p
            className="body-text"
            style={{
              fontSize: "16px",
              lineHeight: 1.6,
              maxWidth: "680px",
              margin: 0,
              color: "var(--ohmni-text-secondary)",
            }}
          >
            Ohmni gives your AI agent safe, live diagnostic instruments inside the browser —
            so it can reproduce physical failures, record immutable evidence, and prove what actually happened.
          </p>

          {/* Action CTAs */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "14px",
              marginTop: "0.75rem",
              flexWrap: "wrap",
              justifyContent: "center",
            }}
          >
            <button
              onClick={handleStartVirtual}
              className="btn-primary"
              style={{
                padding: "12px 24px",
                fontSize: "15px",
                fontWeight: 600,
                borderRadius: "var(--radius-md)",
              }}
            >
              <Zap size={16} fill="currentColor" />
              Start Virtual Diagnosis
              <ArrowRight size={16} />
            </button>

            <button
              onClick={onConnectHardware}
              className="btn-secondary"
              style={{
                padding: "12px 20px",
                fontSize: "14px",
                borderRadius: "var(--radius-md)",
              }}
            >
              <Sliders size={15} />
              Connect Hardware
            </button>
          </div>
        </motion.div>

        {/* Animated Hero Architecture Visual */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          style={{
            width: "100%",
            maxWidth: "920px",
            background: "rgba(16, 22, 33, 0.7)",
            border: "1px solid var(--ohmni-border)",
            borderRadius: "var(--radius-xl)",
            padding: "1.75rem 2rem",
            position: "relative",
            backdropFilter: "blur(12px)",
            boxShadow: "0 16px 40px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(148, 163, 184, 0.05)",
          }}
        >
          {/* Top Label */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "1.25rem",
              paddingBottom: "0.75rem",
              borderBottom: "1px solid var(--ohmni-border-subtle)",
            }}
          >
            <span className="metadata-text" style={{ letterSpacing: "0.06em", textTransform: "uppercase" }}>
              LIVE ARCHITECTURE SYSTEM
            </span>
            <span
              className="font-mono"
              style={{
                fontSize: "11px",
                color: "var(--ohmni-signal)",
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
                  background: "var(--ohmni-signal)",
                  boxShadow: "0 0 8px var(--ohmni-signal)",
                }}
              />
              13 AGENT INSTRUMENTS READY
            </span>
          </div>

          {/* SVG Diagram Canvas */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr auto 1fr auto 1fr",
              alignItems: "center",
              gap: "16px",
              position: "relative",
            }}
          >
            {/* Node 1: Physical Device */}
            <div
              style={{
                background: "var(--ohmni-surface-raised)",
                border: "1px solid rgba(53, 198, 244, 0.3)",
                borderRadius: "var(--radius-lg)",
                padding: "1.25rem 1rem",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "8px",
                textAlign: "center",
                position: "relative",
                boxShadow: "0 4px 16px rgba(53, 198, 244, 0.08)",
              }}
            >
              <div
                style={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "var(--radius-md)",
                  background: "rgba(53, 198, 244, 0.12)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--ohmni-signal)",
                }}
              >
                <Cpu size={20} />
              </div>
              <div>
                <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--ohmni-text-primary)" }}>
                  Target Hardware
                </div>
                <div className="metadata-text">ESP32-S3 Controller</div>
              </div>
              <div
                style={{
                  fontSize: "11px",
                  padding: "2px 8px",
                  borderRadius: "var(--radius-sm)",
                  background: "rgba(53, 211, 154, 0.1)",
                  color: "var(--ohmni-success)",
                  fontWeight: 500,
                }}
              >
                3.3V / 5V Rails
              </div>
            </div>

            {/* Connector 1: Device ↔ Browser */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "6px", minWidth: "110px" }}>
              <div style={{ display: "flex", alignItems: "center", width: "100%", position: "relative" }}>
                <div
                  style={{
                    height: "2px",
                    width: "100%",
                    background: "linear-gradient(90deg, var(--ohmni-signal) 0%, var(--ohmni-brand) 100%)",
                    opacity: 0.6,
                  }}
                />
                {!shouldReduceMotion && (
                  <motion.div
                    animate={{ x: [0, 80, 0] }}
                    transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
                    style={{
                      position: "absolute",
                      width: "8px",
                      height: "8px",
                      borderRadius: "50%",
                      background: "var(--ohmni-signal)",
                      boxShadow: "0 0 8px var(--ohmni-signal)",
                    }}
                  />
                )}
              </div>
              <span className="font-mono" style={{ fontSize: "10px", color: "var(--ohmni-text-muted)" }}>
                Telemetry & Control
              </span>
            </div>

            {/* Node 2: OHMNI Platform / WebMCP */}
            <div
              style={{
                background: "var(--ohmni-surface-raised)",
                border: "1px solid rgba(79, 107, 255, 0.35)",
                borderRadius: "var(--radius-lg)",
                padding: "1.25rem 1rem",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "8px",
                textAlign: "center",
                position: "relative",
                boxShadow: "0 4px 20px rgba(79, 107, 255, 0.12)",
              }}
            >
              <div
                style={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "var(--radius-md)",
                  background: "rgba(79, 107, 255, 0.15)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--ohmni-brand-hover)",
                }}
              >
                <Activity size={20} />
              </div>
              <div>
                <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--ohmni-text-primary)" }}>
                  OHMNI Workbench
                </div>
                <div className="metadata-text">Native WebMCP Bus</div>
              </div>
              <div
                style={{
                  fontSize: "11px",
                  padding: "2px 8px",
                  borderRadius: "var(--radius-sm)",
                  background: "rgba(79, 107, 255, 0.12)",
                  color: "var(--ohmni-brand-hover)",
                  fontWeight: 500,
                }}
              >
                60fps Live Scope
              </div>
            </div>

            {/* Connector 2: Browser ↔ Agent */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "6px", minWidth: "110px" }}>
              <div style={{ display: "flex", alignItems: "center", width: "100%", position: "relative" }}>
                <div
                  style={{
                    height: "2px",
                    width: "100%",
                    background: "linear-gradient(90deg, var(--ohmni-brand) 0%, #A855F7 100%)",
                    opacity: 0.6,
                  }}
                />
                {!shouldReduceMotion && (
                  <motion.div
                    animate={{ x: [80, 0, 80] }}
                    transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
                    style={{
                      position: "absolute",
                      width: "8px",
                      height: "8px",
                      borderRadius: "50%",
                      background: "var(--ohmni-brand-hover)",
                      boxShadow: "0 0 8px var(--ohmni-brand-hover)",
                    }}
                  />
                )}
              </div>
              <span className="font-mono" style={{ fontSize: "10px", color: "var(--ohmni-text-muted)" }}>
                Tool RPC Calls
              </span>
            </div>

            {/* Node 3: Bench Agent */}
            <div
              style={{
                background: "var(--ohmni-surface-raised)",
                border: "1px solid rgba(168, 85, 247, 0.35)",
                borderRadius: "var(--radius-lg)",
                padding: "1.25rem 1rem",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "8px",
                textAlign: "center",
                position: "relative",
                boxShadow: "0 4px 16px rgba(168, 85, 247, 0.08)",
              }}
            >
              <div
                style={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "var(--radius-md)",
                  background: "rgba(168, 85, 247, 0.12)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#C084FC",
                }}
              >
                <Bot size={20} />
              </div>
              <div>
                <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--ohmni-text-primary)" }}>
                  Diagnostic Agent
                </div>
                <div className="metadata-text">Autonomous Reasoner</div>
              </div>
              <div
                style={{
                  fontSize: "11px",
                  padding: "2px 8px",
                  borderRadius: "var(--radius-sm)",
                  background: "rgba(168, 85, 247, 0.1)",
                  color: "#C084FC",
                  fontWeight: 500,
                }}
              >
                Evidence-Grounded
              </div>
            </div>
          </div>
        </motion.div>

        {/* 3 Step Narrative Cards */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: "1.25rem",
            width: "100%",
          }}
        >
          {/* Step 1 */}
          <div
            style={{
              background: "var(--ohmni-surface)",
              border: "1px solid var(--ohmni-border)",
              borderRadius: "var(--radius-lg)",
              padding: "1.25rem",
              display: "flex",
              flexDirection: "column",
              gap: "8px",
            }}
          >
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: "28px",
                height: "28px",
                borderRadius: "var(--radius-sm)",
                background: "rgba(53, 198, 244, 0.1)",
                color: "var(--ohmni-signal)",
                fontWeight: 700,
                fontSize: "12px",
              }}
            >
              1
            </div>
            <div style={{ fontSize: "15px", fontWeight: 600, color: "var(--ohmni-text-primary)" }}>
              Connect & Guardrail
            </div>
            <p className="body-text" style={{ fontSize: "13px", margin: 0 }}>
              Human grants access to the device. Dangerous physical actions require explicit approval.
            </p>
          </div>

          {/* Step 2 */}
          <div
            style={{
              background: "var(--ohmni-surface)",
              border: "1px solid var(--ohmni-border)",
              borderRadius: "var(--radius-lg)",
              padding: "1.25rem",
              display: "flex",
              flexDirection: "column",
              gap: "8px",
            }}
          >
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: "28px",
                height: "28px",
                borderRadius: "var(--radius-sm)",
                background: "rgba(79, 107, 255, 0.1)",
                color: "var(--ohmni-brand-hover)",
                fontWeight: 700,
                fontSize: "12px",
              }}
            >
              2
            </div>
            <div style={{ fontSize: "15px", fontWeight: 600, color: "var(--ohmni-text-primary)" }}>
              Measure & Stress Test
            </div>
            <p className="body-text" style={{ fontSize: "13px", margin: 0 }}>
              Agent executes live WebMCP instruments: reads reset history, measures rail voltage, and isolates faults.
            </p>
          </div>

          {/* Step 3 */}
          <div
            style={{
              background: "var(--ohmni-surface)",
              border: "1px solid var(--ohmni-border)",
              borderRadius: "var(--radius-lg)",
              padding: "1.25rem",
              display: "flex",
              flexDirection: "column",
              gap: "8px",
            }}
          >
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: "28px",
                height: "28px",
                borderRadius: "var(--radius-sm)",
                background: "rgba(53, 211, 154, 0.1)",
                color: "var(--ohmni-success)",
                fontWeight: 700,
                fontSize: "12px",
              }}
            >
              3
            </div>
            <div style={{ fontSize: "15px", fontWeight: 600, color: "var(--ohmni-text-primary)" }}>
              Prove with Evidence
            </div>
            <p className="body-text" style={{ fontSize: "13px", margin: 0 }}>
              Every hypothesis cites immutable measurement tokens. The agent verifies empirical truth.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
};
