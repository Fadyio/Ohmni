# Ohmni

Ohmni exposes safe hardware measurements and controlled experiments as WebMCP tools, allowing an external AI agent such as ChatGPT to inspect a device, run approved tests, collect evidence, request human intervention, and retest the hardware to verify a repair.

[**Open Live Demo →**](https://ohmni-three.vercel.app) · [![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE) · [![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue)](https://www.typescriptlang.org/) · [![WebMCP](https://img.shields.io/badge/API-WebMCP%20document.modelContext-4967FF)](https://github.com/Fadyio/Ohmni)

---

## The Problem

Coding agents can inspect software, but they cannot inspect the physical board on your desk.

When an embedded controller crashes or an actuator misbehaves, agents are forced to guess from text descriptions or hallucinate electrical causes. Physical troubleshooting requires empirical measurement: reading reset registers, probing voltage rails under load, and observing waveforms.

Giving an agent unrestricted electrical control over physical hardware risks burnt traces, damaged components, or runaway actuators. Hardware debugging needs calibrated instruments with strict runtime safety interlocks.

---

## Why WebMCP

WebMCP standardizes how web applications register structured, typed tools directly on `document.modelContext`. External AI agents running in WebMCP-capable environments (such as ChatGPT Desktop or Chrome with WebMCP enabled) automatically discover these tools without installing local CLI bridges or custom host daemons.

The browser sits at the boundary between web-connected AI models and local hardware peripherals via Web Serial. Ohmni uses WebMCP to expose browser-local hardware instruments directly to the user's agent.



## How the Demo Works

Ohmni includes a deterministic virtual reference device for instant evaluation without physical hardware: an ESP32 board with an on-board relay and cooling fan circuit.

### Fault Scenario
- **Symptom:** Microcontroller restarts whenever the cooling fan turns on.
- **Root Cause:** The relay coil is wired to the shared 3.3 V MCU power rail instead of the independent 5 V supply. Coil inrush collapses the rail to 2.72 V, tripping the 2.80 V brownout detector.
- **Repair:** Human moves jumper `JP1` to the 5 V supply.
- **Verification:** Post-repair load test sags only to 3.18 V (safe), proving the fix experimentally.

## WebMCP Implementation

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

## Physical Hardware / Web Serial

Ohmni includes Web Serial transport to connect to physical microcontrollers (e.g. ESP32-S3).

- **Implemented:** Web Serial transport, 115200 baud streaming NDJSON protocol (Ohmni NDJSON Protocol v1), two-way handshake, runtime descriptor discovery, dynamic capability registration, cancellation, live telemetry framing, and safe disconnect.
- **Tested:** Browser transport and protocol paths tested against simulated serial peers.
- **Not Tested:** Electrical behavior on an attached physical board.

Reference ESP32-S3 firmware: [`firmware/ohmni-esp32-reference/`](firmware/ohmni-esp32-reference/).

---

## Run Locally

```bash
git clone https://github.com/Fadyio/Ohmni.git
cd Ohmni
bun install
bun run dev
```

Open [http://localhost:5173](http://localhost:5173) in Google Chrome. 

> **Note on WebMCP Support:** In Chrome, native `document.modelContext` is available when running with WebMCP experimental features enabled (`--enable-features=ModelContextTesting`). In ChatGPT Desktop App, WebMCP site tools are discovered natively via the built-in browser. For browsers without native WebMCP, Ohmni includes an in-memory mirror and developer inspector.

---

## Testing


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


## License

MIT License — see [LICENSE](LICENSE) for details.
