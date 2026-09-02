/**
 * Event Timeline & WebMCP Tool Activity Component.
 * Collapsible bottom strip that automatically expands during active experiments
 * and provides chronological semantic event tracking with relative timestamps (+ms).
 */

import React, { useState, useEffect } from "react";
import {
  Activity,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import type { TimelineEventItem, WebMCPCallInfo } from "../../hooks/useExperimentTimeline";

interface EventTimelineProps {
  readonly events: readonly TimelineEventItem[];
  readonly lastCallInfo: WebMCPCallInfo | null;
  readonly highlightedExperimentId?: string | null;
  readonly isRunning?: boolean;
}

export const EventTimeline: React.FC<EventTimelineProps> = ({
  events,
  lastCallInfo,
  highlightedExperimentId,
  isRunning = false,
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(false);

  // Auto-expand during an active experiment
  useEffect(() => {
    if (isRunning) {
      setIsExpanded(true);
    }
  }, [isRunning]);

  const eventCount = events.length;

  return (
    <div
      style={{
        background: "var(--ohmni-surface)",
        borderTop: "1px solid var(--ohmni-border)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* Strip Header / Toggle Bar */}
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 1.25rem",
          height: "42px",
          minHeight: "42px",
          cursor: "pointer",
          userSelect: "none",
          background: isExpanded ? "var(--ohmni-surface-raised)" : "var(--ohmni-surface)",
          borderBottom: isExpanded ? "1px solid var(--ohmni-border-subtle)" : "none",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <Activity size={14} color="var(--ohmni-brand-hover)" />
          <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--ohmni-text-primary)" }}>
            EXPERIMENT TIMELINE
          </span>
          <span
            className="font-mono"
            style={{
              fontSize: "11px",
              padding: "2px 7px",
              borderRadius: "var(--radius-full)",
              background: eventCount > 0 ? "rgba(53, 198, 244, 0.12)" : "rgba(102, 112, 133, 0.15)",
              color: eventCount > 0 ? "var(--ohmni-signal)" : "var(--ohmni-text-muted)",
              fontWeight: 600,
            }}
          >
            {eventCount} {eventCount === 1 ? "event" : "events"}
          </span>

          {isRunning && (
            <span
              style={{
                fontSize: "11px",
                color: "var(--ohmni-signal)",
                fontWeight: 600,
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
              }}
            >
              <span
                style={{
                  width: "6px",
                  height: "6px",
                  borderRadius: "50%",
                  background: "var(--ohmni-signal)",
                  boxShadow: "0 0 6px var(--ohmni-signal)",
                }}
              />
              RECORDING TELEMETRY...
            </span>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span className="metadata-text">
            {isExpanded ? "Click to collapse" : "Click to view event stream"}
          </span>
          {isExpanded ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
        </div>
      </div>

      {/* Expanded Content Area with zero-reflow CSS Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateRows: isExpanded ? "1fr" : "0fr",
          transition: "grid-template-rows 0.22s var(--ease-workbench)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            minHeight: 0,
            height: "118px",
            display: "grid",
            gridTemplateColumns: "1fr 300px",
            overflow: "hidden",
          }}
        >
          {/* Events Stream List */}
          <div
            style={{
              overflowY: "auto",
              padding: "8px 1.25rem",
              display: "flex",
              flexDirection: "column",
              gap: "4px",
            }}
          >
            {events.length === 0 ? (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  height: "100%",
                  color: "var(--ohmni-text-muted)",
                  fontSize: "12px",
                }}
              >
                No telemetry events recorded yet. Run a diagnostic experiment to acquire events.
              </div>
            ) : (
              events.map((evt) => {
                const isFault = evt.isFault || evt.type === "reset" || evt.type === "brownout";
                const isRelay = evt.type === "relay";
                return (
                  <div
                    key={evt.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      padding: "4px 8px",
                      borderRadius: "var(--radius-sm)",
                      background: isFault
                        ? "rgba(255, 93, 104, 0.08)"
                        : "var(--ohmni-surface-raised)",
                      border: `1px solid ${
                        isFault ? "rgba(255, 93, 104, 0.25)" : "var(--ohmni-border-subtle)"
                      }`,
                      fontSize: "12px",
                    }}
                  >
                    <span
                      className="font-mono"
                      style={{
                        fontSize: "11px",
                        color: "var(--ohmni-text-muted)",
                        minWidth: "60px",
                      }}
                    >
                      +{evt.relativeMs.toFixed(0)} ms
                    </span>

                    <span
                      style={{
                        fontSize: "11px",
                        fontWeight: 600,
                        color: isFault
                          ? "var(--ohmni-fault)"
                          : isRelay
                          ? "var(--ohmni-warning)"
                          : "var(--ohmni-signal)",
                        minWidth: "90px",
                      }}
                    >
                      {evt.title}
                    </span>

                    <span style={{ color: "var(--ohmni-text-secondary)", flex: 1 }}>
                      {evt.details || ""}
                    </span>
                  </div>
                );
              })
            )}
          </div>

          {/* Right: Last WebMCP Tool Invocation Card */}
          <div
            style={{
              borderLeft: "1px solid var(--ohmni-border)",
              padding: "8px 12px",
              background: "var(--ohmni-surface-raised)",
              display: "flex",
              flexDirection: "column",
              gap: "6px",
              overflowY: "auto",
            }}
          >
            <div className="metadata-text" style={{ textTransform: "uppercase", letterSpacing: "0.05em" }}>
              ACTIVE INSTRUMENT CALL
            </div>

            {lastCallInfo ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <div
                  className="font-mono"
                  style={{
                    fontSize: "12px",
                    fontWeight: 700,
                    color: "var(--ohmni-brand-hover)",
                  }}
                >
                  {lastCallInfo.toolName}
                </div>
                <div className="metadata-text">
                  Status: <strong style={{ color: "var(--ohmni-text-primary)" }}>{lastCallInfo.status}</strong>
                </div>
              </div>
            ) : (
              <div className="metadata-text" style={{ fontStyle: "italic" }}>
                No active WebMCP tool call.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
