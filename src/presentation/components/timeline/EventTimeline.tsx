/**
 * Event Timeline & WebMCP Tool Activity Component.
 * Displays chronological semantic events with relative timestamps (+ms)
 * and explicit visual connection between agent WebMCP tool calls and physical telemetry.
 */

import React from "react";
import type { TimelineEventItem, WebMCPCallInfo } from "../../hooks/useExperimentTimeline";

interface EventTimelineProps {
  readonly events: readonly TimelineEventItem[];
  readonly lastCallInfo: WebMCPCallInfo | null;
}

export const EventTimeline: React.FC<EventTimelineProps> = ({
  events,
  lastCallInfo,
}) => {
  return (
    <div
      style={{
        height: "180px",
        minHeight: "180px",
        background: "var(--ohmni-surface)",
        borderTop: "1px solid var(--ohmni-border)",
        display: "grid",
        gridTemplateColumns: "1fr 340px",
        overflow: "hidden",
      }}
    >
      {/* Left: Chronological Semantic Event Stream */}
      <div
        style={{
          borderRight: "1px solid var(--ohmni-border)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Timeline Header */}
        <div
          style={{
            padding: "8px 16px",
            background: "var(--ohmni-surface-raised)",
            borderBottom: "1px solid var(--ohmni-border-subtle)",
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
                background: "var(--ohmni-accent)",
              }}
            />
            <span className="label-technical">CHRONOLOGICAL EVENT TIMELINE</span>
          </div>
          <span className="font-mono" style={{ fontSize: "0.625rem", color: "var(--ohmni-text-muted)" }}>
            {events.length} {events.length === 1 ? "EVENT" : "EVENTS"} LOGGED
          </span>
        </div>

        {/* Scrollable Event List */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "8px 16px",
            display: "flex",
            flexDirection: "column",
            gap: "6px",
          }}
        >
          {events.length === 0 ? (
            <div
              style={{
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--ohmni-text-muted)",
                fontSize: "0.75rem",
              }}
            >
              No experiment events recorded. Start an actuation experiment to stream telemetry.
            </div>
          ) : (
            events.map((evt) => {
              const isFault = evt.isFault || evt.type === "reset" || evt.type === "brownout";
              const isRelay = evt.type === "relay";
              const timeFormatted = new Date(evt.timestamp).toISOString().substring(11, 23);

              return (
                <div
                  key={evt.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "4px 8px",
                    background: isFault
                      ? "rgba(239, 68, 68, 0.08)"
                      : "var(--ohmni-surface-raised)",
                    border: `1px solid ${
                      isFault
                        ? "rgba(239, 68, 68, 0.3)"
                        : isRelay
                        ? "rgba(245, 158, 11, 0.2)"
                        : "var(--ohmni-border-subtle)"
                    }`,
                    borderRadius: "var(--radius-sm)",
                    fontSize: "0.75rem",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <span
                      className="font-mono"
                      style={{
                        fontSize: "0.6875rem",
                        color: "var(--ohmni-text-muted)",
                        minWidth: "75px",
                      }}
                    >
                      {timeFormatted}
                    </span>

                    <span
                      className="font-mono"
                      style={{
                        fontSize: "0.6875rem",
                        fontWeight: 600,
                        color: isFault ? "var(--ohmni-fault)" : "var(--ohmni-accent)",
                        minWidth: "60px",
                      }}
                    >
                      +{evt.relativeMs} ms
                    </span>

                    <span
                      style={{
                        fontWeight: isFault ? 600 : 500,
                        color: isFault ? "var(--ohmni-fault)" : "var(--ohmni-text-primary)",
                      }}
                    >
                      {evt.title}
                    </span>
                  </div>

                  {evt.details && (
                    <span
                      className="font-mono"
                      style={{
                        fontSize: "0.6875rem",
                        color: isFault ? "var(--ohmni-fault-dim)" : "var(--ohmni-text-muted)",
                      }}
                    >
                      {evt.details}
                    </span>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Right: WebMCP Tool Invocation Card */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "8px 14px",
            background: "var(--ohmni-surface-raised)",
            borderBottom: "1px solid var(--ohmni-border-subtle)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span className="label-technical">WEBMCP TOOL INVOCATION</span>
          <span
            className="font-mono"
            style={{
              fontSize: "0.625rem",
              color: lastCallInfo ? "var(--ohmni-accent)" : "var(--ohmni-text-disabled)",
            }}
          >
            {lastCallInfo ? "CAPTURED" : "IDLE"}
          </span>
        </div>

        <div style={{ flex: 1, padding: "10px 14px", overflowY: "auto" }}>
          {lastCallInfo ? (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "8px",
                background: "var(--ohmni-surface-raised)",
                border: "1px solid var(--ohmni-border)",
                borderRadius: "var(--radius-sm)",
                padding: "10px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span
                  className="font-mono"
                  style={{
                    fontSize: "0.75rem",
                    fontWeight: 700,
                    color: "var(--ohmni-warning)",
                  }}
                >
                  {lastCallInfo.toolName}
                </span>
                <span
                  className="font-mono"
                  style={{
                    fontSize: "0.625rem",
                    padding: "2px 5px",
                    borderRadius: "var(--radius-sm)",
                    background: "rgba(16, 185, 129, 0.12)",
                    color: "var(--ohmni-success)",
                    border: "1px solid rgba(16, 185, 129, 0.3)",
                    textTransform: "uppercase",
                  }}
                >
                  {lastCallInfo.status}
                </span>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
                <div>
                  <div className="label-technical" style={{ fontSize: "0.5625rem" }}>
                    EXPERIMENT ID
                  </div>
                  <div
                    className="font-mono"
                    style={{ fontSize: "0.6875rem", color: "var(--ohmni-text-secondary)" }}
                    title={lastCallInfo.experimentId}
                  >
                    {lastCallInfo.experimentId.slice(0, 14)}...
                  </div>
                </div>

                <div>
                  <div className="label-technical" style={{ fontSize: "0.5625rem" }}>
                    DURATION
                  </div>
                  <div
                    className="font-mono"
                    style={{ fontSize: "0.6875rem", color: "var(--ohmni-text-secondary)" }}
                  >
                    {lastCallInfo.durationMs} ms
                  </div>
                </div>
              </div>

              {/* Explicit Architecture Pipeline Connection */}
              <div
                style={{
                  fontSize: "0.625rem",
                  color: "var(--ohmni-text-muted)",
                  background: "var(--ohmni-surface)",
                  padding: "4px 6px",
                  borderRadius: "var(--radius-sm)",
                  border: "1px dashed var(--ohmni-border-subtle)",
                }}
              >
                agent/tool call → physical actuation → telemetry event bus
              </div>
            </div>
          ) : (
            <div
              style={{
                height: "100%",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--ohmni-text-muted)",
                fontSize: "0.75rem",
                textAlign: "center",
              }}
            >
              <div>No tool execution recorded</div>
              <div style={{ fontSize: "0.6875rem", color: "var(--ohmni-text-disabled)", marginTop: "2px" }}>
                Invoking a WebMCP tool routes through ExperimentRunner and correlates live traces.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
