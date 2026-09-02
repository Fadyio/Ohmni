/**
 * Hook to observe WebMCP document.modelContext tools and lifecycle changes.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import type { RegisteredTool } from "@/infrastructure/webmcp/types";

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
      const rawTools = await document.modelContext.getTools();
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
      const mc = document.modelContext;
      const onToolChange = () => {
        fetchTools();
      };

      mc.addEventListener("toolchange", onToolChange);
      return () => {
        mc.removeEventListener("toolchange", onToolChange);
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
  };
}
