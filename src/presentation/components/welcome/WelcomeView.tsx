/**
 * State 1 — World 1 (Editorial Intro Experience).
 *
 * Requirements:
 * - Background: #F7F7F5, Ink: #101114, Brand Blue: #3B5BFF, Secondary: #6B6E76
 * - No beige/yellow tint, no dozens of bordered cards.
 * - Headline:
 *     Your AI can debug code.
 *     Now let it debug hardware.
 * - Subtext:
 *     Ohmni gives AI agents safe instruments to measure,
 *     test and verify the physical device in front of you.
 * - CTAs: [ Diagnose the demo device ] & [ Connect hardware ]
 * - Floating hardware composition directly in layout.
 * - Dynamic live tool count.
 */

import React, { useRef } from "react";
import { ArrowRight, Cpu, Radio, Zap } from "lucide-react";
import { AuthoredHardwareIllustration } from "./AuthoredHardwareIllustration";
import { useWebMCPTools } from "../../hooks/useWebMCPTools";

export interface WelcomeViewProps {
  readonly onStartDemo: () => void;
  readonly onConnectHardware: () => void;
  readonly heroTextRef?: React.RefObject<HTMLDivElement | null>;
  readonly hardwareVisualRef?: React.RefObject<HTMLDivElement | null>;
  readonly ctaButtonRef?: React.RefObject<HTMLButtonElement | null>;
}

export const WelcomeView: React.FC<WelcomeViewProps> = ({
  onStartDemo,
  onConnectHardware,
  heroTextRef,
  hardwareVisualRef,
  ctaButtonRef,
}) => {
  const { toolCount, isNative } = useWebMCPTools();

  return (
    <div
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
      {/* Top Editorial Header */}
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "1.25rem 2.5rem",
          borderBottom: "1px solid var(--ohmni-intro-border)",
          boxSizing: "border-box",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <img
            src="/brand/ohmni-logo.svg"
            alt="OHMNI"
            style={{ height: "26px", width: "auto" }}
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
              }}
            />
            WebMCP Instrument Mesh • {toolCount > 0 ? `${toolCount} Instruments` : "Active"}
          </span>
        </div>
      </header>

      {/* Main Editorial Hero Grid */}
      <main
        style={{
          flex: 1,
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.15fr) minmax(0, 1fr)",
          alignItems: "center",
          gap: "3rem",
          maxWidth: "1200px",
          margin: "0 auto",
          padding: "2.5rem 2rem 3rem",
          width: "100%",
          boxSizing: "border-box",
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
          }}
        >
          {/* Confident Typography */}
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <h1
              style={{
                fontSize: "clamp(34px, 4.2vw, 48px)",
                fontWeight: 800,
                lineHeight: 1.1,
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
                maxWidth: "520px",
              }}
            >
              Ohmni gives AI agents safe instruments to measure, test and verify the physical device in front of you.
            </p>
          </div>

          {/* Action CTAs */}
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "12px", marginTop: "4px" }}>
            <button
              ref={ctaButtonRef}
              data-testid="diagnose-demo-btn"
              id="diagnose-demo-btn"
              onClick={onStartDemo}
              className="btn-primary"
              style={{
                background: "var(--ohmni-intro-brand)",
                padding: "13px 26px",
                fontSize: "15px",
              }}
            >
              <span>Diagnose the demo device</span>
              <ArrowRight size={16} />
            </button>

            <button
              onClick={onConnectHardware}
              className="btn-secondary"
              style={{
                padding: "13px 22px",
                fontSize: "15px",
              }}
            >
              <Zap size={15} color="var(--ohmni-intro-brand)" />
              <span>Connect hardware</span>
            </button>
          </div>

          {/* Sparse Technical Credibility Row */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "18px",
              marginTop: "8px",
              color: "var(--ohmni-intro-secondary)",
              fontSize: "12.5px",
              fontWeight: 500,
            }}
          >
            <span>Native WebMCP</span>
            <span>•</span>
            <span>Amber Safety Bounds</span>
            <span>•</span>
            <span>60fps Oscilloscope</span>
          </div>
        </div>

        {/* Right Floating Hardware Illustration */}
        <div
          ref={hardwareVisualRef}
          id="hero-hardware-wrapper"
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            width: "100%",
          }}
        >
          <AuthoredHardwareIllustration toolCount={toolCount} />
        </div>
      </main>
    </div>
  );
};
