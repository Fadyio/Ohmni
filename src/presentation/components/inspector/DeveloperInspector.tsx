/**
 * Developer Inspector Component.
 * Master Milestone 8 — Protocol & Architecture Inspector (Phase 18).
 *
 * Provides proof of WebMCP compliance, modelContext status, and sealed scenario state
 * without cluttering the normal user experience.
 * Shortcut: Cmd/Ctrl + Shift + D
 */

import React, { useState } from "react";
import { X, Copy, Check, Terminal, Shield, Cpu, Lock, Eye, Layers } from "lucide-react";
import type { RegisteredTool } from "@/infrastructure/webmcp/types";
import type { ScenarioSession } from "@/domain/scenario/types";
import type { EvidenceRecord } from "@/domain/evidence/types";
import type { Hypothesis } from "@/domain/hypothesis/types";
import { classifyTool } from "@/domain/safety/tool-safety-policy";

export interface DeveloperInspectorProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly isNativeWebMCP: boolean;
  readonly registeredTools: readonly { readonly name: string; readonly description?: string; readonly annotations?: { readonly readOnlyHint?: boolean } }[];
  readonly activeScenario?: ScenarioSession | null;
  readonly evidenceRecords: readonly EvidenceRecord[];
  readonly hypotheses: readonly Hypothesis[];
  readonly latestToolResult?: { toolName: string; result: string; timestamp: number } | null;
  readonly activeExperimentId?: string;
  readonly providerName?: string;
}

