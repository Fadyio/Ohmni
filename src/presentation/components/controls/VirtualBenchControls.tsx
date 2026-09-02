/**
 * Virtual Bench Controls Component.
 * Safe developer controls for exercising instrumentation and WebMCP tool pathways.
 *
 * CRITICAL ARCHITECTURAL CONTRACT:
 * Actuation buttons invoke registered tools strictly through WebMCP
 * (document.modelContext.getTools() -> document.modelContext.executeTool()).
 * NEVER invokes VirtualDeviceAdapter.executeCapability() directly from the UI button.
 */

import React, { useState } from "react";
import type { DeviceAdapter } from "@/domain/device/adapter";
import type { DeviceToolRegistrar } from "@/infrastructure/webmcp/device-tool-registrar";
import type { RegisteredTool } from "@/infrastructure/webmcp/types";
import type { ExperimentSummary } from "@/domain/experiment/types";

interface VirtualBenchControlsProps {
  readonly adapter?: DeviceAdapter;
  readonly registrar?: DeviceToolRegistrar;
  readonly isConnected: boolean;
  readonly onConnect: () => Promise<void>;
  readonly onDisconnect: () => Promise<void>;
  readonly onExperimentStart: (toolName: string, expId: string, cycles: number) => void;
  readonly onExperimentComplete: (summary: ExperimentSummary, durationMs: number) => void;
  readonly onClearScope?: () => void;
}

