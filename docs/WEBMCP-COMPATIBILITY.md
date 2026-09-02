# WebMCP Compatibility & Specification Reference

Date Checked: 2026-09-02
Target: Google Chrome 152 (Experimental `#enable-webmcp-testing` / Chromium Origin Trial) + WebMCP Community Draft
Status: Verified in Real Installed Chrome (`Google Chrome 152.0.7977.76`)

## Overview

The workbench exposes all diagnostic capabilities as standard WebMCP tools registered directly on `document.modelContext`.

## WebMCP Community Draft vs Native Chrome Implementation

| Dimension | WebMCP Community Draft | Chrome Experimental Implementation (Verified) | Ohmni Implementation |
| :--- | :--- | :--- | :--- |
| **Surface Location** | `document.modelContext` | `document.modelContext` (flags: `#enable-webmcp-testing`) | `document.modelContext` with `InMemoryModelContext` fallback |
| **Tool Discovery** | `document.modelContext.getTools()` | `document.modelContext.getTools()` -> Array of tool descriptors | `getTools()` returns `readonly RegisteredTool[]` |
| **executeTool Input** | JSON string or object | Valid JSON string (e.g. `'{"cycles":3}'`) or object | Accepts both `string` and `Record<string, unknown>` |
| **executeTool Output** | Serialized string or value | Promise resolving to `string` | Promise resolving to `string` |
| **Tool Execution Callback** | `execute(parsedInput, { signal })` | `execute(parsedInput, { signal })` | `execute(parsedInput, { signal })` |
| **Lifecycle Teardown** | `AbortSignal` on `registerTool` | `AbortSignal` on `registerTool` removes tool from registry | `AbortController.signal` per connected device session |
| **Execution Abort** | `AbortSignal` on `executeTool` | Passes `{ signal }` to tool `execute`, rejects on abort | Propagates `AbortSignal` to `DeviceAdapter`, resets actuators to safe state |
| **Events** | `toolchange` on `document.modelContext` | `toolchange` dispatched on registration & removal | Dispatches `Event("toolchange")` |

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

Returned by `document.modelContext.getTools()`:

```typescript
export interface RegisteredTool {
  readonly name: string;
  readonly title?: string;
  readonly description: string;
  readonly inputSchema?: Record<string, unknown>;
  readonly annotations?: ToolAnnotations;
  readonly origin?: string;
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
    input?: string | Record<string, unknown>,
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
2. **Execution Serialization & Cancellation**:
   - `executeTool(tool, input, { signal })` accepts JSON string (standard Chrome agent format) or object.
   - Passes execution `AbortSignal` down through the tool factory into `DeviceAdapter.executeCapability(..., signal)`.
   - Aborting halts ongoing experiments and resets actuated hardware (such as relays) to safe/open states.
3. **Event Notification**:
   - `document.modelContext` emits `"toolchange"` events whenever tools are registered or unregistered.

## Verified Native Chrome Behavior (Chrome 152.0.7977.76)

1. **Prototype Surface:** `document.modelContext` prototype defines `[ 'ontoolchange', 'executeTool', 'getTools', 'registerTool', 'constructor' ]`.
2. **Tool Discovery:** `getTools()` returns an array of registered tool descriptors with schema and annotations.
3. **Tool Invocation:** `executeTool(tool, '{}')` returns stringified JSON result.
4. **Safety & Abort:** Aborting in-flight `executeTool` throws/rejects with `AbortError` and ensures actuators return to open/safe state.
