/**
 * WebMCP Capability Inspector Modal / Flyout.
 * Secondary debug & protocol inspection view.
 * Categorizes the dynamic tool surface with truthful product taxonomy:
 * - OBSERVE: Read-only physical sensors & telemetry.
 * - REASON: Agent evidence extraction & hypothesis synthesis.
 * - PHYSICAL TEST: Controlled hardware stress actuation (requires human approval).
 */

import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Radio,
  X,
  Search,
  Cpu,
  Zap,
  Lightbulb,
  ShieldAlert,
  Layers,
  Terminal,
  FileCode,
} from "lucide-react";
import type { WebMCPToolInfo } from "../../hooks/useWebMCPTools";

interface WebMCPCapabilityDrawerProps {
  readonly isOpen: boolean;
  readonly tools: readonly WebMCPToolInfo[];
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
  const [filterCategory, setFilterCategory] = useState<"all" | "observe" | "reason" | "actuation">("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const getToolCategory = (toolName: string): "observe" | "reason" | "actuation" => {
    if (toolName === "run_relay_stress_test") return "actuation";
    if (
      toolName.includes("hypothesis") ||
      toolName.includes("evidence")
    ) {
      return "reason";
    }
    return "observe";
  };

  const getCategoryBadge = (category: "observe" | "reason" | "actuation") => {
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
      case "actuation":
        return {
          label: "PHYSICAL TEST",
          color: "var(--ohmni-warning)",
          bg: "rgba(244, 184, 96, 0.12)",
          border: "rgba(244, 184, 96, 0.25)",
        };
    }
  };

  const filteredTools = tools.filter((t) => {
    const category = getToolCategory(t.name);
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
                    WebMCP Agent Instrument Inspector
                  </div>
                  <div className="metadata-text">
                    {tools.length} Dynamic Tools Materialized into <code className="font-mono">document.modelContext</code>
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
              {/* Category Pills */}
              <div style={{ display: "flex", gap: "6px" }}>
                {[
                  { key: "all", label: `All (${tools.length})` },
                  { key: "observe", label: "Observe" },
                  { key: "reason", label: "Reason" },
                  { key: "actuation", label: "Physical Test" },
                ].map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setFilterCategory(tab.key as any)}
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
                  const category = getToolCategory(tool.name);
                  const badge = getCategoryBadge(category);
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
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer */}
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
                Protocol: W3C Model Context Protocol • Runtime: Chromium Native
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
