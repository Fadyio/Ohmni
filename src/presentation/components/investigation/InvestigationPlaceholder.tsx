/**
 * Investigation Placeholder Component.
 * Restrained technical empty state for future Evidence Ledger and Hypothesis Engine.
 * Does not fake findings or intelligence — represents honest pre-investigation state.
 */

import React from "react";

export const InvestigationPlaceholder: React.FC = () => {
  return (
    <aside
      style={{
        width: "300px",
        minWidth: "300px",
        background: "var(--ohmni-surface)",
        borderLeft: "1px solid var(--ohmni-border)",
        display: "flex",
        flexDirection: "column",
        padding: "1.25rem 1rem",
        overflowY: "auto",
      }}
    >
      {/* Panel Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
        <span className="label-technical">INVESTIGATION</span>
        <span className="font-mono" style={{ fontSize: "0.625rem", color: "var(--ohmni-text-muted)" }}>
          STANDBY
        </span>
      </div>

      {/* Main Empty State Container */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "1.5rem 1rem",
          background: "var(--ohmni-surface-raised)",
          border: "1px dashed var(--ohmni-border)",
          borderRadius: "var(--radius-md)",
          textAlign: "center",
        }}
      >
        {/* Subtle Node/Connection Vector Motif */}
        <div style={{ width: "90px", height: "90px", marginBottom: "1.25rem", opacity: 0.7 }}>
          <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "100%" }}>
            {/* Graph Edges */}
            <line x1="50" y1="20" x2="25" y2="65" stroke="#334155" strokeWidth="1" strokeDasharray="3 3" />
            <line x1="50" y1="20" x2="75" y2="65" stroke="#334155" strokeWidth="1" strokeDasharray="3 3" />
            <line x1="25" y1="65" x2="75" y2="65" stroke="#334155" strokeWidth="1" strokeDasharray="3 3" />
            <line x1="50" y1="20" x2="50" y2="82" stroke="#38bdf8" strokeWidth="1" strokeOpacity="0.4" />

            {/* Root Hypothesis Node */}
            <circle cx="50" cy="20" r="7" fill="#0f172a" stroke="#38bdf8" strokeWidth="1.5" />
            <circle cx="50" cy="20" r="2.5" fill="#38bdf8" />

            {/* Evidence Observation Node Left */}
            <circle cx="25" cy="65" r="6" fill="#0f172a" stroke="#64748b" strokeWidth="1.2" />
            <circle cx="25" cy="65" r="2" fill="#64748b" />

            {/* Evidence Observation Node Right */}
            <circle cx="75" cy="65" r="6" fill="#0f172a" stroke="#64748b" strokeWidth="1.2" />
            <circle cx="75" cy="65" r="2" fill="#64748b" />

            {/* Future Synthesis Node Bottom */}
            <circle cx="50" cy="82" r="5" fill="#0f172a" stroke="#475569" strokeWidth="1" strokeDasharray="2 2" />
          </svg>
        </div>

        {/* Spec Copy */}
        <div
          style={{
            fontSize: "0.8125rem",
            fontWeight: 600,
            color: "var(--ohmni-text-primary)",
            marginBottom: "0.5rem",
          }}
        >
          No investigation active.
        </div>

        <p
          style={{
            fontSize: "0.75rem",
            color: "var(--ohmni-text-secondary)",
            lineHeight: 1.5,
            maxWidth: "240px",
          }}
        >
          Evidence and hypotheses will appear as diagnostic experiments produce observations.
        </p>

        <div
          className="font-mono"
          style={{
            marginTop: "1.5rem",
            fontSize: "0.625rem",
            color: "var(--ohmni-text-muted)",
            padding: "4px 8px",
            borderRadius: "var(--radius-sm)",
            background: "var(--ohmni-surface)",
            border: "1px solid var(--ohmni-border-subtle)",
          }}
        >
          EVIDENCE LEDGER • HYPOTHESIS ENGINE
        </div>
      </div>
    </aside>
  );
};
