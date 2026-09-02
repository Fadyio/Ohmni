/**
 * Scene 2 — Controlled Physical Test Request.
 * Full-scene transformation when the agent requests an amber-gated physical actuation:
 * - Large relay coil & armature visualization
 * - Explicit hypothesis and justification
 * - Controlled execution parameters (500ms duration, max 3 attempts, auto-abort on reset)
 * - [ Deny ] and [ Approve test ] actions with keyboard accelerators
 */

import React from "react";
import { motion } from "motion/react";
import { ShieldAlert, Check, X, Zap, Cpu, Activity, Clock } from "lucide-react";

export interface TestRequestSceneProps {
  readonly onApprove: () => void;
  readonly onDeny: () => void;
  readonly toolName?: string;
}

export const TestRequestScene: React.FC<TestRequestSceneProps> = ({
  onApprove,
  onDeny,
  toolName = "run_relay_stress_test",
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "1.5rem",
        height: "100%",
      }}
    >
      {/* Header Tag */}
      <div>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            color: "var(--ohmni-warning)",
            fontSize: "13px",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.04em",
          }}
        >
          <ShieldAlert size={15} />
          Human Authorization Gate • High-Current Load
        </div>
        <h2 className="scene-heading" style={{ margin: "4px 0 0" }}>
          Controlled Physical Stress Test
        </h2>
      </div>

      {/* Main Test Card with Hardware Schematic */}
      <div
        style={{
          background: "var(--ohmni-surface)",
          border: "1.5px solid rgba(229, 154, 37, 0.4)",
          borderRadius: "var(--radius-xl)",
          padding: "1.75rem 2rem",
          boxShadow: "0 8px 30px rgba(229, 154, 37, 0.08)",
          display: "grid",
          gridTemplateColumns: "1.2fr 1fr",
          gap: "2rem",
          alignItems: "center",
        }}
      >
        {/* Left Column: Hypothesis & Parameter Specification */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          <div>
            <div style={{ fontSize: "17px", fontWeight: 800, color: "var(--ohmni-ink)" }}>
              The agent wants to briefly energize the fan relay while monitoring MCU supply voltage.
            </div>
            <p className="body-text" style={{ margin: "8px 0 0", fontSize: "14.5px" }}>
              <strong>Hypothesis:</strong> The relay coil draws surge current from the shared 3.3 V rail, causing voltage to collapse below the 2.80 V brownout threshold and resetting the controller.
            </p>
          </div>

          {/* Execution Bounds */}
          <div
            style={{
              background: "var(--ohmni-warning-subtle)",
              border: "1px solid rgba(229, 154, 37, 0.2)",
              borderRadius: "var(--radius-md)",
              padding: "12px 16px",
              display: "flex",
              flexDirection: "column",
              gap: "6px",
            }}
          >
            <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--ohmni-warning)", letterSpacing: "0.04em", textTransform: "uppercase" }}>
              Controlled Safety Parameters
            </div>
            <div style={{ fontSize: "13.5px", color: "var(--ohmni-ink)", display: "flex", alignItems: "center", gap: "8px" }}>
              <span>• Duration: <strong>500 ms</strong></span>
              <span>• Max attempts: <strong>3</strong></span>
              <span>• Auto-abort on reset: <strong>Active</strong></span>
            </div>
          </div>

          {/* Action CTAs */}
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginTop: "0.5rem" }}>
            <button
              id="btn-approve-test"
              data-testid="bench-agent-approve"
              onClick={onApprove}
              className="btn-primary"
              style={{
                padding: "12px 24px",
                fontSize: "15px",
                fontWeight: 700,
                background: "var(--ohmni-warning)",
                borderColor: "var(--ohmni-warning)",
                color: "#FFFFFF",
                boxShadow: "0 4px 14px rgba(229, 154, 37, 0.35)",
              }}
            >
              <Check size={16} />
              Approve test
              <span
                style={{
                  background: "rgba(0, 0, 0, 0.2)",
                  padding: "1px 6px",
                  borderRadius: "3px",
                  fontSize: "11px",
                  fontFamily: "var(--font-mono)",
                  marginLeft: "4px",
                }}
              >
                A
              </span>
            </button>

            <button
              id="btn-deny-test"
              data-testid="bench-agent-deny"
              onClick={onDeny}
              className="btn-secondary"
              style={{
                padding: "12px 20px",
                fontSize: "14px",
                fontWeight: 600,
              }}
            >
              <X size={15} />
              Deny
              <span
                style={{
                  background: "rgba(116, 113, 107, 0.15)",
                  padding: "1px 6px",
                  borderRadius: "3px",
                  fontSize: "11px",
                  fontFamily: "var(--font-mono)",
                  marginLeft: "4px",
                }}
              >
                D
              </span>
            </button>
          </div>
        </div>

        {/* Right Column: Hardware Relay Visualization */}
        <div
          style={{
            background: "var(--ohmni-surface-dark)",
            borderRadius: "var(--radius-lg)",
            padding: "1.5rem",
            boxShadow: "inset 0 1px 3px rgba(0, 0, 0, 0.4)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
            <span className="font-mono" style={{ fontSize: "11px", fontWeight: 700, color: "var(--ohmni-warning)" }}>
              TARGET LOAD: RELAY K1
            </span>
            <span className="font-mono" style={{ fontSize: "11px", color: "#94A3B8" }}>
              GPIO14 • 12V FAN
            </span>
          </div>

          <svg viewBox="0 0 240 140" style={{ width: "100%", height: "auto", display: "block" }}>
            {/* Coil */}
            <g transform="translate(30, 40)">
              <path
                d="M 0 30 Q 12 10 24 30 Q 36 10 48 30 Q 60 10 72 30 Q 84 10 96 30"
                stroke="#E59A25"
                strokeWidth="2.5"
                fill="none"
              />
              <text x="48" y="55" textAnchor="middle" fill="#E59A25" fontSize="9" fontFamily="var(--font-mono)" fontWeight="700">
                COIL 3.3V
              </text>
            </g>

            {/* Switch Contacts */}
            <g transform="translate(150, 40)">
              <circle cx="10" cy="30" r="3.5" fill="#E59A25" />
              <circle cx="50" cy="15" r="3.5" fill="#E59A25" />
              <line x1="10" y1="30" x2="44" y2="18" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" />
              <text x="58" y="18" fill="#94A3B8" fontSize="8" fontFamily="var(--font-mono)">NO</text>
              <text x="0" y="34" fill="#94A3B8" fontSize="8" fontFamily="var(--font-mono)">COM</text>
            </g>
          </svg>
        </div>
      </div>
    </motion.div>
  );
};
