/**
 * State 1 — World 1 (Editorial Intro Experience).
 * Master Milestone 8 — Blind Hardware Investigation Mode
 *
 * Requirements:
 * - Dimensional 3D OHMNI Wordmark as the central brand anchor (~25-30% visual weight).
 * - Background: #F5F6F8 (Cohesive light canvas)
 * - Headline:
 *     Your AI can debug code.
 *     Now let it debug hardware.
 * - Subtext:
 *     Ohmni gives agents live diagnostic instruments to measure, test and verify physical devices.
 * - Primary CTA: [ Start Mystery Diagnosis ]
 * - Secondary CTAs: [ Explore Brownout Demo ] & [ Connect Hardware ]
 */

import React from "react";
import { ArrowRight, Zap, ShieldCheck, Activity, Cpu, Lock, Sparkles } from "lucide-react";
import { Ohmni3DWordmark } from "../brand/Ohmni3DWordmark";
import { AuthoredHardwareIllustration } from "./AuthoredHardwareIllustration";
import { useWebMCPTools } from "../../hooks/useWebMCPTools";

export interface WelcomeViewProps {
  readonly onStartMystery?: () => void;
  readonly onStartDemo: () => void;
  readonly onConnectHardware?: () => void;
  readonly heroTextRef?: React.RefObject<HTMLDivElement | null>;
  readonly hardwareVisualRef?: React.RefObject<HTMLDivElement | null>;
  readonly ctaButtonRef?: React.RefObject<HTMLButtonElement | null>;
  readonly wordmarkRef?: React.RefObject<HTMLDivElement | null>;
}

export const WelcomeView: React.FC<WelcomeViewProps> = ({
  onStartMystery,
  onStartDemo,
  onConnectHardware,
  heroTextRef,
  hardwareVisualRef,
  ctaButtonRef,
  wordmarkRef,
}) => {
  const { toolCount, isNative } = useWebMCPTools();

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
        background: "var(--ohmni-intro-bg, #F5F6F8)",
        color: "var(--ohmni-intro-ink, #12151A)",
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
              color: "var(--ohmni-intro-secondary, #525866)",
              textTransform: "uppercase",
            }}
          >
            HARDWARE DIAGNOSTIC WORKBENCH
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
                  color: "var(--ohmni-intro-ink, #12151A)",
                  margin: 0,
                }}
              >
                AI can debug your code.
                <br />
                <span style={{ color: "var(--ohmni-intro-brand, #4967FF)" }}>
                  Now it can investigate the board on your desk.
                </span>
              </h1>

              <p
                style={{
                  fontSize: "16.5px",
                  lineHeight: 1.6,
                  color: "var(--ohmni-intro-secondary, #525866)",
                  margin: "8px 0 0",
                  maxWidth: "540px",
                }}
              >
                A hardware fault is hidden. The agent must measure it, test it, ask for your hands when needed, and prove the repair.
              </p>
            </div>

            {/* Action CTAs */}
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "14px", marginTop: "4px" }}>
              {/* Primary CTA: Start blind diagnosis */}
              <button
                ref={ctaButtonRef}
                data-testid="start-mystery-btn"
                id="start-mystery-btn"
                onClick={onStartMystery ?? onStartDemo}
                className="btn-primary"
                style={{
                  padding: "14px 28px",
                  fontSize: "15.5px",
                  fontWeight: 800,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                <Lock size={16} />
                <span>Start blind diagnosis</span>
                <ArrowRight size={17} />
              </button>

              {/* Secondary CTA: Deterministic walkthrough */}
              <button
                data-testid="diagnose-demo-btn"
                id="diagnose-demo-btn"
                onClick={onStartDemo}
                className="btn-secondary"
                style={{
                  padding: "14px 20px",
                  fontSize: "14.5px",
                }}
              >
                <span>View deterministic walkthrough</span>
              </button>
            </div>

            {/* Technical Metadata Row */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "18px",
                marginTop: "6px",
                color: "var(--ohmni-intro-secondary, #525866)",
                fontSize: "12.5px",
                fontWeight: 500,
              }}
            >
              <span style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                <ShieldCheck size={14} color="var(--ohmni-lab-verified, #27966B)" />
                Native WebMCP
              </span>
              <span>•</span>
              <span style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                <Activity size={14} color="var(--ohmni-lab-warning, #D97706)" />
                Amber Physical Safety
              </span>
              <span>•</span>
              <span style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                <Cpu size={14} color="var(--ohmni-intro-brand, #4967FF)" />
                Sealed Ground Truth
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
