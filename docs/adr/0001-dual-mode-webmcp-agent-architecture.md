# 0001. Dual-Mode WebMCP and In-App Bench Agent Architecture

Date: 2026-09-02

## Status

Accepted

## Context

The workbench must showcase deep WebMCP integration by allowing AI agents to diagnose physical hardware connected via Web Serial. However, user and judge environments vary: some users will operate inside native WebMCP browser environments (e.g., ChatGPT in-app browser, Chrome with WebMCP flags), while others will access the workbench using standard desktop browsers.

We need an execution architecture that guarantees 100% demo reliability without compromising WebMCP compliance or creating dual, divergent execution paths.

## Decision

We will implement a **Dual-Mode WebMCP Architecture** where `document.modelContext` serves as the single source of truth for all diagnostic instruments:

1. **Formal WebMCP Registration:** All instruments (`read_reset_history`, `measure_supply_voltage`, `scan_i2c_bus`, `run_relay_stress_test`, etc.) are declared with explicit JSON schemas, annotations (`readOnlyHint`, `untrustedContentHint`), and abort signals, then registered directly on `document.modelContext`.
2. **Single Execution Path:** The in-app **Bench Agent** interacts with instruments strictly through standard WebMCP APIs:
   - Tool discovery: `const tools = await document.modelContext.getTools()` (`RegisteredTool[]`)
   - Tool location: `const tool = tools.find(t => t.name === "read_device_info")`
   - Tool execution: `const serializedResult = await document.modelContext.executeTool(tool, inputObject, { signal })`
3. **No Private Internal Bypasses:** The Bench Agent is prohibited from calling internal `DeviceAdapter` methods directly for diagnostic actions.
4. **External Agent Parity:** External WebMCP browser agents discover and invoke the exact same `document.modelContext` tool surface.

```text
                     DEVICE ADAPTER
                           │
                    instrument logic
                           │
                           ▼
                 document.modelContext
                 registered WebMCP tools
                    /                 \
                   /                   \
                  ▼                     ▼
     External WebMCP Agent        In-App Bench Agent
       (Browser/ChatGPT)        (WebMCP getTools/execute)
```

## Consequences

### Positive
- **WebMCP Leverage:** Complete adherence to WebMCP specifications (`registerTool`, `getTools`, `executeTool`, `toolchange`, annotations, signals).
- **Execution Reliability:** Any judge can immediately run the end-to-end diagnostic workflow on any browser via the Bench Agent without requiring special browser extensions.
- **Zero Divergence:** Testing the in-app Bench Agent simultaneously tests the exact tool schemas and handlers used by external WebMCP agents.

### Negative / Tradeoffs
- Requires WebMCP polyfill or shim structure when running in browsers where `document.modelContext` is not natively exposed on the window object.
