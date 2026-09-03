/**
 * State 1 — World 1 (Editorial Intro Experience).
 * Master Milestone 8 — Blind Hardware Investigation Mode
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
        <img
          src="/brand/ohmni-logo.svg"
          alt="OHMNI"
          style={{ height: "28px", width: "auto" }}
        />
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
        <div
          ref={wordmarkRef}
          id="hero-wordmark-wrapper"
          data-testid="hero-wordmark-wrapper"
          style={{ display: "none" }}
        />

        {/* Hero narrative and hardware visual */}
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
                  fontSize: "clamp(30px, 3.6vw, 44px)",
                  fontWeight: 800,
                  lineHeight: 1.14,
                  letterSpacing: "-0.03em",
                  color: "var(--ohmni-intro-ink, #12151A)",
                  margin: 0,
                }}
              >
                Give your AI agent instruments for the physical world.
              </h1>

              <p
                style={{
                  fontSize: "16px",
                  lineHeight: 1.6,
                  color: "var(--ohmni-intro-secondary, #525866)",
                  margin: "8px 0 0",
                  maxWidth: "560px",
                }}
              >
                Ohmni turns hardware measurements and controlled experiments into WebMCP tools. Bring ChatGPT,
                Codex, or another compatible agent to inspect a virtual device or hardware connected over Web
                Serial.
              </p>
              <p
                style={{
                  fontSize: "14px",
                  lineHeight: 1.55,
                  color: "var(--ohmni-intro-secondary, #525866)",
                  margin: "4px 0 0",
                  maxWidth: "560px",
                }}
              >
                The agent can measure and reason autonomously. Physical actuation requires your approval, and
                physical repairs require your hands.
              </p>
            </div>

            {/* Action CTAs */}
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "12px", marginTop: "4px" }}>
              {/* Primary: agent-ready virtual workbench */}
              <button
                ref={ctaButtonRef}
                data-testid="start-mystery-btn"
                id="start-mystery-btn"
                onClick={onStartMystery}
                className="btn-primary"
                style={{
                  padding: "13px 24px",
                  fontSize: "15px",
                  fontWeight: 800,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                <span>Open agent-ready workbench</span>
                <ArrowRight size={16} />
              </button>

              {/* Action 2: Connect hardware */}
              <button
                data-testid="connect-hardware-btn"
                id="connect-hardware-btn"
                onClick={onConnectHardware}
                className="btn-secondary"
                style={{
                  padding: "13px 22px",
                  fontSize: "15px",
                  fontWeight: 700,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                  background: "#FFFFFF",
                  border: "1px solid #CBD5E1",
                }}
              >
                <span>Connect hardware</span>
              </button>
            </div>

            {/* Tertiary Link: Deterministic Walkthrough */}
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "2px" }}>
              <button
                data-testid="diagnose-demo-btn"
                id="diagnose-demo-btn"
                onClick={onStartDemo}
                style={{
                  background: "transparent",
                  border: "none",
                  padding: 0,
                  fontSize: "13px",
                  fontWeight: 600,
                  color: "var(--ohmni-intro-secondary, #525866)",
                  cursor: "pointer",
                  textDecoration: "underline",
                  textUnderlineOffset: "3px",
                }}
              >
                Try built-in demo
              </button>
            </div>

            {/* Product principles */}
            <div
              style={{
                marginTop: "6px",
                color: "var(--ohmni-intro-secondary, #525866)",
                fontSize: "12.5px",
                fontWeight: 500,
              }}
            >
              Human-gated actuation · Evidence-backed diagnosis · Retest to verify
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
            <AuthoredHardwareIllustration />
          </div>
        </div>
      </main>
    </div>
  );
};
