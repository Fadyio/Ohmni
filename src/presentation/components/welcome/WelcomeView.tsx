/**
 * State 1 — Full-Screen Welcome Experience for OHMNI.
 * Displays the clean, expressive product landing narrative:
 * - Brand header with OHMNI logo
 * - "Your AI can debug code. Now it can debug hardware."
 * - "Ohmni gives an AI agent safe instruments to measure, test, and verify the device on your desk."
 * - [ Diagnose the demo device ] and [ Connect hardware ] CTAs
 * - Credibility row: Native WebMCP • Human-controlled tests • Evidence-backed diagnosis
 * - Authored animated hardware board illustration on the right
 */

import React from "react";
import { motion } from "motion/react";
import { Zap, Sliders, ShieldCheck, Sparkles, Layers, Cpu, ArrowRight } from "lucide-react";
import { AuthoredHardwareIllustration } from "./AuthoredHardwareIllustration";

export interface WelcomeViewProps {
  readonly onStartDemo: () => void;
  readonly onConnectHardware: () => void;
}

export const WelcomeView: React.FC<WelcomeViewProps> = ({
  onStartDemo,
  onConnectHardware,
}) => {
  return (
    <div
      style={{
        width: "100%",
        maxWidth: "100vw",
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        background: "var(--ohmni-canvas)",
        color: "var(--ohmni-ink)",
        overflowY: "auto",
        overflowX: "hidden",
        position: "relative",
        boxSizing: "border-box",
      }}
    >
      {/* Top Header */}
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "1.25rem 2rem",
          borderBottom: "1px solid var(--ohmni-border-subtle)",
          boxSizing: "border-box",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <img
            src="/brand/ohmni-logo.svg"
            alt="OHMNI"
            style={{ height: "30px", width: "auto" }}
          />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "4px 12px",
              borderRadius: "var(--radius-full)",
              background: "var(--ohmni-surface)",
              border: "1px solid var(--ohmni-border)",
              fontSize: "13px",
              fontWeight: 600,
              color: "var(--ohmni-ink)",
              boxShadow: "var(--shadow-sm)",
            }}
          >
            <span
              style={{
                width: "7px",
                height: "7px",
                borderRadius: "50%",
                background: "var(--ohmni-brand)",
              }}
            />
            WebMCP Instrument Mesh
          </span>
        </div>
      </header>

      {/* Main Hero Grid */}
      <main
        style={{
          flex: 1,
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.1fr) minmax(0, 1fr)",
          alignItems: "center",
          gap: "2.5rem",
          maxWidth: "1120px",
          margin: "0 auto",
          padding: "2rem 1.5rem 3rem",
          width: "100%",
          boxSizing: "border-box",
        }}
      >
        {/* Left Narrative Column */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "1.5rem",
          }}
        >
          {/* Expressive Headline */}
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                fontSize: "13px",
                fontWeight: 700,
                color: "var(--ohmni-brand)",
                letterSpacing: "0.04em",
                textTransform: "uppercase",
              }}
            >
              <Sparkles size={14} />
              Hardware Diagnostic Agent
            </div>

            <h1
              className="hero-heading"
              style={{
                margin: 0,
              }}
            >
              Your AI can debug code.
              <br />
              <span style={{ color: "var(--ohmni-brand)" }}>
                Now it can debug hardware.
              </span>
            </h1>
          </div>

          <p
            className="body-text"
            style={{
              fontSize: "16.5px",
              lineHeight: 1.6,
              maxWidth: "500px",
              margin: 0,
            }}
          >
            Ohmni gives an AI agent safe instruments to measure, test, and verify the device on your desk.
          </p>

          {/* Action CTAs */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "14px",
              flexWrap: "wrap",
              marginTop: "0.5rem",
            }}
          >
            <button
              id="btn-diagnose-demo-device"
              onClick={onStartDemo}
              className="btn-primary"
              style={{
                padding: "13px 26px",
                fontSize: "15.5px",
                fontWeight: 700,
                borderRadius: "var(--radius-md)",
              }}
            >
              <Zap size={18} fill="currentColor" />
              Diagnose the demo device
              <ArrowRight size={18} />
            </button>

            <button
              onClick={onConnectHardware}
              className="btn-secondary"
              style={{
                padding: "13px 22px",
                fontSize: "14.5px",
                fontWeight: 600,
                borderRadius: "var(--radius-md)",
              }}
            >
              <Sliders size={16} />
              Connect hardware
            </button>
          </div>

          {/* Credibility Highlights */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "18px",
              marginTop: "1.25rem",
              paddingTop: "1.25rem",
              borderTop: "1px solid var(--ohmni-border-subtle)",
              flexWrap: "wrap",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", fontWeight: 600, color: "var(--ohmni-secondary)" }}>
              <Cpu size={15} color="var(--ohmni-brand)" />
              Native WebMCP
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", fontWeight: 600, color: "var(--ohmni-secondary)" }}>
              <ShieldCheck size={15} color="var(--ohmni-warning)" />
              Human-controlled tests
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", fontWeight: 600, color: "var(--ohmni-secondary)" }}>
              <Layers size={15} color="var(--ohmni-success)" />
              Evidence-backed diagnosis
            </div>
          </div>
        </motion.div>

        {/* Right Hardware Visual Column */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          style={{
            display: "flex",
            justifyContent: "center",
            minWidth: 0,
          }}
        >
          <AuthoredHardwareIllustration />
        </motion.div>
      </main>
    </div>
  );
};
