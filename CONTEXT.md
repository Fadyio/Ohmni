# Context Glossary — Hardware Diagnostic Workbench

## Core Entities

### DeviceAdapter
The uniform hardware abstraction interface that bridges physical or simulated hardware to the workbench. Exposes lifecycle methods (`connect`, `disconnect`), device descriptor discovery, and capability invocation.

### SerialDeviceAdapter
Implementation of `DeviceAdapter` backed by the Web Serial API (`navigator.serial`). Manages serial streams, baud rate configuration, physical connect/disconnect events, and newline-delimited JSON (NDJSON) framing.

### VirtualDeviceAdapter
Implementation of `DeviceAdapter` simulating hardware in pure JavaScript/WebAssembly. Emulates electrical dynamics (voltage sag, brownouts), bus protocols (I²C scans), task watchdogs, heap allocations, and deterministic hardware faults without requiring physical hardware.

### TelemetryEventBus
A high-frequency local event bus transmitting live device telemetry (`voltage_sample`, `relay_state`, `reset`, `sensor_reading`) directly to UI visualizers and ring buffers, bypassing React state overhead for silky 60fps canvas rendering.

### ExperimentRunner
The subsystem that orchestrates physical and virtual experiments. Assigns unique `experiment_id` correlation tokens, streams live sample ticks to `TelemetryEventBus`, watches for abort/cancellation signals, and synthesizes concise semantic summaries for WebMCP tool resolution.

### ExperimentRecord
A durable local record of an experiment run containing its metadata, raw high-frequency sample buffers, timeline events, and structured semantic summary. Used for trace playback, visual before/after overlays, and Evidence Ledger verification links.

### EvidenceRecord
An immutable, auto-generated factual observation captured directly from an experiment run, device telemetry, or recorded human physical inspection. Contains an immutable identifier (`E-001`), timestamp, source provenance, raw measurement data, and a concise human-readable factual summary. Cannot be forged, rewritten, or mutated by the AI agent.

### Hypothesis
An agent-authored explanatory candidate for observed anomalies (e.g. *Relay-Induced Brownout*, *Watchdog Starvation*). Maintains a qualitative confidence status (`UNTESTED`, `LOW`, `MEDIUM`, `HIGH`, `VERY_HIGH`, `REJECTED`, `CONFIRMED`) explicitly justified by citations to supporting or contradicting `EvidenceRecord` IDs.

### InterventionPoint
A named physical control on the hardware board (e.g. `relay_power_jumper`, `i2c_address_switch`, `sensor_bus_connector`) modeled in the UI and simulator. Possesses discrete valid states (e.g. `3v3` vs `5v`, `0x76` vs `0x77`). Manipulating an intervention point mutates actual circuit dynamics in the `VirtualDeviceAdapter`.

### HumanPhysicalIntervention
A structured workflow request triggered by the agent via `request_human_intervention` targeting an explicit `InterventionPoint`. Highlights the component on the interactive SVG PCB diagram, pauses agent execution, and prompts the human to physically manipulate the board.

### SafetyClassification
The tripartite categorization of capabilities:
- **Green (Observational):** Read-only measurements that execute autonomously.
- **Amber (Controlled Physical Actuation):** Bounded side-effect tests requiring supervision or strict envelope gating.
- **Red (Destructive / Unbounded):** Prohibited operations (flash erase, eFuse write, unrestricted serial) that are never exposed via WebMCP.

### SafetyMode
The active execution policy governing Amber tools:
- **Supervised Mode (Default):** Every Amber tool invocation suspends the WebMCP promise until approved or denied by a human UI click.
- **Autonomous Safe Envelope:** Ephemeral, session-scoped mode allowing bounded Amber operations to run automatically within strict application-enforced limits.

### EmergencyStop
A persistent global hardware safety cutoff that immediately signals the active `AbortController`, halts ongoing tests, and forces the physical or virtual device into an inert safe state.

### ProtocolMessage
A typed, versioned NDJSON message exchanged over Web Serial:
- `hello` / `descriptor`: Device discovery, capability reporting, and limits.
- `request` / `response`: Correlated RPC command execution with unique request IDs.
- `event`: Unsolicited asynchronous state transitions (`relay_state`, `reset`).
- `telemetry`: High-efficiency chunked time-series sample arrays.
- `cancel`: Abort signals targeting active experiment IDs.

### RawDeviceLog
Non-JSON ASCII/ROM boot output emitted during microcontroller resets. Captured into a bounded, untrusted diagnostic log buffer without triggering protocol parse failures.

### WebMCP Tool Surface
The collection of active tools dynamically registered on `document.modelContext`. Includes physical diagnostic instruments (`read_reset_history`, `measure_supply_voltage`, `run_relay_stress_test`) and investigation synthesis tools (`propose_hypothesis`, `update_hypothesis`, `link_evidence`, `request_human_intervention`, `record_conclusion`).

### Bench Agent
An in-page AI diagnostic orchestrator. Discovers active tools via `document.modelContext.getTools()` and invokes them via `document.modelContext.executeTool()`. Emits structured diagnostic hypotheses and requests physical human interventions when evidence dictates.

### External WebMCP Agent
An external browser-level agent (e.g., ChatGPT in-app browser or Chrome WebMCP agent) interacting directly with `document.modelContext` without going through internal application shims.

### Evidence Ledger
The tamper-proof repository of all recorded `EvidenceRecord` items. Serves as the empirical foundation upon which hypotheses are tested, ranked, rejected, or confirmed.
