# OHMNI — WebMCP Challenge Hackathon Submission

> **Coding agents can inspect software, but they cannot inspect the physical board on your desk. Ohmni uses WebMCP to give an agent safe browser-native hardware instruments.**

- **Live Production URL:** [https://ohmni-three.vercel.app](https://ohmni-three.vercel.app)
- **Repository:** [https://github.com/Fadyio/Ohmni](https://github.com/Fadyio/Ohmni)
- **License:** [MIT License](https://github.com/Fadyio/Ohmni/blob/main/LICENSE) (Open Source)
- **Track:** The WebMCP Challenge (Devpost)

---

## Executive Summary

Software coding assistants can read repositories, refactor functions, explain stack traces, and generate unit tests. But the instant code interfaces with the physical world—embedded microcontrollers, power supplies, inductive coils, sensors, and actuators—AI assistants lose all perception. They cannot probe a supply rail, inspect a hardware brownout detector, or determine whether an unexpected reboot was caused by a software null pointer or an electrical supply collapse.

Standard remote Model Context Protocol (MCP) servers live in cloud containers or local workstation daemons. They can query databases, git trees, and REST endpoints, but they cannot safely interface with browser-connected physical devices on an engineer's workbench.

**Ohmni turns the browser into a hardware diagnostic and safety boundary using WebMCP.** By exposing microcontroller diagnostic instruments directly through `document.modelContext`, an AI agent can autonomously inspect registers, sample voltages, formulate empirical hypotheses, and request physical interventions—while the browser enforces human safety approval before any physical side effects occur.

---

## The Four Official Judging Criteria

### 1. WebMCP Leverage

Ohmni is fundamentally built around WebMCP; it cannot exist as a conventional web application or remote MCP server.

* **Browser as Hardware Host:** Modern browsers provide direct, sandboxed access to local peripherals via APIs like Web Serial (`navigator.serial`). Remote MCP servers cannot touch local USB ports without external daemons, complex driver configurations, or security bypasses.
* **Instruments, Not Screenshots:** Instead of forcing multimodal models to parse screenshots, guess button coordinates, or automate fragile UI clicks, WebMCP exposes typed, structured diagnostic instruments directly to the agent runtime via `document.modelContext.registerTool(...)`.
* **Dynamic Descriptor-Driven Registration:** Tools are not hardcoded static endpoints. When a device (virtual or physical) connects, Ohmni parses its hardware descriptor, filters it through a browser-owned security firewall, and dynamically materializes vetted WebMCP tools onto `document.modelContext` with strict JSON Schema definitions and safety annotations (`readOnlyHint`).
* **Clean Lifecycle & Unregistration:** When a device disconnects, Ohmni aborts active calls and immediately unregisters device-specific tools from `document.modelContext`, guaranteeing the agent cannot invoke dangling or stale hardware instruments.
* **Native Context Authority:** On Chromium browsers supporting native WebMCP, Ohmni registers instruments onto the real `document.modelContext`. A mirrored execution context maintains synchronization without replacing or mutating the native browser object.

### 2. Execution

Ohmni is engineered to production standards with comprehensive automated verification:

* **Working Production Deployment:** Live at [https://ohmni-three.vercel.app](https://ohmni-three.vercel.app), served over HTTPS with zero build errors.
* **External WebMCP Agent & Deterministic Walkthrough:** Ohmni is built external-agent first via standard `document.modelContext`, accompanied by a pure clientside deterministic demo walkthrough requiring zero API keys or external serverless proxies.
* **Amber Safety Gate:** Human-in-the-loop authorization interlock. Passive observational tools execute autonomously; mutating or power-actuating tools pause execution and demand explicit human approval.
* **60fps Technical Oscilloscope:** Hardware-accelerated Canvas oscilloscope rendering real-time supply voltage waveforms, threshold trigger lines (2.80 V BOD threshold), and annotated fault markers.
* **Empirical Evidence Ledger:** Diagnostic findings are immutably recorded into an `EvidenceStore` (`E-001`, `E-002`). The agent cannot hallucinate a fix; it must cite empirical evidence tokens when proposing and confirming hypotheses (`H-001`).
* **Automated Real Browser Acceptance Gates:** The repository includes `bun run test:chrome` and `bun run test:e2e:demo`, automated end-to-end audit suites run via Chrome DevTools Protocol (CDP) verifying native WebMCP registration, Amber gate blocking, fault reproduction, jumper intervention, and repair verification.
* **Automated Test Battery:** 390 passing automated unit and domain tests across 55 test suites, full TypeScript strict typechecking (`tsc --noEmit`), and 17 end-to-end Chrome Web Serial protocol gates.

### 3. Potential Impact

Hardware debugging is notoriously slow, fragmented, and inaccessible:

* **Eliminating the Bench Bottleneck:** Embedded engineers and hardware hackers routinely spend days tracking down intermittent resets. Ohmni allows an agent to methodically read boot logs, sample power rails, test loads under controlled envelopes, and isolate root causes in under 2 minutes.
* **Zero-Setup Hardware Lab:** Rather than installing Python environments, proprietary vendor IDEs, logic analyzer software, or terminal monitors, an engineer or evaluator opens Google Chrome and immediately begins diagnosing devices.
* **Safe Autonomous Diagnostics:** Inductive kickback, brownouts, and overcurrent can permanently destroy development boards. Ohmni's safety envelope bounds actuation duration (e.g. 500 ms max) and guarantees fail-safe de-energization across all failure modes (user denial, abort, timeout, exception, or disconnect).
* **Democratizing Hardware Education:** For students and software developers who do not own physical multimeters or oscilloscopes, Ohmni provides a deterministic reference environment that teaches real electrical engineering principles (inrush current, supply impedance, brownout reset circuits) through structured agent collaboration.

### 4. Creativity & Ambition

Rather than applying WebMCP to common software tasks (chatbots, CRM forms, code editors), Ohmni tackles the boundary between digital AI reasoning and physical electronics:

* **Bridging Code to Atoms:** Ohmni gives AI agents instruments to observe and actuate real physical dynamics (voltage sags, relay coils, DC fan loads, microcontrollers).
* **Scientific Reasoning Loop:** The interaction model mirrors the scientific method:
  1. *Observe:* Autonomous passive telemetry sampling.
  2. *Hypothesize:* Formulate falsifiable causal explanations.
  3. *Experiment:* Run human-gated, bounded electrical stress tests.
  4. *Intervene:* Request physical human modifications (moving jumpers).
  5. *Verify:* Retest under identical load to confirm empirical resolution.
* **Dual Execution Architecture:** Seamlessly supports both an in-browser deterministic virtual reference board for instant evaluation and real microcontrollers over Web Serial.

---

## 1. Why WebMCP is Essential for This Use Case

Coding agents can inspect source code, but they cannot inspect the circuit board sitting on your desk. 

Browser APIs such as Web Serial already own the local hardware connection to physical devices. WebMCP exposes those browser-local capabilities to agents as structured, typed instruments instead of screenshots, coordinate-based UI automation, or fragile command-line wrappers.

Without WebMCP, an agent attempting to diagnose hardware must either:
1. Ask the human to copy-paste terminal logs and multimeter numbers back and forth.
2. Rely on brittle desktop automation that clicks buttons on screen without understanding device state.
3. Use a remote cloud server that has zero physical access to the local USB bus.

With WebMCP, the browser exposes hardware capabilities directly to the agent's reasoning loop:
```text
Microcontroller (USB Serial) ──► Browser (Web Serial / Transport)
                                        │
                                        ▼
                             Capability Registry (Firewall)
                                        │
                                        ▼
                             document.modelContext (WebMCP)
                                        │
                                        ▼
                       External Agent (WebMCP) / Demo Agent
```

---

## 2. Division of Labor: Human + Agent Collaboration

Ohmni enforces a clear, principled division of responsibility between the agent, the browser, and the human operator:

```text
┌────────────────────────┐   ┌────────────────────────┐   ┌────────────────────────┐
│        AI Agent        │   │    Browser (WebMCP)    │   │     Human Operator     │
│   (External / Demo)    │   │     (Safety Mesh)      │   │     (Physical Hands)   │
├────────────────────────┤   ├────────────────────────┤   ├────────────────────────┤
│ • Measures voltages    │   │ • Registers tools      │   │ • Approves actuation   │
│ • Reads reset history  │   │ • Enforces firewall    │   │ • Modifies jumpers     │
│ • Bounded experiments  │   │ • Gates side effects   │   │ • Replaces components  │
│ • Collects evidence    │   │ • Owns device lifecycle│   │ • Retains veto power   │
│ • Proposes hypotheses  │   │ • Captures telemetry   │   │ • Ultimate consent     │
│ • Retests to verify    │   │ • Guaranteed cleanup   │   │                        │
└────────────────────────┘   └────────────────────────┘   └────────────────────────┘
```

* **The AI Agent owns the investigation:** It synthesizes symptoms, inspects telemetry, detects anomalies, chooses diagnostic experiments, and forms hypotheses.
* **The Browser owns device boundary and safety:** It manages peripheral transports, converts device descriptors into vetted tools, enforces rate limits, bounds actuation duration, and blocks unapproved side effects.
* **The Human owns physical consent and intervention:** The human verifies the electrical safety envelope before actuating loads, moves physical jumpers when intervention is requested, and maintains ultimate authority over the physical bench.

---

## 3. How WebMCP is Implemented

### Native Browser Tool Registration

In `src/main.tsx`, Ohmni detects native Chromium WebMCP support (`"modelContext" in document`). When present, it wraps the native surface with `MirroredModelContext`:

```typescript
const isNativeWebMCP =
  typeof document !== "undefined" &&
  Boolean((document as unknown as { modelContext?: unknown }).modelContext);

const nativeModelContext = isNativeWebMCP
  ? (document as unknown as { modelContext: ModelContext }).modelContext
  : undefined;

const modelContext = nativeModelContext
  ? new MirroredModelContext(nativeModelContext)
  : new InMemoryModelContext();
```

Hardware instruments are registered dynamically through `DeviceToolRegistrar` and `CapabilityRegistry`:

```javascript
document.modelContext.registerTool({
  name: "measure_supply_voltage",
  description: "Measure the connected device's primary supply rail without changing hardware state.",
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

### Core Architecture Components

1. **`src/infrastructure/webmcp/mirrored-model-context.ts`**: Keeps the browser's native `document.modelContext` authoritative for external discovery while providing the agent runtime with a reliable execution mirror.
2. **`src/infrastructure/webmcp/device-tool-registrar.ts`**: Coordinates dynamic registration and unregistration of hardware instruments based on device descriptors, binding tool lifecycles to an `AbortController`.
3. **`src/infrastructure/webmcp/capability-registry.ts`**: Browser-owned capability firewall that maps vetted capability names (`measure_supply_voltage`, `read_reset_history`, `run_relay_stress_test`) to safe tool factories. Untrusted or malicious capabilities (`erase_flash`, `raw_memory_write`) are stripped unconditionally.
4. **`src/infrastructure/serial/serial-device-adapter.ts`**: Manages the Web Serial transport, NDJSON v1 framing, request-response correlation, handshake timeout, telemetry streaming, and fail-safe cleanup.
5. **`src/infrastructure/webmcp/evidence-tools.ts`**: Exposes read-only evidence query tools (`list_evidence`, `get_evidence`) backed by an immutable ledger.
6. **`src/infrastructure/webmcp/hypothesis-tools.ts`**: Exposes structured reasoning tools (`propose_hypothesis`, `link_evidence`, `confirm_hypothesis`).
7. **Amber Safety Gate**: Tools with side effects (`readOnlyHint: false`) route through `ExperimentRunner`, which halts execution and renders the Amber authorization prompt until the human approves.
8. **Safe-State Cleanup**: On abort, timeout, error, or disconnect, the transport dispatches emergency cutoff frames (`{"cmd":"emergency_stop"}`) ensuring actuators never remain energized.

---

## 4. Hardware Implementation & Honesty Notice

Ohmni provides two device backends behind the shared `DeviceAdapter` interface:

1. **Virtual Reference Challenge:** An in-browser, deterministic ESP32-S3 model simulating non-linear electrical dynamics, relay coil inrush current, power rail impedance, and hardware brownout detection. This allows judges and evaluators to experience the full diagnostic flow with zero hardware prerequisites.
2. **Physical Web Serial Mode:** A fully implemented browser-to-microcontroller transport operating over Web Serial at 115200 baud using versioned NDJSON v1. It includes automated handshake negotiation, descriptor discovery, dynamic capability registration, high-frequency telemetry streaming, and reference ESP32 firmware ([firmware/ohmni-esp32-reference/](firmware/ohmni-esp32-reference/)).

### Hardware Verification Boundary

> **Honesty & Verification Notice:**
> 
> * **Implemented & Verified:** Browser Web Serial transport (`WebSerialTransport`), device protocol framing (`NDJSONParser`), descriptor negotiation, dynamic tool discovery, WebMCP tool registration, high-frequency telemetry ingestion, Amber approval gating, emergency cutoff, and clean disconnect unregistration. These are verified end-to-end in real Google Chrome using a simulated serial peer across 17 automated acceptance gates (`bun run test:e2e:serial`).
> * **Not Physically Validated:** Actual physical electrical behavior on an attached physical ESP32 board (including real ADC resistor divider tolerances, board-specific noise floors, and physical relay coil flyback spikes) has not yet been benchmarked on a physical test bench.
> 
> We do not claim physical board electrical validation that has not occurred. The software transport and protocol layers are fully implemented and verified.

---

## 5. Judge Verification Instructions

### Option 1: External Agent via ChatGPT Desktop or WebMCP Host
1. Open **[https://ohmni-three.vercel.app](https://ohmni-three.vercel.app)** in ChatGPT Desktop App built-in browser or a WebMCP-enabled browser.
2. Click **[ Launch virtual diagnosis ]**.
3. Copy the canonical prompt: *"There is a problem with this controller: it resets when the cooling fan turns on. Investigate the root cause using the available hardware instruments. Gather evidence before proposing a diagnosis. You may use read-only measurements autonomously, but ask for my approval before any actuation or physical change. If you identify a repair, ask me to perform it and then experimentally verify that the problem is fixed."*
4. Provide the prompt to your external agent.
5. The agent discovers Ohmni's registered instruments on `document.modelContext`, probes reset logs and rail voltage, pauses at the Amber gate for `run_relay_stress_test`, requests moving jumper JP1 to 5 V, retests, and confirms diagnosis.

### Option 2: Deterministic Demo Walkthrough
1. Open **[https://ohmni-three.vercel.app](https://ohmni-three.vercel.app)**.
2. Click **[ Launch virtual diagnosis ]** (or click **How it works →**).
3. Follow the guided demo walkthrough.
4. Approve the controlled relay stress test at the Amber gate.
5. Move virtual jumper JP1 to Independent 5 V and notify the agent.
6. Approve the retest and observe the verified diagnosis (**DIAGNOSIS MATCH ✓**).

### Option 3: Automated Chrome E2E Acceptance Gates
From the repository root:
```bash
bun run test:chrome       # Native WebMCP CDP orchestration & visual verification matrix
bun run test:e2e:demo     # Pure static E2E deterministic golden path (0 mocks)
bun run test:webmcp:external # External agent simulated WebMCP client flow
```

### Option 3: Full Automated Test Battery
```bash
bun run typecheck        # Strict TypeScript compilation (0 errors)
bun test                 # 390 unit and domain tests (0 failures)
bun run build            # Production Vite bundling (0 errors)
bun run test:serial      # Web Serial unit and protocol tests
bun run test:e2e:serial  # Real Chrome Web Serial protocol acceptance (17 gates)
bun run release:verify   # Complete pre-release battery
```
