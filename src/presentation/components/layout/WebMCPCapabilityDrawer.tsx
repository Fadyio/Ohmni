/**
 * WebMCP Capability Inspector Modal / Flyout.
 * Secondary debug & protocol inspection view.
 * Categorizes the dynamic tool surface with the runtime safety policy:
 * - OBSERVE and REASON tools run autonomously.
 * - HUMAN REQUEST tools pause for the operator to complete a physical task.
 * - PHYSICAL tools require explicit approval before actuation.
 */

import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Radio, X, Search } from "lucide-react";
import { classifyTool } from "@/domain/safety/tool-safety-policy";
import type { ToolExecutionClass } from "@/domain/safety/tool-safety-policy";
import type { RegisteredTool } from "@/infrastructure/webmcp/types";
import type { WebMCPToolInfo } from "../../hooks/useWebMCPTools";

type ToolCategory = ToolExecutionClass;
type ToolFilter = "all" | ToolCategory;

interface InspectorTool extends WebMCPToolInfo {
  readonly inputSchema?: Record<string, unknown>;
  readonly annotations?: { readonly readOnlyHint?: boolean };
}

interface WebMCPCapabilityDrawerProps {
  readonly isOpen: boolean;
  readonly tools: readonly InspectorTool[];
  readonly isDiscovering: boolean;
  readonly isNative: boolean;
  readonly onClose: () => void;
}

