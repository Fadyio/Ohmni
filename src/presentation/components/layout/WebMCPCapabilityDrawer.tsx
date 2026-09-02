/**
 * WebMCP Capability Drawer / Staggered Tool Discovery List.
 * Shows the dynamic tool surface materialized into document.modelContext.
 */

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { WebMCPToolInfo } from "../../hooks/useWebMCPTools";
import {
  toolContainerVariants,
  toolItemVariants,
  microTransition,
} from "../motion/transitions";

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
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: -6, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -4, scale: 0.98 }}
          transition={microTransition}
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            right: "0",
            width: "360px",
            background: "var(--ohmni-surface-overlay)",
            border: "1px solid var(--ohmni-border)",
            borderRadius: "var(--radius-md)",
            boxShadow: "0 12px 32px rgba(0, 0, 0, 0.5), 0 0 0 1px var(--ohmni-border-subtle)",
            zIndex: 100,
            overflow: "hidden",
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: "10px 14px",
              background: "var(--ohmni-surface-raised)",
              borderBottom: "1px solid var(--ohmni-border)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span
                style={{
                  width: "6px",
                  height: "6px",
                  borderRadius: "50%",
                  background: tools.length > 0 ? "var(--ohmni-accent)" : "var(--ohmni-text-muted)",
                }}
              />
              <span className="label-technical" style={{ color: "var(--ohmni-text-primary)" }}>
                Active Agent Tool Surface
              </span>
            </div>
            <span
              className="font-mono"
              style={{
                fontSize: "0.6875rem",
                padding: "2px 6px",
                borderRadius: "var(--radius-sm)",
                background: isNative ? "rgba(16, 185, 129, 0.15)" : "rgba(56, 189, 248, 0.15)",
                color: isNative ? "var(--ohmni-success)" : "var(--ohmni-accent)",
                border: `1px solid ${isNative ? "rgba(16, 185, 129, 0.3)" : "rgba(56, 189, 248, 0.3)"}`,
              }}
            >
              {isNative ? "NATIVE WEBMCP" : "COMPATIBILITY MODE"}
            </span>
          </div>

          {/* Discovery Banner or Empty State */}
          <div style={{ padding: "12px 14px" }}>
            {isDiscovering && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "8px 10px",
                  marginBottom: "8px",
                  background: "rgba(56, 189, 248, 0.08)",
                  border: "1px dashed var(--ohmni-accent-dim)",
                  borderRadius: "var(--radius-sm)",
                  color: "var(--ohmni-accent)",
                  fontSize: "0.75rem",
                }}
              >
                <span
                  style={{
                    display: "inline-block",
                    width: "8px",
                    height: "8px",
                    borderRadius: "50%",
                    border: "2px solid var(--ohmni-accent)",
                    borderTopColor: "transparent",
                    animation: "spin 0.8s linear infinite",
                  }}
                />
                <span className="font-mono">DISCOVERING HARDWARE CAPABILITIES...</span>
              </motion.div>
            )}

            {tools.length === 0 && !isDiscovering ? (
              <div
                style={{
                  padding: "16px",
                  textAlign: "center",
                  color: "var(--ohmni-text-muted)",
                  fontSize: "0.75rem",
                }}
              >
                <div style={{ marginBottom: "4px" }}>0 device instruments available</div>
                <div style={{ fontSize: "0.6875rem", color: "var(--ohmni-text-disabled)" }}>
                  Connect a target hardware device to materialize WebMCP tools into the agent context.
                </div>
              </div>
            ) : (
              <motion.div
                variants={toolContainerVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                style={{ display: "flex", flexDirection: "column", gap: "6px" }}
              >
                {tools.map((tool) => {
                  const isActuation = !tool.readOnly;
                  return (
                    <motion.div
                      key={tool.name}
                      variants={toolItemVariants}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "8px 10px",
                        background: "var(--ohmni-surface)",
                        border: `1px solid ${isActuation ? "rgba(245, 158, 11, 0.25)" : "var(--ohmni-border-subtle)"}`,
                        borderRadius: "var(--radius-sm)",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span
                          style={{
                            color: isActuation ? "var(--ohmni-warning)" : "var(--ohmni-accent)",
                            fontWeight: 600,
                            fontFamily: "var(--font-mono)",
                            fontSize: "0.8125rem",
                          }}
                        >
                          +
                        </span>
                        <div>
                          <div
                            className="font-mono"
                            style={{
                              fontSize: "0.75rem",
                              fontWeight: 500,
                              color: "var(--ohmni-text-primary)",
                            }}
                          >
                            {tool.name}
                          </div>
                          {tool.title && (
                            <div style={{ fontSize: "0.6875rem", color: "var(--ohmni-text-muted)" }}>
                              {tool.title}
                            </div>
                          )}
                        </div>
                      </div>

                      <span
                        className="font-mono"
                        style={{
                          fontSize: "0.625rem",
                          letterSpacing: "0.04em",
                          padding: "2px 5px",
                          borderRadius: "var(--radius-sm)",
                          background: isActuation
                            ? "rgba(245, 158, 11, 0.12)"
                            : "rgba(56, 189, 248, 0.1)",
                          color: isActuation ? "var(--ohmni-warning)" : "var(--ohmni-accent)",
                          border: `1px solid ${isActuation ? "rgba(245, 158, 11, 0.3)" : "rgba(56, 189, 248, 0.25)"}`,
                          textTransform: "uppercase",
                        }}
                      >
                        {isActuation ? "Actuation" : "Read-Only"}
                      </span>
                    </motion.div>
                  );
                })}
              </motion.div>
            )}
          </div>

          {/* Footer note */}
          <div
            style={{
              padding: "8px 14px",
              background: "var(--ohmni-surface-raised)",
              borderTop: "1px solid var(--ohmni-border-subtle)",
              fontSize: "0.6875rem",
              color: "var(--ohmni-text-muted)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <span>Live WebMCP Registry</span>
            <button
              onClick={onClose}
              style={{
                background: "transparent",
                border: "none",
                color: "var(--ohmni-text-secondary)",
                cursor: "pointer",
                fontSize: "0.6875rem",
                padding: "2px 6px",
                borderRadius: "var(--radius-sm)",
              }}
            >
              Close
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
