/**
 * Virtual Bench Controls Component.
 * Safe developer controls for exercising instrumentation and WebMCP tool pathways.
 */

import React, { useState } from "react";
import { Sliders, Zap } from "lucide-react";
import type { DeviceAdapter } from "@/domain/device/adapter";
import type { DeviceToolRegistrar } from "@/infrastructure/webmcp/device-tool-registrar";
import type { ExperimentSummary, ExperimentStatus } from "@/domain/experiment/types";

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
          registrar.unregisterDevice(adapter);
        }
        await onDisconnect();
      } else {
        await onConnect();
        if (adapter && registrar) {
          await registrar.registerDevice(adapter);
        }
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Connection toggle failed");
    }
  };

  /**
   * Executes the relay stress test strictly through the WebMCP tool surface.
   */
  const handleRunRelayStressTest = async () => {
    if (!isConnected || isExecuting) return;
    setErrorMsg(null);
    setIsExecuting(true);

    const expId = `exp_${Date.now()}`;
    const startTime = performance.now();

    onExperimentStart("run_relay_stress_test", expId, 3);

    try {
      const doc = document as any;
      if (!doc.modelContext) {
        throw new Error("document.modelContext is not available in this browser session.");
      }

      const tools = await doc.modelContext.getTools();
      const stressTool = tools.find((t: any) => t.name === "run_relay_stress_test");

      if (!stressTool) {
        throw new Error("run_relay_stress_test is not registered in document.modelContext");
      }

      const result = await doc.modelContext.executeTool("run_relay_stress_test", {
        cycles: 3,
        durationMs: 50,
      });

      const durationMs = performance.now() - startTime;
      const resultData = (result?.data ?? result) as Record<string, unknown>;
      const status: ExperimentStatus = "completed";

      const summary: ExperimentSummary = {
        experiment_id: expId,
        status,
        test: "run_relay_stress_test",
        repetitions: 3,
        failures: resultData.faultReproduced ? 1 : 0,
        unexpected_resets: resultData.resetOccurred ? 1 : 0,
        supply_voltage: {
          baseline_v: (resultData.baselineVoltage as number) ?? 3.31,
          minimum_v: (resultData.minVoltage as number) ?? 2.72,
          drop_v: ((resultData.baselineVoltage as number) ?? 3.31) - ((resultData.minVoltage as number) ?? 2.72),
        },
        faultReproduced: Boolean(resultData.faultReproduced),
        resetOccurred: Boolean(resultData.resetOccurred),
        resetReason: (resultData.resetReason as any) ?? "NONE",
      };
      onExperimentComplete(summary, durationMs);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Stress test failed";
      setErrorMsg(msg);
    } finally {
      setIsExecuting(false);
    }
  };

  /**
   * Executes read-only health checks through WebMCP.
   */
  const handleRunHealthCheck = async () => {
    if (!isConnected || isExecuting) return;
    setErrorMsg(null);
    try {
      const doc = document as any;
      if (doc.modelContext) {
        await doc.modelContext.executeTool("read_system_health", {});
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Health check failed");
    }
  };

  return (
    <div
      style={{
        padding: "10px 14px",
        background: "var(--ohmni-surface-raised)",
        border: "1px solid var(--ohmni-border)",
        borderRadius: "var(--radius-lg)",
        display: "flex",
        flexDirection: "column",
        gap: "8px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <Sliders size={13} color="var(--ohmni-brand-hover)" />
          <span className="metadata-text" style={{ fontWeight: 600, color: "var(--ohmni-text-primary)" }}>
            INSTRUMENTATION CONTROLS
          </span>
          <span
            className="font-mono"
            style={{
              fontSize: "10px",
              padding: "2px 6px",
              borderRadius: "var(--radius-xs)",
              background: "rgba(148, 163, 184, 0.1)",
              color: "var(--ohmni-text-muted)",
              border: "1px solid var(--ohmni-border-subtle)",
            }}
          >
            WebMCP DISPATCHER
          </span>
        </div>

        <span className="metadata-text">
          Direct Tool Execution
        </span>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
        {/* Connect / Disconnect Toggle Button */}
        <button
          onClick={handleToggleConnection}
          disabled={isExecuting}
          className="btn-secondary"
          style={{
            fontSize: "12px",
            padding: "6px 12px",
            color: isConnected ? "var(--ohmni-fault)" : "var(--ohmni-success)",
            borderColor: isConnected ? "rgba(255, 93, 104, 0.3)" : "rgba(53, 211, 154, 0.3)",
          }}
        >
          {isConnected ? "Disconnect Device" : "Connect Virtual Device"}
        </button>

        {/* Real WebMCP Relay Stress Test Button */}
        <button
          onClick={handleRunRelayStressTest}
          disabled={!isConnected || isExecuting}
          className="btn-primary"
          style={{
            fontSize: "12px",
            padding: "6px 12px",
            background: isConnected && !isExecuting ? "var(--ohmni-warning-dim)" : undefined,
            borderColor: isConnected && !isExecuting ? "var(--ohmni-warning)" : undefined,
            color: "#FFFFFF",
          }}
        >
          <Zap size={13} fill="currentColor" />
          {isExecuting ? "Executing WebMCP..." : "Run Relay Stress Test"}
        </button>

        {/* Read-Only Health Check */}
        <button
          onClick={handleRunHealthCheck}
          disabled={!isConnected || isExecuting}
          className="btn-secondary"
          style={{
            fontSize: "12px",
            padding: "6px 12px",
          }}
        >
          Read Health
        </button>
      </div>

      {errorMsg && (
        <div
          className="font-mono metadata-text"
          style={{
            color: "var(--ohmni-fault)",
            background: "rgba(255, 93, 104, 0.08)",
            padding: "4px 8px",
            borderRadius: "var(--radius-sm)",
            border: "1px solid rgba(255, 93, 104, 0.2)",
          }}
        >
          {errorMsg}
        </div>
      )}
    </div>
  );
};
