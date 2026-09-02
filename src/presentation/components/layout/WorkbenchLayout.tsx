/**
 * Main Workbench Layout Component.
 * Implements professional resizable 3-column + header + bottom timeline layout
 * using react-resizable-panels (Group, Panel, Separator).
 */

import React from "react";
import { Group, Panel, Separator } from "react-resizable-panels";

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

      {/* 2. Middle Body: Resizable 3 Panels */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflow: "hidden",
          display: "flex",
        }}
      >
        <Group orientation="horizontal">
          {/* Left Device Inspector Panel */}
          <Panel defaultSize="22%" minSize="16%" maxSize="32%">
            {leftPanel}
          </Panel>

          {/* Left Resize Handle */}
          <Separator
            className="resize-handle"
            style={{
              width: "3px",
              cursor: "col-resize",
            }}
          />

          {/* Center Dominant Hero Live Lab Column */}
          <Panel defaultSize="48%" minSize="34%">
            <main
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "10px",
                padding: "0.875rem",
                overflowY: "auto",
                height: "100%",
                background: "var(--ohmni-bg)",
                minWidth: 0,
              }}
            >
              {centerPanel}
            </main>
          </Panel>

          {/* Right Resize Handle */}
          <Separator
            className="resize-handle"
            style={{
              width: "3px",
              cursor: "col-resize",
            }}
          />

          {/* Right Agent & Investigation Column */}
          <Panel defaultSize="30%" minSize="24%" maxSize="44%">
            {rightPanel}
          </Panel>
        </Group>
      </div>

      {/* 3. Bottom Event Timeline */}
      {bottomTimeline}
    </div>
  );
};
