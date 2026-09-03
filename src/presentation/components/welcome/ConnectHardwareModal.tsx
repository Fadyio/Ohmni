/**
 * Connect Hardware Modal.
 *
 * Professional Web Serial connection flow:
 * 1. Checks browser Web Serial support truthfully (Chromium only).
 * 2. Explains browser-local execution model (USB serial connection stays browser-local; structured diagnostic results may be shared with the selected AI provider when reasoning).
 * 3. Drives port selection (navigator.serial.requestPort) and protocol v1 negotiation.
 * 4. Provides a Simulated Serial Peer fallback for local automated testing when no physical board is plugged in.
 */

import React, { useState, useEffect } from "react";
import {
  Usb,
  AlertCircle,
  CheckCircle2,
  X,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import {
  checkWebSerialSupport,
  isWebSerialSupported,
} from "@/infrastructure/serial/web-serial-transport";

export interface ConnectHardwareModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly onConnectPhysical: () => Promise<void>;
  readonly onConnectSimulatedSerial: () => Promise<void>;
}

export type ConnectionStep =
  | "idle"
  | "requesting_permission"
  | "opening_port"
  | "negotiating_protocol"
  | "connected"
  | "error";

export const ConnectHardwareModal: React.FC<ConnectHardwareModalProps> = ({
  isOpen,
  onClose,
  onConnectPhysical,
  onConnectSimulatedSerial,
}) => {
  const [supportCheck, setSupportCheck] = useState<{
    supported: boolean;
    reason?: string;
  }>({ supported: true });
  const [step, setStep] = useState<ConnectionStep>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setSupportCheck(checkWebSerialSupport());
      setStep("idle");
      setErrorMessage(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSelectPort = async () => {
    setStep("requesting_permission");
    setErrorMessage(null);

    try {
      setStep("opening_port");
      await onConnectPhysical();
      setStep("connected");
      setTimeout(() => {
        onClose();
      }, 500);
    } catch (err) {
      setStep("error");
      setErrorMessage(err instanceof Error ? err.message : String(err));
    }
  };

  const handleSimulatedPeer = async () => {
    setStep("opening_port");
    setErrorMessage(null);

    try {
      setStep("negotiating_protocol");
      await onConnectSimulatedSerial();
      setStep("connected");
      setTimeout(() => {
        onClose();
      }, 500);
    } catch (err) {
      setStep("error");
      setErrorMessage(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div
      data-testid="connect-hardware-modal-overlay"
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(15, 23, 42, 0.65)",
        backdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100,
        padding: "1rem",
      }}
    >
      <div
        data-testid="connect-hardware-modal"
        style={{
          width: "100%",
          maxWidth: "520px",
          background: "#FFFFFF",
          borderRadius: "var(--radius-xl, 16px)",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
          border: "1px solid var(--ohmni-lab-border, #E2E4E9)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "1.25rem 1.5rem",
            borderBottom: "1px solid var(--ohmni-lab-border, #E2E4E9)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "8px",
                background: "rgba(73, 103, 255, 0.1)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--ohmni-lab-brand, #4967FF)",
              }}
            >
              <Usb size={20} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: "16.5px", fontWeight: 800, color: "var(--ohmni-lab-text, #0F172A)" }}>
                Connect hardware
              </h2>
              <div style={{ fontSize: "12px", color: "var(--ohmni-lab-muted, #64748B)" }}>
                Connect a supported board, or continue with the simulator.
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              padding: "6px",
              borderRadius: "6px",
              color: "#64748B",
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          <details
            style={{
              padding: "0.75rem 1rem",
              borderRadius: "8px",
              background: "#F8FAFC",
              border: "1px solid #E2E8F0",
              fontSize: "12.5px",
              lineHeight: 1.55,
              color: "#334155",
            }}
          >
            <summary style={{ cursor: "pointer", fontWeight: 700 }}>
              Advanced technical details
            </summary>
            <div style={{ display: "flex", gap: "10px", marginTop: "0.75rem" }}>
              <ShieldCheck size={18} color="#27966B" style={{ flexShrink: 0, marginTop: "2px" }} />
              <div>
                <strong>Web Serial · 115200 baud · NDJSON v1.</strong> The USB serial connection stays
                browser-local. Structured diagnostic results may be shared with the selected AI provider when
                the agent reasons over them.
              </div>
            </div>
          </details>

          {/* Browser Support Check */}
          {!supportCheck.supported ? (
            <div
              data-testid="web-serial-unsupported-banner"
              style={{
                padding: "1rem",
                borderRadius: "8px",
                background: "rgba(239, 68, 68, 0.08)",
                border: "1px solid rgba(239, 68, 68, 0.25)",
                color: "#991B1B",
                fontSize: "13px",
                lineHeight: 1.5,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "6px", fontWeight: 700, marginBottom: "4px" }}>
                <AlertCircle size={16} />
                <span>Web Serial Unavailable</span>
              </div>
              <div>{supportCheck.reason}</div>
              <div style={{ marginTop: "6px", fontSize: "12px", color: "#B91C1C" }}>
                Open Ohmni in desktop Google Chrome or Microsoft Edge to connect physical serial hardware.
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              <div style={{ fontSize: "13px", fontWeight: 600, color: "#0F172A" }}>
                Steps to connect physical board:
              </div>
              <ol style={{ margin: 0, paddingLeft: "1.25rem", fontSize: "13px", color: "#475569", lineHeight: 1.6 }}>
                <li>Connect your supported board to your computer via USB.</li>
                <li>Close any active Arduino Serial Monitor or PlatformIO monitor.</li>
                <li>Click <strong>Select Serial Port</strong> below and pick your device.</li>
              </ol>
            </div>
          )}

          {/* Connection Status Messaging */}
          {step !== "idle" && (
            <div
              data-testid="hardware-connection-status"
              style={{
                padding: "0.75rem 1rem",
                borderRadius: "8px",
                fontSize: "13px",
                fontWeight: 600,
                display: "flex",
                alignItems: "center",
                gap: "8px",
                background:
                  step === "connected"
                    ? "rgba(39, 150, 107, 0.1)"
                    : step === "error"
                    ? "rgba(239, 68, 68, 0.1)"
                    : "#F1F5F9",
                color:
                  step === "connected"
                    ? "#15803D"
                    : step === "error"
                    ? "#B91C1C"
                    : "#334155",
              }}
            >
              {step === "connected" ? (
                <CheckCircle2 size={16} />
              ) : step === "error" ? (
                <AlertCircle size={16} />
              ) : (
                <Loader2 size={16} className="animate-spin" />
              )}
              <span>
                {step === "requesting_permission" && "Waiting for serial port selection..."}
                {step === "opening_port" && "Opening serial port at 115200 baud..."}
                {step === "negotiating_protocol" && "Negotiating device protocol..."}
                {step === "connected" && "Hardware connected and WebMCP instruments registered!"}
                {step === "error" && (errorMessage ?? "Connection failed")}
              </span>
            </div>
          )}
        </div>

        {/* Modal Footer Actions */}
        <div
          style={{
            padding: "1rem 1.5rem",
            background: "#F8FAFC",
            borderTop: "1px solid var(--ohmni-lab-border, #E2E4E9)",
            display: "flex",
            flexWrap: "wrap",
            alignItems: "flex-end",
            justifyContent: "space-between",
            gap: "16px",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "5px", maxWidth: "250px" }}>
            <button
              type="button"
              id="connect-simulated-peer-btn"
              data-testid="connect-simulated-serial-btn"
              onClick={handleSimulatedPeer}
              className="btn-secondary"
              style={{
                fontSize: "12px",
                padding: "6px 12px",
                color: "#475569",
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-start",
                gap: "2px",
              }}
            >
              <span style={{ fontWeight: 600 }}>Use simulator</span>
              <span style={{ fontSize: "10px", color: "#64748B" }}>No hardware required · same serial protocol path</span>
            </button>
            <span style={{ fontSize: "10px", lineHeight: 1.35, color: "#64748B" }}>
              The simulator verifies the browser workflow and protocol, not USB hardware, firmware, wiring, or
              electrical behavior.
            </span>
          </div>

          <div style={{ display: "flex", gap: "10px" }}>
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary"
              style={{ padding: "8px 16px", fontSize: "13px" }}
            >
              Cancel
            </button>

            <button
              type="button"
              data-testid="select-serial-port-btn"
              disabled={!supportCheck.supported || step === "opening_port" || step === "negotiating_protocol"}
              onClick={handleSelectPort}
              className="btn-primary"
              style={{
                padding: "8px 20px",
                fontSize: "13.5px",
                fontWeight: 700,
                opacity: supportCheck.supported ? 1 : 0.5,
              }}
            >
              <span>Select Serial Port</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