export const DeveloperInspector: React.FC<DeveloperInspectorProps> = ({
  isOpen,
  onClose,
  isNativeWebMCP,
  registeredTools,
  activeScenario,
  evidenceRecords,
  hypotheses,
  latestToolResult,
  activeExperimentId,
  providerName = "Gemini 2.5 Flash (Vercel Serverless)",
}) => {
  const [copiedSnippet, setCopiedSnippet] = useState(false);
  const buildSha =
    (typeof window !== "undefined" && window.__OHMNI_BUILD_SHA__) ||
    (import.meta.env.VITE_BUILD_SHA as string) ||
    "development";
  const copySnippet = () => {
    navigator.clipboard.writeText("await document.modelContext.getTools()");
    setCopiedSnippet(true);
    setTimeout(() => setCopiedSnippet(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <div
      id="developer-inspector-overlay"
      data-testid="developer-inspector-overlay"
      style={{
        position: "fixed",
        top: 0,
        right: 0,
        bottom: 0,
        width: "min(480px, 90vw)",
        background: "#0F172A",
        color: "#F8FAFC",
        zIndex: 90,
        boxShadow: "-12px 0 32px rgba(0,0,0,0.35)",
        borderLeft: "1px solid #334155",
        display: "flex",
        flexDirection: "column",
        boxSizing: "border-box",
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "1rem 1.25rem",
          borderBottom: "1px solid #1E293B",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <Terminal size={16} color="#4967FF" />
          <span style={{ fontSize: "13px", fontWeight: 700, letterSpacing: "0.04em" }}>
            DEVELOPER INSPECTOR
          </span>
          <span style={{ fontSize: "11px", color: "#64748B" }}>[Cmd+Shift+D]</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          style={{
            background: "transparent",
            border: "none",
            color: "#94A3B8",
            cursor: "pointer",
            padding: "4px",
            display: "flex",
            alignItems: "center",
          }}
        >
          <X size={18} />
        </button>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: "auto", padding: "1.25rem", display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        {/* WebMCP Protocol Status */}
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <div style={{ fontSize: "11px", fontWeight: 700, color: "#94A3B8", textTransform: "uppercase" }}>
            WEBMCP RUNTIME CONTEXT
          </div>
          <div
            style={{
              background: "#1E293B",
              borderRadius: "8px",
              padding: "10px 12px",
              display: "flex",
              flexDirection: "column",
              gap: "8px",
              fontSize: "12px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ color: "#94A3B8" }}>document.modelContext:</span>
              <span style={{ color: isNativeWebMCP ? "#22C55E" : "#EAB308", fontWeight: 700 }}>
                {isNativeWebMCP ? "Native Chrome WebMCP" : "Compatibility Mode"}
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ color: "#94A3B8" }}>Registered Tools:</span>
              <span style={{ fontWeight: 700 }}>{registeredTools.length} tools active</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ color: "#94A3B8" }}>Provider:</span>
              <span style={{ color: "#CBD5E1" }}>{providerName}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ color: "#94A3B8" }}>Build SHA:</span>
              <span style={{ color: "#4967FF", fontWeight: 700 }}>{buildSha}</span>
            </div>
          </div>

          {/* Copyable Console Snippet */}
          <div
            onClick={copySnippet}
            style={{
              background: "#111827",
              border: "1px solid #1F2937",
              borderRadius: "6px",
              padding: "6px 10px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              cursor: "pointer",
              fontSize: "11px",
              color: "#A5B4FC",
            }}
          >
            <span>await document.modelContext.getTools()</span>
            {copiedSnippet ? <Check size={13} color="#22C55E" /> : <Copy size={13} />}
          </div>
        </div>

        {/* Scenario Truth Status */}
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <div style={{ fontSize: "11px", fontWeight: 700, color: "#94A3B8", textTransform: "uppercase" }}>
            SCENARIO FIREWALL
          </div>
          <div
            style={{
              background: "#1E293B",
              borderRadius: "8px",
              padding: "10px 12px",
              fontSize: "12px",
              display: "flex",
              flexDirection: "column",
              gap: "6px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ color: "#94A3B8" }}>Scenario ID:</span>
              <span style={{ color: activeScenario ? "#38BDF8" : "#64748B", fontWeight: 700 }}>
                {activeScenario ? activeScenario.sessionId : "None active"}
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ color: "#94A3B8" }}>Ground Truth:</span>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                  color: activeScenario?.isSealed ? "#EAB308" : "#22C55E",
                  fontWeight: 700,
                }}
              >
                {activeScenario?.isSealed ? <Lock size={11} /> : <Eye size={11} />}
                {activeScenario?.isSealed ? "SEALED FROM AGENT CONTEXT" : "UNSEALED / VERIFIED"}
              </span>
            </div>
            <div style={{ fontSize: "10.5px", color: "#64748B", lineHeight: 1.4, marginTop: "2px" }}>
              Ground truth remains outside model prompts, tool schemas, and agent-visible results until verification.
            </div>
          </div>
        </div>

        {/* Diagnostic Store IDs */}
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <div style={{ fontSize: "11px", fontWeight: 700, color: "#94A3B8", textTransform: "uppercase" }}>
            ACTIVE DOMAIN IDS
          </div>
          <div
            style={{
              background: "#1E293B",
              borderRadius: "8px",
              padding: "10px 12px",
              fontSize: "12px",
              display: "flex",
              flexDirection: "column",
              gap: "6px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "#94A3B8" }}>Active Experiment:</span>
              <span>{activeExperimentId ?? "none"}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "#94A3B8" }}>Evidence Count:</span>
              <span>{evidenceRecords.length} ({evidenceRecords.map((e) => e.id).join(", ") || "none"})</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "#94A3B8" }}>Hypotheses Count:</span>
              <span>{hypotheses.length} ({hypotheses.map((h) => h.id).join(", ") || "none"})</span>
            </div>
          </div>
        </div>

        {/* Registered Tools Mesh */}
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <div style={{ fontSize: "11px", fontWeight: 700, color: "#94A3B8", textTransform: "uppercase" }}>
            REGISTERED WEBMCP TOOLS ({registeredTools.length})
          </div>
          <div
            style={{
              background: "#1E293B",
              borderRadius: "8px",
              padding: "8px",
              display: "flex",
              flexDirection: "column",
              gap: "4px",
              maxHeight: "220px",
              overflowY: "auto",
            }}
          >
            {registeredTools.map((tool) => {
              const execClass = classifyTool(tool.name, tool.annotations);
              const badgeColor =
                execClass === "physical"
                  ? "#EAB308"
                  : execClass === "reason"
                  ? "#A855F7"
                  : execClass === "human_request"
                  ? "#F97316"
                  : "#38BDF8";

              return (
                <div
                  key={tool.name}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "4px 6px",
                    borderRadius: "4px",
                    background: "#0F172A",
                    fontSize: "11px",
                  }}
                >
                  <span style={{ color: "#E2E8F0" }}>{tool.name}</span>
                  <span
                    style={{
                      fontSize: "9.5px",
                      fontWeight: 700,
                      padding: "2px 5px",
                      borderRadius: "3px",
                      background: "rgba(255,255,255,0.06)",
                      color: badgeColor,
                    }}
                  >
                    {execClass}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Latest Tool Output */}
        {latestToolResult && (
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <div style={{ fontSize: "11px", fontWeight: 700, color: "#94A3B8", textTransform: "uppercase" }}>
              LATEST RAW TOOL EXECUTION ({latestToolResult.toolName})
            </div>
            <pre
              style={{
                background: "#020617",
                border: "1px solid #1E293B",
                borderRadius: "8px",
                padding: "8px 10px",
                fontSize: "10.5px",
                color: "#E2E8F0",
                maxHeight: "140px",
                overflowY: "auto",
                whiteSpace: "pre-wrap",
                wordBreak: "break-all",
                margin: 0,
              }}
            >
              {latestToolResult.result}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
};
