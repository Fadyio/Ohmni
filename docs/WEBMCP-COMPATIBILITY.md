# WebMCP Compatibility & Specification Reference

Date Checked: 2026-09-02
Specification: WebMCP (Web Model Context Protocol)

## Overview

The workbench exposes all diagnostic capabilities as standard WebMCP tools registered directly on `document.modelContext`.

## Core Types & Signatures

### 1. Tool Declaration (`ModelContextTool`)

```typescript
export interface ToolAnnotations {
  readonly readOnlyHint?: boolean;
  readonly untrustedContentHint?: boolean;
}

export interface ModelContextTool {
  readonly name: string;
  readonly title?: string;
  readonly description: string;
  readonly inputSchema?: Record<string, unknown>;
  readonly annotations?: ToolAnnotations;
  execute(
    input: Record<string, unknown>,
    options?: { signal?: AbortSignal }
  ): Promise<unknown>;
}
```

### 2. Discovered Tool (`RegisteredTool`)

```typescript
export interface RegisteredTool {
  readonly name: string;
  readonly title?: string;
  readonly description: string;
  readonly inputSchema?: Record<string, unknown>;
  readonly annotations?: ToolAnnotations;
}
```

### 3. Execution & Registration Surface (`ModelContext`)

```typescript
export interface ModelContextRegisterToolOptions {
  readonly signal?: AbortSignal;
}

export interface ModelContextExecuteToolOptions {
  readonly signal?: AbortSignal;
}

export interface ModelContext extends EventTarget {
  registerTool(
    tool: ModelContextTool,
    options?: ModelContextRegisterToolOptions
  ): Promise<void>;

  getTools(): Promise<readonly RegisteredTool[]>;

  executeTool(
    tool: RegisteredTool,
    input?: Record<string, unknown>,
    options?: ModelContextExecuteToolOptions
  ): Promise<string>;

  addEventListener(
    type: "toolchange",
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions
  ): void;

  removeEventListener(
    type: "toolchange",
    listener: EventListenerOrEventListenerObject,
    options?: boolean | EventListenerOptions
  ): void;
}
```

## Lifecycle Semantics

1. **Registration & Teardown via `AbortSignal`**:
   - Tools are registered with `registerTool(tool, { signal })`.
   - When the device disconnects, the owning `AbortController` aborts its signal, immediately removing the tools from `getTools()`.
2. **Execution Cancellation**:
   - `executeTool(tool, input, { signal })` passes execution `AbortSignal` down through the tool factory into `DeviceAdapter.executeCapability(..., signal)`.
   - Aborting halts ongoing experiments and resets actuated hardware to safe/open states.
3. **Event Notification**:
   - ModelContext emits `"toolchange"` events whenever tools are added or removed.
