/**
 * Developer Inspector Component.
 * Provides technical verification of WebMCP compliance, document.modelContext status,
 * protocol messages, and diagnostic state without cluttering user experience.
 * Shortcut: Cmd/Ctrl + Shift + D
 */

import React, { useEffect, useMemo, useState } from "react";
import { X, Copy, Check, Terminal, Lock, Eye } from "lucide-react";
import type { RegisteredTool } from "@/infrastructure/webmcp/types";
import type { ScenarioSession } from "@/domain/scenario/types";
import type { EvidenceRecord } from "@/domain/evidence/types";
import type { Hypothesis } from "@/domain/hypothesis/types";
import { classifyTool } from "@/domain/safety/tool-safety-policy";

interface InspectorRegisteredTool {
  readonly name: string;
  readonly description?: string;
  readonly readOnly?: boolean;
  readonly inputSchema?: RegisteredTool["inputSchema"];
  readonly annotations?: RegisteredTool["annotations"];
}

export interface DeveloperInspectorProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly isNativeWebMCP: boolean;
  readonly registeredTools: readonly InspectorRegisteredTool[];
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
  providerName = "External WebMCP agent",
}) => {
  const [copiedSnippet, setCopiedSnippet] = useState(false);
  const [discoveredTools, setDiscoveredTools] = useState<readonly RegisteredTool[]>([]);
  useEffect(() => {
    if (!isOpen || typeof document === "undefined") {
      return;
    }

    let cancelled = false;
    const modelContext = window.__agentModelContext ?? document.modelContext;
    if (!modelContext || typeof modelContext.getTools !== "function") {
      setDiscoveredTools([]);
      return;
    }

    void modelContext
      .getTools()
      .then((tools) => {
        if (!cancelled) setDiscoveredTools(tools);
      })
      .catch(() => {
        if (!cancelled) setDiscoveredTools([]);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, registeredTools]);
  const schemaByToolName = useMemo<Readonly<Record<string, RegisteredTool["inputSchema"]>>>(
    () => Object.fromEntries(discoveredTools.map((tool) => [tool.name, tool.inputSchema])),
    [discoveredTools],
  );
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
        {/* Hardware Control Plane */}
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <div style={{ fontSize: "11px", fontWeight: 700, color: "#94A3B8", textTransform: "uppercase" }}>
            HARDWARE CONTROL PLANE
          </div>
          <div
            style={{
              background: "#1E293B",
              borderRadius: "8px",
              padding: "10px 12px",
              fontSize: "11.5px",
              color: "#CBD5E1",
              lineHeight: 1.45,
            }}
          >
            <div>
              Physical mode is implemented over Web Serial. Device capabilities are discovered from the connected hardware descriptor and mapped through Ohmni's trusted instrument registry.
            </div>
            <div style={{ marginTop: "6px", fontSize: "10.5px", color: "#94A3B8" }}>
              Automated tests verify the serial protocol path with a simulated peer. Electrical behavior still requires testing with an attached physical board.
            </div>
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
              const execClass = classifyTool(tool.name, {
                ...tool.annotations,
                readOnlyHint: tool.annotations?.readOnlyHint ?? tool.readOnly,
              });
              const inputSchema = tool.inputSchema ?? schemaByToolName[tool.name];
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
                    padding: "4px 6px",
                    borderRadius: "4px",
                    background: "#0F172A",
                    fontSize: "11px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
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
                  {inputSchema && (
                    <details style={{ marginTop: "4px", color: "#94A3B8" }}>
                      <summary style={{ cursor: "pointer", fontSize: "10px" }}>Input schema</summary>
                      <pre
                        style={{
                          margin: "6px 0 2px",
                          padding: "6px",
                          borderRadius: "4px",
                          background: "#020617",
                          color: "#CBD5E1",
                          fontSize: "9.5px",
                          overflowX: "auto",
                          whiteSpace: "pre-wrap",
                        }}
                      >
                        {JSON.stringify(inputSchema, null, 2)}
                      </pre>
                    </details>
                  )}
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
