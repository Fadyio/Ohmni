# Ohmni

**Give your AI agent instruments for the physical world.**

Ohmni exposes safe hardware measurements and controlled experiments as WebMCP tools, allowing an external AI agent such as ChatGPT to inspect a device, run approved tests, collect evidence, request human intervention, and retest the hardware to verify a repair.

[**Open Live Demo →**](https://ohmni-three.vercel.app) · [![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE) · [![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue)](https://www.typescriptlang.org/) · [![WebMCP](https://img.shields.io/badge/API-WebMCP%20document.modelContext-4967FF)](https://github.com/Fadyio/Ohmni)

---

## 1. The Problem

Coding agents can inspect software, but they cannot inspect the physical board on your desk.

When an embedded controller crashes or an actuator misbehaves, agents are forced to guess from text descriptions or hallucinate electrical causes. Physical troubleshooting requires empirical measurement: reading reset registers, probing voltage rails under load, and observing waveforms.

Giving an agent unrestricted electrical control over physical hardware risks burnt traces, damaged components, or runaway actuators. Hardware debugging needs calibrated instruments with strict runtime safety interlocks.

---

## 2. Why WebMCP

WebMCP standardizes how web applications register structured, typed tools directly on `document.modelContext`. External AI agents running in WebMCP-capable environments (such as ChatGPT Desktop or Chrome with WebMCP enabled) automatically discover these tools without installing local CLI bridges or custom host daemons.

The browser sits at the boundary between web-connected AI models and local hardware peripherals via Web Serial. Ohmni uses WebMCP to expose browser-local hardware instruments directly to the user's agent.

### Division of Responsibility

| Role | Responsibilities |
|---|---|
| **External Agent** | Measures electrical state, runs controlled tests, reasons from evidence, proposes repairs, retests to verify |
| **Ohmni (Browser)** | Exposes trusted instruments, enforces human approval gates on actuation, bounds test duration, records immutable evidence ledger |
| **Human** | Authorizes physical actuation with a single click, performs physical repairs (jumpers, wiring, re-seating) |

---

## 3. How the Demo Works

Ohmni includes a deterministic virtual reference device for instant evaluation without physical hardware: an ESP32 board with an on-board relay and cooling fan circuit.

### Fault Scenario
- **Symptom:** Microcontroller restarts whenever the cooling fan turns on.
- **Root Cause:** The relay coil is wired to the shared 3.3 V MCU power rail instead of the independent 5 V supply. Coil inrush collapses the rail to 2.72 V, tripping the 2.80 V brownout detector.
- **Repair:** Human moves jumper `JP1` to the 5 V supply.
- **Verification:** Post-repair load test sags only to 3.18 V (safe), proving the fix experimentally.

### Demo Flow
1. Open [https://ohmni-three.vercel.app](https://ohmni-three.vercel.app) in ChatGPT Desktop's built-in browser (or any WebMCP-capable browser).
2. Click **Launch virtual diagnosis**.
3. ChatGPT discovers the site's WebMCP instruments on `document.modelContext`.
4. Prompt the agent:
   > "There is a problem with this controller: it resets when the cooling fan turns on. Investigate the root cause using the available hardware instruments. Gather evidence before proposing a diagnosis. You may use read-only measurements autonomously, but ask for my approval before any actuation or physical change. If you identify a repair, ask me to perform it and then experimentally verify that the problem is fixed."
5. The agent reads reset history (`read_reset_history`) and measures supply voltage (`measure_supply_voltage`).
6. It requests a relay stress test (`run_relay_stress_test`).
7. Ohmni pauses the tool call and displays an Amber approval gate in the UI.
8. The human approves actuation; the test reproduces a 2.72 V brownout reset.
9. The agent diagnoses the relay coil power supply problem from recorded evidence tokens.
10. The agent asks the human to move jumper `JP1` to the 5 V supply rail.
11. The agent reruns the identical relay stress test.
12. The rail remains stable at 3.18 V and the agent confirms the repair is verified.

---

## 4. WebMCP Implementation

Ohmni registers native WebMCP tools directly with `document.modelContext`.

### Equivalent Native Registration Shape

The WebMCP specification uses `document.modelContext.registerTool(...)` to expose tools to browser agents. For example, the primary rail measurement instrument has this signature:

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

*(Equivalent native registration shape; production dynamically materializes tools from connected device descriptors.)*

### Implementation Architecture & Source Files

Production dynamically materializes and gates tools across these core components:

- [`src/infrastructure/webmcp/device-tool-registrar.ts`](src/infrastructure/webmcp/device-tool-registrar.ts): Validates device capabilities against security policies and registers active tools on `modelContext`.
- [`src/infrastructure/webmcp/capability-registry.ts`](src/infrastructure/webmcp/capability-registry.ts): Defines tool schemas, descriptions, read-only hints, and execution dispatchers.
- [`src/infrastructure/webmcp/mirrored-model-context.ts`](src/infrastructure/webmcp/mirrored-model-context.ts): Bridges native `document.modelContext` with execution coordination and safety gates.

### Dynamic Registration Loop

From [`src/infrastructure/webmcp/device-tool-registrar.ts`](src/infrastructure/webmcp/device-tool-registrar.ts):

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

---

## 5. Human Safety Model

Physical actuation requires runtime boundaries that the model cannot bypass.

| Tier | Tools | Model Permission | Runtime Interlock |
|---|---|---|---|
| **Green (Read-Only)** | `read_device_info`, `read_reset_history`, `measure_supply_voltage` | Autonomous execution | Executes immediately; results recorded in immutable evidence ledger |
| **Amber (Actuation)** | `run_relay_stress_test` | Request only; cannot self-authorize | Execution pauses; UI displays Amber approval dialog; bounded to 500 ms max; fail-safe open on abort/timeout |
| **Human Hands** | `request_human_intervention` | Request only | Requests physical change (jumper, wiring); resumes after human confirms |
| **Red (Forbidden)** | Flash erase, arbitrary memory writes, eFuse burning | Blocked | Stripped at capability registration; never exposed to model |

---

## 6. Physical Hardware / Web Serial

Ohmni includes Web Serial transport to connect to physical microcontrollers (e.g. ESP32-S3).

- **Implemented:** Web Serial transport, 115200 baud streaming NDJSON protocol (Ohmni NDJSON Protocol v1), two-way handshake, runtime descriptor discovery, dynamic capability registration, cancellation, live telemetry framing, and safe disconnect.
- **Tested:** Browser transport and protocol paths tested against simulated serial peers.
- **Not Tested:** Electrical behavior on an attached physical board.

Reference ESP32-S3 firmware: [`firmware/ohmni-esp32-reference/`](firmware/ohmni-esp32-reference/).

---

## 7. Run Locally

```bash
git clone https://github.com/Fadyio/Ohmni.git
cd Ohmni
bun install
bun run dev
```

Open [http://localhost:5173](http://localhost:5173) in Google Chrome.

> **Note on WebMCP Support:** In Chrome, native `document.modelContext` is available when running with WebMCP experimental features enabled (`--enable-features=ModelContextTesting`). In ChatGPT Desktop App, WebMCP site tools are discovered natively via the built-in browser. For browsers without native WebMCP, Ohmni includes an in-memory mirror and developer inspector.

---

## 8. Testing

### Verification Status

| Verification Target | Result | Notes |
|---|---|---|
| Real ChatGPT WebMCP/Site Tools end-to-end flow | **PASS** | Verified with ChatGPT Desktop App live WebMCP integration |
| Automated WebMCP external-agent flow | **PASS** | Automated headless Chrome verification via CDP |
| Web Serial protocol with simulated peer | **PASS** | 115200 baud NDJSON framing, handshake, and cancellation |
| Real physical-board electrical validation | **NOT PERFORMED** | Requires physical breadboard and laboratory instrumentation |

### Test Commands

```bash
# Unit and domain invariant tests
bun test

# TypeScript type verification
bun run typecheck

# Production build bundle check
bun run build

# Web Serial NDJSON protocol & transport tests
bun run test:serial

# Real Chrome WebMCP acceptance tests
bun run test:chrome
bun run test:webmcp:external
```

---

## 9. Known Limitation

**Real physical-board electrical validation: NOT PERFORMED.**

The software stack—virtual reference simulation, WebMCP tool registration and execution, Amber safety interlocks, evidence extraction, hypothesis linking, and Web Serial NDJSON transport—is fully implemented and verified with automated tests and real ChatGPT Desktop sessions.

Validating analog noise floor, real coil inrush dv/dt, component tolerances, and physical soldering requires attached physical breadboard hardware and external laboratory instruments.

---

## 10. License

MIT License — see [LICENSE](LICENSE) for details.
