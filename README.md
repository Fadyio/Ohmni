# OHMNI

> **Give your AI agent instruments for the physical world.**

Ohmni exposes safe hardware diagnostic instruments and controlled experiments as WebMCP tools on `document.modelContext`. Bring ChatGPT, Codex, or another compatible agent to inspect, test, and diagnose hardware directly through the browser.

[**Open Live Demo →**](https://ohmni-three.vercel.app)

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue)](https://www.typescriptlang.org/)
[![WebMCP](https://img.shields.io/badge/API-WebMCP%20document.modelContext-4967FF)](https://github.com/Fadyio/ohmni)

---

## Problem

AI agents are proficient at debugging code, but they are blind in the physical world. When an embedded controller crashes or an actuator stalls, agents are forced to guess based on user descriptions, analyze static screenshots, or hallucinate physical behaviors.

Physical debugging requires empirical measurement: probing power rails, reading reset registers, and running controlled load tests. Yet giving an autonomous agent unrestricted control over physical hardware risks burnt traces, damaged components, or runaway actuators.

Hardware needs an instrument layer with safety interlocks built into the runtime.

---

## The WebMCP Idea

WebMCP allows web applications to register structured, typed tools directly on `document.modelContext`. External AI agents running in WebMCP-capable browsers (such as ChatGPT Desktop built-in browser or Chrome with WebMCP enabled) automatically discover these tools from the page.

Ohmni turns the webpage into a calibrated hardware testbench:
- Hardware registers, ADC channels, and bus scanners become **read-only diagnostic tools**.
- Actuators and high-current stress tests become **human-gated experiment tools**.
- The browser enforces safety envelopes, intercepts dangerous operations, and records an immutable evidence ledger.

---

## How it Works

Ohmni establishes a strict tripartite division of responsibility:

```text
    AGENT                   OHMNI                   HUMAN
Decides what to       Exposes trusted tools   Authorizes physical actuation
inspect and test     Records immutable facts   Performs physical changes
                     Enforces safety bounds    (jumpers, wiring, re-seating)
```

1. **Agent:** Decides diagnostic strategy, invokes WebMCP tools, and synthesizes causal hypotheses based on measured evidence.
2. **Ohmni:** Translates WebMCP tool calls into hardware actions, streams live oscilloscope waveforms, blocks physical side effects behind safety gates, and records evidence tokens.
3. **Human:** Authorizes physical actuation with a single click and applies physical hardware changes when requested.

---

## Use with ChatGPT / External Agent

Ohmni is built **external-agent first**. The built-in demo is a secondary walkthrough; the primary product path is operated by your own agent.

### Quickstart with ChatGPT Desktop

1. Open the **ChatGPT Desktop App** and launch its built-in browser (or navigate in any WebMCP-capable browser).
2. Open: [https://ohmni-three.vercel.app](https://ohmni-three.vercel.app).
3. Click: **[ Launch virtual diagnosis ]**.
4. Confirm the page indicates WebMCP is connected and registered instruments are available.
5. Give ChatGPT/external agent this canonical prompt (or click **Copy prompt** in Ohmni's right rail):

> "There is a problem with this controller: it resets when the cooling fan turns on. Investigate the root cause using the available hardware instruments. Gather evidence before proposing a diagnosis. You may use read-only measurements autonomously, but ask for my approval before any actuation or physical change. If you identify a repair, ask me to perform it and then experimentally verify that the problem is fixed."

6. The external agent will:
   - inspect device info (`read_device_info`)
   - inspect reset history (`read_reset_history`)
   - measure supply voltage (`measure_supply_voltage`)
   - request controlled load test (`run_relay_stress_test`)
   - wait for human authorization at the Amber safety gate
   - use structured evidence (`list_evidence`, `get_evidence`)
   - form diagnosis (`propose_hypothesis`)
   - request human intervention (`request_human_intervention`)
   - retest under identical parameters
   - confirm hypothesis (`confirm_hypothesis`)

Detailed step-by-step verification instructions and acceptance results: [docs/CHATGPT-SITE-TOOLS-TEST.md](docs/CHATGPT-SITE-TOOLS-TEST.md).
**Live manual test status:** PASS (Verified by human on 2026-09-04 using ChatGPT Desktop App with live WebMCP site tools).

---

## Virtual Challenge

For evaluation without physical hardware, Ohmni includes a deterministic virtual reference device:
- **Device:** Virtual ESP32 reference board with on-board relay, cooling fan circuit, and dual power rails.
- **Symptom:** Microcontroller unexpectedly restarts whenever the relay energizes.
- **Root Cause (Sealed Ground Truth):** The relay coil is erroneously wired to the shared 3.3 V MCU power rail instead of the independent 5 V supply. Coil inrush collapses the rail to 2.72 V, tripping the 2.80 V brownout detector (BOD).
- **Repair:** Human moves jumper `JP1` from the shared 3.3 V rail to the independent 5 V supply.
- **Verification:** Post-repair load test sags only to 3.18 V (safe), proving the fix experimentally.

---

## Physical Hardware / Web Serial

Ohmni connects to real microcontrollers over Web Serial:
- **Connection:** Plug in an ESP32 or compatible MCU via USB, click **Connect hardware**, and select the serial port at **115200 baud**.
- **Handshake:** Ohmni sends `{"type":"hello","protocol":1}\n`. The firmware responds with a protocol-v1 JSON descriptor declaring its capabilities.
- **Security Firewall:** Untrusted, red, or destructive capabilities (flash erase, raw memory write, arbitrary serial commands) are stripped before tool registration.
- **Protocol:** Bidirectional streaming NDJSON with correlated RPC IDs, asynchronous telemetry framing, and automatic re-handshake on bootloader reset text.

Firmware reference implementation: [`firmware/ohmni-esp32-reference/`](firmware/ohmni-esp32-reference/).

---

## Safety Model

| Tool Tier | Examples | Agent Permission | Runtime Interlock |
|---|---|---|---|
| **Green (Read-Only)** | `read_device_info`, `read_reset_history`, `measure_supply_voltage` | Autonomous execution | Executes immediately; results recorded in ledger |
| **Amber (Actuation)** | `run_relay_stress_test` | Request only; cannot self-authorize | Tool promise pauses; UI displays Amber interlock; bounded to 500 ms max actuation; relay returns open on abort/timeout |
| **Human Hands** | `request_human_intervention` | Request only | Instructs user to change physical jumper or wiring; user confirms in UI |
| **Red (Forbidden)** | Flash erase, arbitrary memory writes, eFuse burning | Blocked | Stripped at capability registration; never exposed to model |

---

## WebMCP Implementation

Ohmni registers native WebMCP tools directly with `document.modelContext`.

### Native WebMCP registration shape

The WebMCP specification provides `document.modelContext.registerTool(...)` for exposing typed tools to browser agents. Conceptually, the dynamically generated registration is equivalent to:

```js
document.modelContext.registerTool({
  name: "measure_supply_voltage",
  description:
    "Measure the connected device's primary supply rail without changing hardware state.",
  inputSchema: {
    type: "object",
    properties: {},
    additionalProperties: false,
  },
  annotations: {
    readOnlyHint: true,
  },
  execute: async () => {
    return deviceAdapter.executeCapability("measure_supply_voltage");
  },
});
```

In production, registrations are dynamically materialized, secured, and mirrored across execution environments:
- [`DeviceToolRegistrar`](src/infrastructure/webmcp/device-tool-registrar.ts): Validates device capabilities against security bounds before registration.
- [`CapabilityRegistry`](src/infrastructure/webmcp/capability-registry.ts): Defines schemas, titles, descriptions, read-only hints, and execution handlers.
- [`MirroredModelContext`](src/infrastructure/webmcp/mirrored-model-context.ts): Bridges native `document.modelContext` with execution coordination and safety gates.

### Real Registration Loop

Copied directly from production source ([`src/infrastructure/webmcp/device-tool-registrar.ts`](src/infrastructure/webmcp/device-tool-registrar.ts)):

```ts
for (const capability of descriptor.capabilities) {
  const tool = this.capabilityRegistry.createTool(capability.name, adapter);
  if (!tool) {
    // Unknown or untrusted capability — skip registration
    continue;
  }

  await this.modelContext.registerTool(tool, {
    signal: abortController.signal,
  });
  registeredToolNames.push(tool.name);
}
```

### Real Instrument Definition

Copied directly from production source ([`src/infrastructure/webmcp/capability-registry.ts`](src/infrastructure/webmcp/capability-registry.ts)):

```ts
this.registerFactory("measure_supply_voltage", (adapter) => ({
  name: "measure_supply_voltage",
  title: "Measure Supply Voltage",
  description:
    "Sample internal ADC to measure instantaneous voltage on the primary 3.3V rail. Returns measured voltage without changing electrical state.",
  inputSchema: {
    type: "object",
    properties: {},
    additionalProperties: false,
  },
  annotations: {
    readOnlyHint: true,
  },
  execute: async (_input, _options) => {
    const result = await adapter.executeCapability("measure_supply_voltage");
    return result.data;
  },
}));
```

---

## Architecture

```text
       BYO External WebMCP Agent                   Built-in Demo Agent
     (ChatGPT, Codex, WebMCP Host)             (Deterministic Walkthrough)
                  │                                         │
     native WebMCP│ getTools / executeTool         same WebMCP tools
                  ▼                                         ▼
   ┌─────────────────────────── MirroredModelContext ───────────────────────────┐
   │                                                                            │
   │  native document.modelContext                     InMemoryModelContext     │
   │  (authoritative external surface)                 (built-in execution)     │
   └─────────────────────────────────────┬──────────────────────────────────────┘
                                         │ wrapped tool call
                                         ▼
                            WebMCPExecutionCoordinator
                       ┌─────────────────┼──────────────────┐
                       │                 │                  │
                Invocation Ledger   Approval Gate   Intervention Gate
               (shared UI stream)   (Amber tools)   (physical repair)
                       └─────────────────┼──────────────────┘
                                         │
                     ┌───────────────────┴────────────────────┐
                     │                                        │
          DeviceToolRegistrar                        EvidenceStore &
          CapabilityRegistry                         HypothesisStore
         (vetted tools only)                     (grounded verification)
                     │
                     ▼
               DeviceAdapter
         ┌───────────┴───────────────────────────┐
         │                                       │
   VirtualDeviceAdapter                 SerialDeviceAdapter
  (reference simulation)              (WebSerialTransport API)
                                                 │
                                            115200 baud
                                                 │
                                                 ▼
                                        Physical Hardware
```

---

## Testing

Ohmni is tested against automated suites in real headless Google Chrome:

```bash
# Unit and domain invariant tests
bun test

# TypeScript type verification
bun run typecheck

# Production build bundle check
bun run build

# Web Serial NDJSON protocol & transport tests
bun run test:serial
bun run test:e2e:serial

# Real Chrome WebMCP & CDP acceptance tests
bun run test:chrome
bun run test:e2e:demo
bun run test:webmcp:external

# Layout, motion, and chaos resilience tests
bun run test:motion
bun run test:visual
bun run test:chaos
bun run test:mystery

# Comprehensive release gate
bun run release:verify
```

---

## Real-Hardware Limitation

**Verified in software and live agent:** Virtual reference device physics, WebMCP registration and execution, Amber safety interlocks, evidence collection and hypothesis linking, Web Serial transport and framing, automated Chrome browser flows, and live manual end-to-end testing with ChatGPT Desktop.

**Electrical verification:** Electrical validation (exact analog noise floor, real coil inrush dv/dt, divider tolerances, and attached physical hardware repair) requires physical breadboard hardware and external laboratory instruments.

```text
PHYSICAL-BOARD ELECTRICAL VERIFICATION: NOT PERFORMED
Web Serial software and protocol behavior have been exercised with simulated peers;
an attached board and external instruments are still required for electrical validation.
```

---

## Run Locally

```bash
git clone https://github.com/Fadyio/ohmni.git
cd ohmni
bun install
bun run dev
```

Open `http://localhost:5173` in Google Chrome.

---

## License

MIT License — see [LICENSE](LICENSE) for details.