export const WebMCPCapabilityDrawer: React.FC<WebMCPCapabilityDrawerProps> = ({
  isOpen,
  tools,
  isDiscovering,
  isNative,
  onClose,
}) => {
  const [filterCategory, setFilterCategory] = useState<ToolFilter>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
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
      .then((registeredTools) => {
        if (!cancelled) setDiscoveredTools(registeredTools);
      })
      .catch(() => {
        if (!cancelled) setDiscoveredTools([]);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, tools]);

  const schemaByToolName = useMemo<Readonly<Record<string, RegisteredTool["inputSchema"]>>>(
    () => Object.fromEntries(discoveredTools.map((tool) => [tool.name, tool.inputSchema])),
    [discoveredTools],
  );

  const getToolCategory = (tool: InspectorTool): ToolCategory =>
    classifyTool(tool.name, {
      ...tool.annotations,
      readOnlyHint: tool.annotations?.readOnlyHint ?? tool.readOnly,
    });

  const getCategoryBadge = (category: ToolCategory) => {
    switch (category) {
      case "observe":
        return {
          label: "OBSERVE",
          color: "var(--ohmni-signal)",
          bg: "rgba(53, 198, 244, 0.12)",
          border: "rgba(53, 198, 244, 0.25)",
        };
      case "reason":
        return {
          label: "REASON",
          color: "var(--ohmni-brand-hover)",
          bg: "rgba(79, 107, 255, 0.12)",
          border: "rgba(79, 107, 255, 0.25)",
        };
      case "human_request":
        return {
          label: "HUMAN REQUEST",
          color: "#F97316",
          bg: "rgba(249, 115, 22, 0.12)",
          border: "rgba(249, 115, 22, 0.25)",
        };
      case "physical":
        return {
          label: "PHYSICAL · APPROVAL",
          color: "var(--ohmni-warning)",
          bg: "rgba(244, 184, 96, 0.12)",
          border: "rgba(244, 184, 96, 0.25)",
        };
    }
  };

  const filteredTools = tools.filter((t) => {
    const category = getToolCategory(t);
    if (filterCategory !== "all" && category !== filterCategory) return false;
    if (searchQuery.trim() !== "") {
      const q = searchQuery.toLowerCase();
      return t.name.toLowerCase().includes(q) || (t.description || "").toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(11, 14, 20, 0.75)",
            backdropFilter: "blur(8px)",
          }}
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "90%",
              maxWidth: "680px",
              maxHeight: "80vh",
              background: "var(--ohmni-surface-raised)",
              border: "1px solid var(--ohmni-border)",
              borderRadius: "var(--radius-xl)",
              display: "flex",
              flexDirection: "column",
              boxShadow: "0 24px 60px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(148, 163, 184, 0.1)",
              overflow: "hidden",
            }}
          >
            {/* Header */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "1rem 1.25rem",
                borderBottom: "1px solid var(--ohmni-border-subtle)",
                background: "var(--ohmni-surface)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div
                  style={{
                    width: "32px",
                    height: "32px",
                    borderRadius: "var(--radius-md)",
                    background: "rgba(79, 107, 255, 0.15)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "var(--ohmni-brand-hover)",
                  }}
                >
                  <Radio size={16} />
                </div>
                <div>
                  <div style={{ fontSize: "15px", fontWeight: 600, color: "var(--ohmni-text-primary)" }}>
                    Agent Tool Inspector
                  </div>
                  <div className="metadata-text">
                    {`${tools.length} runtime ${tools.length === 1 ? "tool" : "tools"} available to compatible agents${
                      isDiscovering ? " · refreshing…" : ""
                    }`}
                  </div>
                </div>
              </div>

              <button
                onClick={onClose}
                className="btn-secondary"
                style={{ padding: "6px", borderRadius: "var(--radius-full)" }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Filter & Search Bar */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "10px 1.25rem",
                borderBottom: "1px solid var(--ohmni-border-subtle)",
                gap: "12px",
                flexWrap: "wrap",
              }}
            >
              {/* Safety class filters */}
              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                {([
                  { key: "all", label: `All (${tools.length})` },
                  { key: "observe", label: "Observe" },
                  { key: "reason", label: "Reason" },
                  { key: "human_request", label: "Human request" },
                  { key: "physical", label: "Physical actuation" },
                ] satisfies readonly { key: ToolFilter; label: string }[]).map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setFilterCategory(tab.key)}
                    style={{
                      padding: "4px 10px",
                      borderRadius: "var(--radius-full)",
                      fontSize: "12px",
                      fontWeight: 500,
                      cursor: "pointer",
                      border: "1px solid",
                      background: filterCategory === tab.key ? "var(--ohmni-brand)" : "var(--ohmni-surface)",
                      color: filterCategory === tab.key ? "#FFFFFF" : "var(--ohmni-text-secondary)",
                      borderColor: filterCategory === tab.key ? "var(--ohmni-brand)" : "var(--ohmni-border-subtle)",
                      transition: "all 0.15s ease",
                    }}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Search input */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  background: "var(--ohmni-surface)",
                  border: "1px solid var(--ohmni-border-subtle)",
                  borderRadius: "var(--radius-sm)",
                  padding: "4px 8px",
                  maxWidth: "200px",
                }}
              >
                <Search size={13} color="var(--ohmni-text-muted)" />
                <input
                  type="text"
                  placeholder="Filter tools..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    background: "transparent",
                    border: "none",
                    outline: "none",
                    color: "var(--ohmni-text-primary)",
                    fontSize: "12px",
                    width: "100%",
                  }}
                />
              </div>
            </div>

            {/* Tool List Content */}
            <div
              style={{
                flex: 1,
                overflowY: "auto",
                padding: "1rem 1.25rem",
                display: "flex",
                flexDirection: "column",
                gap: "8px",
              }}
            >
              {filteredTools.length === 0 ? (
                <div
                  style={{
                    textAlign: "center",
                    padding: "2rem",
                    color: "var(--ohmni-text-muted)",
                    fontSize: "13px",
                  }}
                >
                  No instruments matching filter criteria.
                </div>
              ) : (
                filteredTools.map((tool) => {
                  const category = getToolCategory(tool);
                  const badge = getCategoryBadge(category);
                  const inputSchema = tool.inputSchema ?? schemaByToolName[tool.name];
                  return (
                    <div
                      key={tool.name}
                      style={{
                        background: "var(--ohmni-surface)",
                        border: "1px solid var(--ohmni-border-subtle)",
                        borderRadius: "var(--radius-md)",
                        padding: "10px 12px",
                        display: "flex",
                        flexDirection: "column",
                        gap: "4px",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span
                            className="font-mono"
                            style={{
                              fontSize: "13px",
                              fontWeight: 700,
                              color: "var(--ohmni-text-primary)",
                            }}
                          >
                            {tool.name}
                          </span>
                        </div>

                        <span
                          style={{
                            fontSize: "10px",
                            fontWeight: 700,
                            letterSpacing: "0.04em",
                            padding: "2px 8px",
                            borderRadius: "var(--radius-xs)",
                            background: badge.bg,
                            color: badge.color,
                            border: `1px solid ${badge.border}`,
                          }}
                        >
                          {badge.label}
                        </span>
                      </div>

                      <p
                        style={{
                          fontSize: "12px",
                          color: "var(--ohmni-text-secondary)",
                          margin: 0,
                          lineHeight: 1.4,
                        }}
                      >
                        {tool.description || "Hardware diagnostic instrument"}
                      </p>
                      {inputSchema && (
                        <details
                          style={{
                            marginTop: "4px",
                            borderTop: "1px solid var(--ohmni-border-subtle)",
                            paddingTop: "6px",
                          }}
                        >
                          <summary
                            style={{
                              cursor: "pointer",
                              color: "var(--ohmni-text-muted)",
                              fontSize: "11px",
                            }}
                          >
                            Input schema
                          </summary>
                          <pre
                            className="font-mono"
                            style={{
                              margin: "8px 0 0",
                              padding: "8px",
                              background: "var(--ohmni-surface-raised)",
                              borderRadius: "var(--radius-sm)",
                              color: "var(--ohmni-text-secondary)",
                              fontSize: "10px",
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
                })
              )}
            </div>

            {/* Footer */}
            {/* Web Serial Next Step Banner */}
            <div
              style={{
                padding: "0.75rem 1.25rem",
                background: "rgba(73, 103, 255, 0.08)",
                borderTop: "1px solid rgba(73, 103, 255, 0.2)",
                fontSize: "12px",
                color: "var(--ohmni-text-secondary, #94A3B8)",
                lineHeight: 1.45,
              }}
            >
              <div style={{ color: "var(--ohmni-text-primary, #F8FAFC)", fontWeight: 600 }}>
                Physical mode is implemented over Web Serial. Device capabilities are discovered from the connected hardware descriptor and mapped through Ohmni's trusted instrument registry.
              </div>
              <div style={{ marginTop: "4px", fontSize: "11px", color: "var(--ohmni-text-muted, #64748B)" }}>
                Automated tests verify the serial protocol path with a simulated peer. Electrical behavior still requires testing with an attached physical board.
              </div>
            </div>
            <div
              style={{
                padding: "8px 1.25rem",
                borderTop: "1px solid var(--ohmni-border-subtle)",
                background: "var(--ohmni-surface)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <span className="metadata-text">
                {isNative
                  ? "API: WebMCP · document.modelContext · Runtime: Chromium native"
                  : "API: WebMCP compatibility layer · Runtime: local browser context"}
              </span>
              <button
                onClick={onClose}
                className="btn-secondary"
                style={{ padding: "4px 12px", fontSize: "12px" }}
              >
                Close
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
