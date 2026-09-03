# OHMNI

> **Coding agents can inspect software, but they cannot inspect the physical board on your desk. Ohmni uses WebMCP to give an agent safe browser-native hardware instruments. It can measure and reason autonomously, but dangerous actions require your approval and physical repairs require your hands.**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue)](https://www.typescriptlang.org/)
[![WebMCP](https://img.shields.io/badge/API-WebMCP%20document.modelContext-4967FF)](https://github.com/Fadyio/Ohmni)
[![Tests](https://img.shields.io/badge/Tests-390%20Passing-22C55E)](https://github.com/Fadyio/Ohmni)

---

## Live Production & Quick Links

- **Live Production Workbench:** [https://ohmni-three.vercel.app](https://ohmni-three.vercel.app)
- **Repository:** [https://github.com/Fadyio/Ohmni](https://github.com/Fadyio/Ohmni)
- **Hackathon Track:** The WebMCP Challenge (Devpost)
- **Physical Hardware Guide:** [docs/REAL-HARDWARE-QUICKSTART.md](docs/REAL-HARDWARE-QUICKSTART.md)
- **Reference ESP32 Firmware:** [firmware/ohmni-esp32-reference/](firmware/ohmni-esp32-reference/)

---

## 90-Second Architecture

```text
                    ┌─────────────────────────┐
                    │       Bench Agent       │
                    │   (Groq LLM / Demo)     │
                    └────────────┬────────────┘
                                 │ WebMCP
                    ┌────────────▼────────────┐
                    │   document.modelContext │
                    │ (Mirrored / In-Memory)  │
                    └────────────┬────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │   CapabilityRegistry    │
                    │   (Trusted Factories)   │
                    └────────────┬────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │      DeviceAdapter      │
                    └───────┬─────────┬───────┘
                            │         │
                 ┌──────────▼──┐   ┌──▼──────────────┐
                 │   Virtual   │   │  SerialDevice   │
                 │   Adapter   │   │    Adapter      │
                 └─────────────┘   └──┬──────────────┘
                                      │ Web Serial (115200 baud NDJSON v1)
                                      ▼
                               Physical Hardware
```

---

## Why WebMCP?

Embedded software engineers and hardware developers waste hours diagnosing intermittent device failures: *Is it a software panic? A brownout? An unseated jumper? An inductive load spike?*

Today's coding agents are exceptional at reading code, proposing firmware patches, and generating unit tests, but their perception halts abruptly at the edge of the screen:

- **Without WebMCP:**
  - The agent only sees screenshots or plain text pastes.
  - It has to guess UI controls, button coordinates, or command-line syntax.
  - It cannot directly access browser-local hardware interfaces (such as Web Serial).
  - It cannot reliably invoke structured, typed diagnostic instruments.

- **With Ohmni + WebMCP:**
  - The browser exposes structured, typed diagnostic instruments directly via `document.modelContext`.
  - The agent calls measurements, reads registers, and runs bounded tests programmatically.
  - Measurement outputs immediately become immutable, empirical evidence records with unique IDs.
  - Dangerous operations pause execution and require explicit human consent.
  - Physical modifications remain the responsibility of human hands.
  - The agent can retest afterward and verify whether the physical change actually resolved the fault.

> *"Before Ohmni, a coding agent could reason about firmware while the engineer manually operated the hardware instruments. With Ohmni, the browser exposes those instruments through WebMCP: the agent can decide what to measure and test, while the human remains responsible for authorization and physical manipulation."*

---

## Two Execution Modes

Ohmni supports two complete, verifiable execution modes:

### 1. Deterministic Virtual ESP32 Diagnostic Challenge
No hardware on hand? Ohmni includes a deterministic in-browser virtual microcontroller reference environment. It emulates an ESP32-S3 microcontroller coupled to an inductive relay coil and DC fan load with non-linear electrical dynamics:
- **Hidden Ground Truth:** The underlying fault (e.g. relay coil sharing the 3.3V supply rail instead of 5V auxiliary power) is sealed from the agent's context.
- **Autonomous Investigation:** The agent starts knowing only the reported user symptom: *"The controller restarts whenever the cooling fan turns on."*
- **Empirical Evidence Generation:** The agent measures baseline voltage (3.31V), reads the reboot log (`BROWNOUT`), requests a controlled relay stress test, and observes the supply collapse to 2.72V on the live 60fps oscilloscope.
- **Human Hands Intervention:** Because the AI cannot physically touch hardware jumpers, it requests human assistance: *"Move jumper JP1 from the shared 3.3V position to the independent 5V supply rail."*
- **Retest to Verify:** After the human moves JP1, the agent reruns the stress test, confirms 3.18V rail stability under load with zero brownout resets, and verifies the repair.

### 2. Physical Hardware Mode via Web Serial
Ohmni implements real microcontroller communication over browser-native **Web Serial** (115200 baud, versioned NDJSON protocol v1):
- Uses `SerialDeviceAdapter` over `WebSerialTransport`.
- Performs an automated handshake (`hello` → `descriptor`).
- Dynamically discovers hardware identity, firmware version, and advertised capabilities.
- Maps discovered capabilities through Ohmni's trusted capability registry into `document.modelContext`.
- Captures real-time telemetry streams into Ohmni's high-frequency ring buffer.
- Features a reference firmware implementation ready to flash to an ESP32-S3 board (see [firmware/ohmni-esp32-reference/](firmware/ohmni-esp32-reference/)).

---

## WebMCP Implementation

The hackathon specification requires WebMCP tools to be registered on the browser's native `document.modelContext` in the shape of:

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
  execute: async () => {
    return deviceAdapter.executeCapability("measure_supply_voltage");
  },
});
```

### How Production Ohmni Materializes WebMCP

Rather than declaring static or hardcoded tools inline, Ohmni uses a dynamic, descriptor-driven security architecture:

1. **Browser Detection:** Ohmni checks for the native Chromium `document.modelContext` API. If present, it wraps it in `MirroredModelContext`. If absent, it provides an in-memory compatibility context for local execution.
2. **Device Discovery:** When a device connects (virtual or physical), it provides a `DeviceDescriptor` specifying its capabilities (e.g. `measure_supply_voltage`, `read_reset_history`, `run_relay_stress_test`).
3. **Security Firewall:** Unknown or dangerous capabilities (such as `erase_flash`, `raw_memory_write`, or arbitrary shell execution) are stripped before registration.
4. **Trusted Factory Mapping:** `DeviceToolRegistrar` queries the browser-owned `CapabilityRegistry` to create vetted `ModelContextTool` definitions with strict JSON Schema definitions and safety annotations.
5. **Tool Registration:** Registered tools are dynamically materialized into `document.modelContext` and advertised to the AI agent.
6. **Lifecycle Management:** Upon device disconnect, device-specific tools are cleanly unregistered from `document.modelContext`.

### Responsible Source Files

Judges can inspect the exact WebMCP implementation across these core files:

- **`src/main.tsx`** — Detects native `document.modelContext`, initializes `MirroredModelContext`, and bootstraps the tool registrar.
- **`src/infrastructure/webmcp/mirrored-model-context.ts`** — Mirrors registrations between native browser WebMCP and local execution contexts.
- **`src/infrastructure/webmcp/device-tool-registrar.ts`** — Coordinates dynamic registration and unregistration of hardware instruments based on device descriptors.
- **`src/infrastructure/webmcp/capability-registry.ts`** — Browser-owned trusted tool factory mapping validated device capabilities to typed WebMCP tools.
- **`src/infrastructure/webmcp/evidence-tools.ts`** — Exposes read-only empirical evidence query tools (`list_evidence`, `get_evidence`).
- **`src/infrastructure/webmcp/hypothesis-tools.ts`** — Exposes structured diagnostic reasoning tools (`propose_hypothesis`, `link_evidence`, `update_hypothesis`).

> **Security Invariant:** Unknown device capabilities are never automatically exposed as arbitrary agent tools. Every device capability must map to a pre-approved, browser-owned trusted tool factory.

---

## Human Safety Model

Hardware actuation involves real electrical energy and physical consequences. Ohmni enforces a three-tier safety model:

1. **Green Instruments (Passive Observation):**
   - *Examples:* `measure_supply_voltage`, `read_device_info`, `read_system_health`, `read_reset_history`.
   - *Execution:* Autonomous. These tools only read registers or sample ADCs; they cannot alter hardware state or cause physical damage.
   - *Annotation:* Marked with `readOnlyHint: true`.

2. **Amber Instruments (Controlled Hardware Actuation):**
   - *Examples:* `run_relay_stress_test`.
   - *Execution:* Human-gated. When the agent requests an amber tool, the browser immediately pauses execution and renders a high-visibility authorization prompt (`[Authorize & Energize]` vs `[Deny]`).
   - *Fail-Safe Invariant:* The actuator is strictly guaranteed to return to a de-energized `OPEN` state across all termination paths: tool denial, user abort, timeout, exception, or disconnect.

3. **Red Operations (Forbidden):**
   - *Examples:* Flash memory wiping, arbitrary memory writes, unconstrained loop actuation.
   - *Execution:* Blocked unconditionally by Ohmni's capability firewall during descriptor conversion.

4. **Physical Interventions (Human Hands):**
   - The AI agent cannot physically touch wires, replace capacitors, or flip physical jumpers.
   - When a hardware modification is required, the agent calls `request_human_intervention` explaining the electrical rationale. Execution pauses until the human completes the intervention.

---

## Local Development & Quickstart

### Prerequisites
- [Bun](https://bun.sh) (v1.2+)
- Google Chrome or Chromium (latest stable)

```bash
# Clone the repository
git clone https://github.com/Fadyio/Ohmni.git
cd Ohmni

# Install dependencies
bun install

# Start local development server
bun run dev
```

Open `http://localhost:5173` in Google Chrome.

---

## Testing & Verification Suite

Ohmni enforces an automated pre-submission release battery across TypeScript, unit tests, browser rendering, Chrome DevTools Protocol (CDP) automation, and simulated serial hardware.

### Running Verification

```bash
# 1. Unit & Domain Tests (390 tests across 55 suites)
bun test

# 2. TypeScript Static Typecheck
bun run typecheck

# 3. Production Build
bun run build

# 4. Web Serial Unit & Protocol Tests
bun run test:serial

# 5. Real Chrome E2E Web Serial Protocol Acceptance (17 gates)
bun run test:e2e:serial

# 6. Real Chrome WebMCP Diagnostic Agent Acceptance
bun run test:chrome

# 7. Complete Pre-Release Battery (includes all above + motion, chaos, visual)
bun run release:verify
```

### Verification Scope & Boundaries

#### VERIFIED (Automated Evidence):
- **390 unit and domain tests:** 0 failures across 55 test files.
- **Strict TypeScript compilation:** `tsc --noEmit` passes with 0 errors.
- **Production bundling:** `vite build` builds with 0 errors.
- **Web Serial protocol path:** `SerialDeviceAdapter`, `ReferenceSerialDeviceSimulator`, and `WebSerialTransport` lifecycle validated.
- **Real Chrome browser automation:** Handshake, descriptor parsing, WebMCP dynamic tool registration, read tool execution, Amber actuation, evidence generation, safe relay state recovery, disconnect cleanup, and zero console errors verified in real Chrome via CDP.
- **Safety firewall:** Malicious capabilities (`erase_flash`, `raw_memory_write`) verified stripped.
- **Amber approval gate:** Human authorization required before physical actuation.
- **Deterministic virtual challenge:** Full golden path verified from symptom to verified repair.

#### NOT YET VERIFIED (Requires Physical Hardware):
- Electrical behavior on an attached physical ESP32 board.
- Physical board-specific ADC calibration, resistor divider tolerances, and noise floors.
- Real relay coil inrush current and flyback diode response on specific physical boards.

```text
REAL PHYSICAL HARDWARE TESTED: NO
(Software transport, versioned NDJSON protocol, and browser integration verified with simulated peer in real Google Chrome; physical electrical validation requires an attached board).
```

For instructions on connecting and flashing an actual ESP32-S3 development board, see [docs/REAL-HARDWARE-QUICKSTART.md](docs/REAL-HARDWARE-QUICKSTART.md).

---

## License

MIT License — see [LICENSE](LICENSE) for details.
