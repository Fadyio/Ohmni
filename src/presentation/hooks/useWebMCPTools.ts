/**
 * Hook to observe WebMCP document.modelContext tools and lifecycle changes.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import type { ModelContext, RegisteredTool } from "@/infrastructure/webmcp/types";

export interface WebMCPToolInfo {
  readonly name: string;
  readonly title?: string;
  readonly description?: string;
  readonly readOnly?: boolean;
}

export interface WebMCPState {
  readonly tools: readonly WebMCPToolInfo[];
  readonly toolCount: number;
  readonly isNative: boolean;
  readonly isDiscovering: boolean;
  readonly hasModelContext: boolean;
  readonly investigationToolCount: number;
  readonly deviceToolCount: number;
}

const DEVICE_TOOL_NAMES = new Set([
  "read_device_info",
  "read_reset_history",
  "read_system_health",
  "measure_supply_voltage",
  "scan_i2c_bus",
  "read_sensor_status",
  "read_i2c_line_state",
  "run_relay_stress_test",
]);

export function subscribeToModelContextToolChanges(
  modelContext: ModelContext,
  listener: EventListener,
): () => void {
  if (typeof modelContext.addEventListener !== "function") {
    return () => undefined;
  }

  modelContext.addEventListener("toolchange", listener);
  return () => {
    if (typeof modelContext.removeEventListener === "function") {
      modelContext.removeEventListener("toolchange", listener);
    }
  };
}

export function useWebMCPTools(): WebMCPState {
  const [tools, setTools] = useState<WebMCPToolInfo[]>([]);
  const [isDiscovering, setIsDiscovering] = useState<boolean>(false);
  const prevCountRef = useRef<number>(0);
  const discoveryTimeoutRef = useRef<number | null>(null);

  const isNative = typeof window !== "undefined" && window.__modelContext === undefined;
  const hasModelContext = typeof document !== "undefined" && "modelContext" in document && Boolean(document.modelContext);

  const fetchTools = useCallback(async () => {
    if (typeof document === "undefined" || !document.modelContext) {
      setTools([]);
      return;
    }

    try {
      const discoveryContext = window.__agentModelContext ?? document.modelContext;
      if (typeof discoveryContext.getTools !== "function") {
        setTools([]);
        return;
      }
      const rawTools = await discoveryContext.getTools();
      const mapped: WebMCPToolInfo[] = (rawTools || []).map((t: RegisteredTool) => ({
        name: t.name,
        title: t.title,
        description: t.description,
        readOnly: t.annotations?.readOnlyHint ?? false,
      }));

      const newCount = mapped.length;
      if (prevCountRef.current === 0 && newCount > 0) {
        setIsDiscovering(true);
        if (discoveryTimeoutRef.current !== null) {
          clearTimeout(discoveryTimeoutRef.current);
        }
        discoveryTimeoutRef.current = window.setTimeout(() => {
          setIsDiscovering(false);
        }, 800);
      } else if (newCount === 0) {
        setIsDiscovering(false);
      }

      prevCountRef.current = newCount;
      setTools(mapped);
    } catch {
      setTools([]);
    }
  }, []);

  useEffect(() => {
    fetchTools();

    if (typeof document !== "undefined" && document.modelContext) {
      const mc = window.__agentModelContext ?? document.modelContext;
      const onToolChange = () => {
        fetchTools();
      };

      const unsubscribe = subscribeToModelContextToolChanges(mc, onToolChange);
      const pollId =
        typeof mc.addEventListener === "function"
          ? null
          : window.setInterval(() => void fetchTools(), 500);
      return () => {
        unsubscribe();
        if (pollId !== null) window.clearInterval(pollId);
        if (discoveryTimeoutRef.current !== null) {
          clearTimeout(discoveryTimeoutRef.current);
        }
      };
    }
  }, [fetchTools]);

  return {
    tools,
    toolCount: tools.length,
    isNative,
    isDiscovering,
    hasModelContext,
    investigationToolCount: tools.filter((tool) => !DEVICE_TOOL_NAMES.has(tool.name)).length,
    deviceToolCount: tools.filter((tool) => DEVICE_TOOL_NAMES.has(tool.name)).length,
  };
}
