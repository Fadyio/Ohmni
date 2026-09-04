/**
 * Landing Welcome View.
 * Introduces Ohmni's external-agent value proposition and hardware workbench entry.
 */
import React from "react";
import { ArrowRight } from "lucide-react";
import { AuthoredHardwareIllustration } from "./AuthoredHardwareIllustration";

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

  return (
    <div
      id="welcome-view-root"
      data-scene="landing"
      data-testid="welcome-view-root"
      style={{
        width: "100%",
        maxWidth: "100vw",
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        background: "var(--ohmni-intro-bg, #F5F6F8)",
        backgroundImage: "radial-gradient(rgba(18, 21, 26, 0.03) 1px, transparent 0)",
        backgroundSize: "28px 28px",
        color: "var(--ohmni-intro-ink, #12151A)",
        overflowY: "auto",
        overflowX: "hidden",
        position: "relative",
        boxSizing: "border-box",
      }}
    >
      {/* Top Header: minimal 64-72px, single quiet label on right */}
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          minHeight: "68px",
          padding: "0 clamp(1.5rem, 4vw, 3rem)",
          boxSizing: "border-box",
          zIndex: 10,
          borderBottom: "1px solid rgba(18, 21, 26, 0.05)",
        }}
      >
        <img
          src="/brand/ohmni-logo.svg"
          alt="OHMNI"
          style={{ height: "26px", width: "auto" }}
        />
        <span
          style={{
            fontSize: "13px",
            fontWeight: 500,
            color: "var(--ink-secondary, #5C6470)",
            letterSpacing: "0.01em",
          }}
        >
          WebMCP hardware instruments
        </span>
      </header>

      {/* Main Hero Container */}
      <main
        style={{
          minHeight: "calc(100vh - 68px)",
          display: "flex",
          flexDirection: "column",
          maxWidth: "1340px",
          margin: "0 auto",
          padding: "1rem clamp(1.5rem, 4vw, 3rem) 2rem",
          width: "100%",
          boxSizing: "border-box",
          justifyContent: "center",
        }}
      >
        <div
          ref={wordmarkRef}
          id="hero-wordmark-wrapper"
          data-testid="hero-wordmark-wrapper"
          style={{ display: "none" }}
        />

        {/* Hero narrative and hardware visual */}
        <div className="landing-hero-grid">
          {/* Left Narrative Column */}
          <div
            ref={heroTextRef}
            id="hero-text-container"
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "1.5rem",
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
                  color: "var(--ohmni-intro-ink, #111318)",
                  margin: 0,
                }}
              >
                Give AI agents instruments<br />
                <span style={{ color: "var(--brand, #2B57FF)" }}>for the physical world.</span>
              </h1>

              <p
                style={{
                  fontSize: "16px",
                  lineHeight: 1.6,
                  color: "var(--ink-secondary, #5C6470)",
                  margin: "6px 0 0",
                  maxWidth: "580px",
                }}
              >
                Ohmni exposes hardware measurements and controlled actions as WebMCP tools, so an AI agent can inspect a device, run safe tests, gather evidence, and ask for your hands when a physical change is required.
              </p>
            </div>

            {/* Micro Architecture Cue */}
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                padding: "6px 12px",
                borderRadius: "8px",
                background: "rgba(18, 21, 26, 0.03)",
                border: "1px solid rgba(18, 21, 26, 0.07)",
                fontSize: "12.5px",
                fontWeight: 600,
                color: "var(--ink-secondary, #5C6470)",
                width: "fit-content",
              }}
            >
              <span style={{ color: "var(--ink, #111318)" }}>AI Agent</span>
              <span style={{ color: "var(--ink-tertiary, #8A92A0)" }}>→</span>
              <span style={{ color: "var(--brand, #2B57FF)" }}>WebMCP</span>
              <span style={{ color: "var(--ink-tertiary, #8A92A0)" }}>→</span>
              <span style={{ color: "var(--ink, #111318)" }}>Hardware Instruments</span>
            </div>

            {/* Action CTAs */}
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "12px", marginTop: "2px" }}>
              {/* Primary: Virtual diagnosis */}
              <button
                ref={ctaButtonRef}
                data-testid="start-mystery-btn"
                id="start-mystery-btn"
                onClick={onStartMystery ?? onStartDemo}
                className="btn-primary"
                style={{
                  padding: "13px 24px",
                  fontSize: "15px",
                  fontWeight: 700,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                <span>Launch virtual diagnosis</span>
                <ArrowRight size={16} />
              </button>

              {/* Secondary: Connect hardware */}
              <button
                data-testid="connect-hardware-btn"
                id="connect-hardware-btn"
                onClick={onConnectHardware}
                className="btn-secondary"
                style={{
                  padding: "13px 22px",
                  fontSize: "15px",
                  fontWeight: 600,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                <span>Connect hardware</span>
              </button>
            </div>

            {/* Tertiary Link: How it works */}
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "2px" }}>
              <button
                data-testid="diagnose-demo-btn"
                id="diagnose-demo-btn"
                onClick={() => {
                  const el = document.getElementById("how-it-works");
                  if (el) {
                    el.scrollIntoView({ behavior: "smooth" });
                  } else {
                    onStartDemo();
                  }
                }}
                style={{
                  background: "transparent",
                  border: "none",
                  padding: 0,
                  fontSize: "14px",
                  fontWeight: 600,
                  color: "var(--brand, #2B57FF)",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                }}
              >
                <span>How it works →</span>
              </button>
            </div>

            {/* Single Restrained Trust Line */}
            <div
              style={{
                marginTop: "4px",
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                gap: "8px",
                color: "var(--ink-tertiary, #8A92A0)",
                fontSize: "13px",
                fontWeight: 500,
                letterSpacing: "0.01em",
              }}
            >
              <span>Human-approved actuation</span>
              <span aria-hidden="true" style={{ opacity: 0.5 }}>·</span>
              <span>Evidence-backed diagnosis</span>
              <span aria-hidden="true" style={{ opacity: 0.5 }}>·</span>
              <span>Retest to verify</span>
            </div>
          </div>

          {/* Right Hardware Visual */}
          <div
            ref={hardwareVisualRef}
            id="hero-hardware-wrapper"
            style={{
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              alignItems: "center",
              width: "100%",
              willChange: "transform, opacity",
            }}
          >
            <AuthoredHardwareIllustration />
          </div>
        </div>
      </main>

      {/* Below the Fold: How it Works */}
      <section
        id="how-it-works"
        style={{
          borderTop: "1px solid var(--border, rgba(18, 21, 26, 0.08))",
          background: "#FFFFFF",
          padding: "4rem clamp(1.5rem, 4vw, 3rem)",
          width: "100%",
          boxSizing: "border-box",
        }}
      >
        <div
          style={{
            maxWidth: "1100px",
            margin: "0 auto",
            display: "flex",
            flexDirection: "column",
            gap: "2.5rem",
          }}
        >
          <h2
            style={{
              fontSize: "clamp(24px, 2.5vw, 32px)",
              fontWeight: 750,
              letterSpacing: "-0.025em",
              color: "var(--ink, #111318)",
              margin: 0,
            }}
          >
            Software agents can finally observe hardware.
          </h2>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
              gap: "2rem",
            }}
          >
            <div>
              <div
                style={{
                  fontSize: "12px",
                  fontWeight: 700,
                  letterSpacing: "0.06em",
                  color: "var(--brand, #2B57FF)",
                  marginBottom: "8px",
                }}
              >
                MEASURE
              </div>
              <p style={{ margin: 0, fontSize: "15px", lineHeight: 1.5, color: "var(--ink-secondary, #5C6470)" }}>
                Read device state and telemetry.
              </p>
            </div>

            <div>
              <div
                style={{
                  fontSize: "12px",
                  fontWeight: 700,
                  letterSpacing: "0.06em",
                  color: "var(--brand, #2B57FF)",
                  marginBottom: "8px",
                }}
              >
                TEST
              </div>
              <p style={{ margin: 0, fontSize: "15px", lineHeight: 1.5, color: "var(--ink-secondary, #5C6470)" }}>
                Run bounded experiments behind human approval.
              </p>
            </div>

            <div>
              <div
                style={{
                  fontSize: "12px",
                  fontWeight: 700,
                  letterSpacing: "0.06em",
                  color: "var(--brand, #2B57FF)",
                  marginBottom: "8px",
                }}
              >
                VERIFY
              </div>
              <p style={{ margin: 0, fontSize: "15px", lineHeight: 1.5, color: "var(--ink-secondary, #5C6470)" }}>
                Gather evidence and retest after repair.
              </p>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              paddingTop: "1.5rem",
              borderTop: "1px solid rgba(18, 21, 26, 0.06)",
              fontSize: "13px",
              fontWeight: 600,
              color: "var(--ink-tertiary, #8A92A0)",
            }}
          >
            <span style={{ color: "var(--ink, #111318)" }}>Agent</span>
            <span>→</span>
            <span style={{ color: "var(--brand, #2B57FF)" }}>WebMCP</span>
            <span>→</span>
            <span style={{ color: "var(--ink, #111318)" }}>Ohmni</span>
            <span>→</span>
            <span style={{ color: "var(--ink, #111318)" }}>Device</span>
          </div>
        </div>
      </section>
    </div>
  );
};