export const VirtualBenchControls: React.FC<VirtualBenchControlsProps> = ({
  adapter,
  registrar,
  isConnected,
  onConnect,
  onDisconnect,
  onExperimentStart,
  onExperimentComplete,
  onClearScope,
}) => {
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleToggleConnection = async () => {
    setErrorMsg(null);
    try {
      if (isConnected) {
        if (adapter && registrar) {
          await adapter.disconnect();
          registrar.unregisterDevice(adapter);
        }
        await onDisconnect();
        if (onClearScope) onClearScope();
      } else {
        if (adapter && registrar) {
          await adapter.connect();
          await registrar.registerDevice(adapter);
        }
        await onConnect();
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMsg(`Connection error: ${msg}`);
    }
  };

  /**
   * Executes the relay stress test strictly through the WebMCP tool surface.
   */
  const handleRunRelayStressTest = async () => {
    if (typeof document === "undefined" || !document.modelContext) {
      setErrorMsg("WebMCP document.modelContext unavailable.");
      return;
    }

    setIsExecuting(true);
    setErrorMsg(null);
    const startTime = performance.now();

    try {
      // 1. Discover tools from active WebMCP context
      const tools = await document.modelContext.getTools();
      const relayTool = (tools || []).find((t: RegisteredTool) => t.name === "run_relay_stress_test");

      if (!relayTool) {
        throw new Error("Tool 'run_relay_stress_test' is not registered in document.modelContext");
      }

      const expTempId = `exp_${Date.now().toString(36)}`;
      onExperimentStart("run_relay_stress_test", expTempId, 3);

      // 2. Execute tool through WebMCP executeTool with valid JSON string arguments
      const argsPayload = JSON.stringify({ cycles: 3, duration_ms: 20 });
      const rawResult = await document.modelContext.executeTool(relayTool, argsPayload);

      const durationMs = Math.round(performance.now() - startTime);

      // 3. Parse result summary
      let parsedSummary: ExperimentSummary;
      if (typeof rawResult === "string") {
        try {
          parsedSummary = JSON.parse(rawResult);
        } catch {
          parsedSummary = {
            experiment_id: expTempId,
            status: "completed",
            test: "run_relay_stress_test",
            raw: rawResult,
          };
        }
      } else {
        parsedSummary = rawResult as ExperimentSummary;
      }

      onExperimentComplete(parsedSummary, durationMs);
    } catch (err) {
      const durationMs = Math.round(performance.now() - startTime);
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMsg(`Execution error: ${msg}`);

      onExperimentComplete(
        {
          experiment_id: `exp_err_${Date.now()}`,
          status: "failed",
          test: "run_relay_stress_test",
          message: msg,
        },
        durationMs
      );
    } finally {
      setIsExecuting(false);
    }
  };

  /**
   * Executes read-only health checks through WebMCP.
   */
  const handleRunHealthCheck = async () => {
    if (typeof document === "undefined" || !document.modelContext) return;
    try {
      const tools = await document.modelContext.getTools();
      const healthTool = (tools || []).find((t: RegisteredTool) => t.name === "read_system_health");
      if (healthTool) {
        await document.modelContext.executeTool(healthTool, "{}");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMsg(`Health check failed: ${msg}`);
    }
  };

  return (
    <div
      style={{
        padding: "12px 16px",
        background: "var(--ohmni-surface)",
        border: "1px solid var(--ohmni-border)",
        borderRadius: "var(--radius-md)",
        display: "flex",
        flexDirection: "column",
        gap: "8px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span className="label-technical">VIRTUAL BENCH CONTROLS</span>
          <span
            className="font-mono"
            style={{
              fontSize: "0.5625rem",
              padding: "2px 5px",
              borderRadius: "var(--radius-sm)",
              background: "rgba(148, 163, 184, 0.1)",
              color: "var(--ohmni-text-muted)",
              border: "1px solid var(--ohmni-border-subtle)",
            }}
          >
            VIRTUAL DEVICE
          </span>
        </div>

        <span style={{ fontSize: "0.6875rem", color: "var(--ohmni-text-muted)" }}>
          WebMCP Tool Dispatcher
        </span>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
        {/* Connect / Disconnect Toggle Button */}
        <button
          onClick={handleToggleConnection}
          disabled={isExecuting}
          style={{
            padding: "6px 14px",
            background: isConnected
              ? "rgba(239, 68, 68, 0.12)"
              : "rgba(16, 185, 129, 0.15)",
            border: `1px solid ${
              isConnected ? "rgba(239, 68, 68, 0.4)" : "rgba(16, 185, 129, 0.4)"
            }`,
            borderRadius: "var(--radius-sm)",
            color: isConnected ? "var(--ohmni-fault)" : "var(--ohmni-success)",
            fontWeight: 600,
            fontSize: "0.75rem",
            cursor: isExecuting ? "not-allowed" : "pointer",
            fontFamily: "var(--font-mono)",
            transition: "all var(--duration-micro)",
          }}
        >
          {isConnected ? "Disconnect Device" : "Connect Virtual Device"}
        </button>

        {/* Real WebMCP Relay Stress Test Button */}
        <button
          onClick={handleRunRelayStressTest}
          disabled={!isConnected || isExecuting}
          style={{
            padding: "6px 14px",
            background:
              isConnected && !isExecuting
                ? "rgba(245, 158, 11, 0.15)"
                : "var(--ohmni-surface-raised)",
            border: `1px solid ${
              isConnected && !isExecuting
                ? "rgba(245, 158, 11, 0.4)"
                : "var(--ohmni-border-subtle)"
            }`,
            borderRadius: "var(--radius-sm)",
            color:
              isConnected && !isExecuting
                ? "var(--ohmni-warning)"
                : "var(--ohmni-text-disabled)",
            fontWeight: 600,
            fontSize: "0.75rem",
            cursor: !isConnected || isExecuting ? "not-allowed" : "pointer",
            fontFamily: "var(--font-mono)",
            display: "flex",
            alignItems: "center",
            gap: "6px",
            transition: "all var(--duration-micro)",
          }}
        >
          {isExecuting ? (
            <>
              <span
                style={{
                  display: "inline-block",
                  width: "8px",
                  height: "8px",
                  borderRadius: "50%",
                  border: "2px solid var(--ohmni-warning)",
                  borderTopColor: "transparent",
                  animation: "spin 0.8s linear infinite",
                }}
              />
              Executing WebMCP Tool...
            </>
          ) : (
            "Run Relay Stress Test"
          )}
        </button>

        {/* Read-Only Health Check */}
        <button
          onClick={handleRunHealthCheck}
          disabled={!isConnected || isExecuting}
          style={{
            padding: "6px 12px",
            background: "var(--ohmni-surface-raised)",
            border: "1px solid var(--ohmni-border)",
            borderRadius: "var(--radius-sm)",
            color: isConnected ? "var(--ohmni-text-secondary)" : "var(--ohmni-text-disabled)",
            fontSize: "0.75rem",
            cursor: !isConnected || isExecuting ? "not-allowed" : "pointer",
            fontFamily: "var(--font-mono)",
          }}
        >
          Read Health
        </button>
      </div>

      {errorMsg && (
        <div
          className="font-mono"
          style={{
            fontSize: "0.6875rem",
            color: "var(--ohmni-fault)",
            background: "rgba(239, 68, 68, 0.08)",
            padding: "4px 8px",
            borderRadius: "var(--radius-sm)",
            border: "1px solid rgba(239, 68, 68, 0.2)",
          }}
        >
          {errorMsg}
        </div>
      )}
    </div>
  );
};
