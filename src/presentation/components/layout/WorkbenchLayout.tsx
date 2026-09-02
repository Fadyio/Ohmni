/**
 * Main Workbench Layout Component.
 * Implements the 3-column + header + bottom timeline instrument layout.
 */

import React from "react";

interface WorkbenchLayoutProps {
  readonly topBar: React.ReactNode;
  readonly leftPanel: React.ReactNode;
  readonly centerPanel: React.ReactNode;
  readonly rightPanel: React.ReactNode;
  readonly bottomTimeline: React.ReactNode;
}

export const WorkbenchLayout: React.FC<WorkbenchLayoutProps> = ({
  topBar,
  leftPanel,
  centerPanel,
  rightPanel,
  bottomTimeline,
}) => {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100vw",
        height: "100vh",
        maxHeight: "100vh",
        background: "var(--ohmni-bg)",
        color: "var(--ohmni-text-primary)",
        overflow: "hidden",
      }}
    >
      {/* 1. Top Navigation & Status Bar */}
      {topBar}

      {/* 2. Middle Body: Left Device (260px) | Center Instruments (1fr) | Right Investigation (300px) */}
      <div
        style={{
          flex: 1,
          display: "grid",
          gridTemplateColumns: "260px 1fr 300px",
          minHeight: 0,
          overflow: "hidden",
        }}
      >
        {/* Left Inspector Column */}
        {leftPanel}

        {/* Center Dominant Hero Column */}
        <main
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "8px",
            padding: "0.875rem",
            overflowY: "auto",
            minWidth: 0,
            background: "var(--ohmni-bg)",
          }}
        >
          {centerPanel}
        </main>

        {/* Right Investigation Workspace Column */}
        {rightPanel}
      </div>

      {/* 3. Bottom Event Timeline */}
      {bottomTimeline}
    </div>
  );
};
