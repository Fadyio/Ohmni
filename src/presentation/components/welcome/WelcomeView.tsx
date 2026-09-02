/**
 * State 1 — World 1 (Editorial Intro Experience).
 * Milestone 7.13 — Visual Rescue: 3D OHMNI Identity + Cohesive Product UI
 *
 * Requirements:
 * - Dimensional 3D OHMNI Wordmark as the central brand anchor (~120–170px tall on desktop).
 * - Background: #F5F6F8 (Cohesive light canvas)
 * - Headline:
 *     Your AI can debug code.
 *     Now let it debug hardware.
 * - Subtext:
 *     Ohmni gives agents live diagnostic instruments to measure, test and verify physical devices.
 * - CTAs: [ Diagnose the demo device ] & [ Connect hardware ]
 * - Physical hardware composition with layered depth and micro-parallax.
 */

import React from "react";
import { ArrowRight, Zap, ShieldCheck, Activity, Cpu } from "lucide-react";
import { Ohmni3DWordmark } from "../brand/Ohmni3DWordmark";
import { AuthoredHardwareIllustration } from "./AuthoredHardwareIllustration";
import { useWebMCPTools } from "../../hooks/useWebMCPTools";

export interface WelcomeViewProps {
  readonly onStartDemo: () => void;
  readonly onConnectHardware: () => void;
  readonly heroTextRef?: React.RefObject<HTMLDivElement | null>;
  readonly hardwareVisualRef?: React.RefObject<HTMLDivElement | null>;
  readonly ctaButtonRef?: React.RefObject<HTMLButtonElement | null>;
  readonly wordmarkRef?: React.RefObject<HTMLDivElement | null>;
}

export const WelcomeView: React.FC<WelcomeViewProps> = ({
  onStartDemo,
  onConnectHardware,
  heroTextRef,
  hardwareVisualRef,
  ctaButtonRef,
  wordmarkRef,
}) => {
  const { toolCount } = useWebMCPTools();

  return (
    <div
      id="welcome-view-root"
      data-scene="landing"
      data-testid="welcome-view-root"
      style={{
        width: "100%",
        maxWidth: "100vw",
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        background: "var(--ohmni-intro-bg)",
        color: "var(--ohmni-intro-ink)",
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
          padding: "1.25rem 3rem",
          boxSizing: "border-box",
          zIndex: 10,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span
            className="font-mono"
            style={{
              fontSize: "12px",
              fontWeight: 700,
              letterSpacing: "0.08em",
              color: "var(--ohmni-intro-secondary)",
              textTransform: "uppercase",
            }}
          >
            PRECISION INSTRUMENT MESH
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <span
            data-testid="welcome-mesh-badge"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "7px",
              padding: "5px 14px",
              borderRadius: "var(--radius-full)",
              background: "var(--ohmni-intro-surface)",
              border: "1px solid var(--ohmni-intro-border)",
              fontSize: "12.5px",
              fontWeight: 600,
              color: "var(--ohmni-intro-ink)",
              boxShadow: "var(--shadow-sm)",
            }}
          >
            <span
              style={{
                width: "7px",
                height: "7px",
                borderRadius: "50%",
                background: "var(--ohmni-intro-brand)",
                boxShadow: "0 0 6px rgba(73, 103, 255, 0.6)",
              }}
            />
            WebMCP Instrument Mesh • {toolCount > 0 ? `${toolCount} Instruments Active` : "Active"}
          </span>
        </div>
      </header>

      {/* Main Hero Container */}
      <main
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          maxWidth: "1340px",
          margin: "0 auto",
          padding: "0.5rem 3rem 2.5rem",
          width: "100%",
          boxSizing: "border-box",
          justifyContent: "center",
        }}
      >
        {/* Dimensional 3D OHMNI Hero Wordmark */}
        <div
          ref={wordmarkRef}
          id="hero-wordmark-wrapper"
          data-testid="hero-wordmark-wrapper"
          style={{
            marginBottom: "1.75rem",
            transformOrigin: "top left",
            willChange: "transform, opacity",
          }}
        >
          <Ohmni3DWordmark variant="hero" />
        </div>

        {/* Hero Narrative & Physical Hardware Grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1.15fr) minmax(0, 1fr)",
            alignItems: "center",
            gap: "3.5rem",
            width: "100%",
          }}
        >
          {/* Left Narrative Column */}
          <div
            ref={heroTextRef}
            id="hero-text-container"
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "1.75rem",
              willChange: "transform, opacity",
            }}
          >
            {/* Confident Industrial Typography */}
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              <h1
                style={{
                  fontSize: "clamp(32px, 3.8vw, 46px)",
                  fontWeight: 800,
                  lineHeight: 1.12,
                  letterSpacing: "-0.03em",
                  color: "var(--ohmni-intro-ink)",
                  margin: 0,
                }}
              >
                Your AI can debug code.
                <br />
                <span style={{ color: "var(--ohmni-intro-brand)" }}>
                  Now let it debug hardware.
                </span>
              </h1>

              <p
                style={{
                  fontSize: "16.5px",
                  lineHeight: 1.6,
                  color: "var(--ohmni-intro-secondary)",
                  margin: "8px 0 0",
                  maxWidth: "540px",
                }}
              >
                Ohmni gives agents live diagnostic instruments to measure, test and verify physical devices.
              </p>
            </div>

            {/* Action CTAs */}
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "14px", marginTop: "4px" }}>
              <button
                ref={ctaButtonRef}
                data-testid="diagnose-demo-btn"
                id="diagnose-demo-btn"
                onClick={onStartDemo}
                className="btn-primary"
                style={{
                  padding: "14px 28px",
                  fontSize: "15.5px",
                }}
              >
                <span>Diagnose the demo device</span>
                <ArrowRight size={17} />
              </button>

              <button
                data-testid="connect-hardware-btn"
                onClick={onConnectHardware}
                className="btn-secondary"
                style={{
                  padding: "14px 24px",
                  fontSize: "15px",
                }}
              >
                <Zap size={16} color="var(--ohmni-intro-brand)" />
                <span>Connect hardware</span>
              </button>
            </div>

            {/* Technical Metadata Row */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "18px",
                marginTop: "6px",
                color: "var(--ohmni-intro-secondary)",
                fontSize: "12.5px",
                fontWeight: 500,
              }}
            >
              <span style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                <ShieldCheck size={14} color="var(--ohmni-lab-verified)" />
                Native WebMCP
              </span>
              <span>•</span>
              <span style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                <Activity size={14} color="var(--ohmni-lab-warning)" />
                Amber Safety Bounds
              </span>
              <span>•</span>
              <span style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                <Cpu size={14} color="var(--ohmni-intro-brand)" />
                60fps Oscilloscope
              </span>
            </div>
          </div>

          {/* Right Hardware Visual */}
          <div
            ref={hardwareVisualRef}
            id="hero-hardware-wrapper"
            style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              width: "100%",
              willChange: "transform, opacity",
            }}
          >
            <AuthoredHardwareIllustration toolCount={toolCount} />
          </div>
        </div>
      </main>
    </div>
  );
};
