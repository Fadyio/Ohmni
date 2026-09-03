# OHMNI

> **Give your AI agent instruments for the physical world.**

Ohmni turns hardware measurements and controlled experiments into WebMCP tools. Bring ChatGPT, Codex, or another compatible agent to inspect a virtual device or hardware connected over Web Serial.

**Safety:** The agent can measure and reason autonomously. Physical actuation requires your approval, and physical repairs require your hands.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue)](https://www.typescriptlang.org/)
[![WebMCP](https://img.shields.io/badge/API-WebMCP%20document.modelContext-4967FF)](https://github.com/Fadyio/Ohmni)

- **Open agent-ready workbench:** [https://ohmni-three.vercel.app](https://ohmni-three.vercel.app)
- **Connect hardware:** follow the [physical hardware quickstart](docs/REAL-HARDWARE-QUICKSTART.md)
- **Try built-in demo:** use the secondary demo action in the workbench; no Groq key is required for the deterministic walkthrough
- **Judge walkthrough:** [docs/JUDGE-DEMO.md](docs/JUDGE-DEMO.md)

## What WebMCP uniquely enables

A screenshot can show an oscilloscope, but it does not give an agent a reliable instrument. WebMCP lets a page publish named, typed tools on `document.modelContext`, so an external agent can discover and invoke the page's actual diagnostic operations instead of guessing coordinates or asking a human to transcribe every reading.

In Ohmni, that means a bring-your-own external agent can:

- discover the tools currently allowed by the connected device descriptor;
- read reset history, system health, buses, sensors, and voltage as structured data;
- request a bounded experiment and keep its tool promise pending while the browser asks the human to approve or deny actuation;
- create evidence-linked hypotheses, request a hands-on intervention, and retest the same device path;
- drive the same investigation history and workbench state as the optional built-in agents.

The browser remains the hardware and safety boundary. A device cannot turn an arbitrary descriptor entry into an agent tool: only browser-owned factories in the trusted capability registry may materialize a capability.

## Exact execution architecture

```text
  BYO external WebMCP agent                         Optional built-in agents
 (ChatGPT, Codex, compatible host)              (Groq or deterministic walkthrough)
                │                                               │
   native WebMCP │ getTools / executeTool          same tools only; no adapter bypass
                │                                               │
                ▼                                               ▼
       ┌─────────────────────── MirroredModelContext ───────────────────────┐
       │                                                                    │
       │  native document.modelContext                 InMemoryModelContext │
       │  (authoritative external surface)             (built-in execution)│
       └──────────────────────────────┬─────────────────────────────────────┘
                                      │ effective wrapped tool
                                      ▼
                         WebMCPExecutionCoordinator
                    ┌─────────────────┼──────────────────┐
                    │                 │                  │
             invocation ledger   approval gate   intervention workflow
             (shared UI state)    (Amber tools)   (human observation)
                    └─────────────────┼──────────────────┘
                                      │
                  ┌───────────────────┴────────────────────┐
                  │                                        │
       DeviceToolRegistrar                       evidence + hypothesis tools
        CapabilityRegistry                       immutable experiment records
       (trusted factories only)                    and diagnostic reasoning
                  │
                  ▼
             DeviceAdapter
             ┌────┴──────────────────────────────────────────┐
             │                                               │
   VirtualDeviceAdapter                         SerialDeviceAdapter
   deterministic virtual DUT             WebSerialTransport (`navigator.serial`)
                                                           │
                                              115200 baud, NDJSON protocol v1
                                                           │
                                                           ▼
                                                attached microcontroller
```

When native WebMCP exists, registrations are mirrored to the browser's authoritative `document.modelContext` for the external agent and to the local execution context used by the optional built-in agents. Every effective tool is wrapped by the same coordinator, so origin does not bypass safety, evidence, or UI history. In a browser without native WebMCP, Ohmni installs its in-memory compatibility context for the built-in experience; a BYO browser-level agent still requires a WebMCP-capable host.

## Two agent usage modes

1. **Bring your own external agent (primary):** a compatible ChatGPT, Codex, or other browser-level agent discovers the native tools on `document.modelContext` and drives the workbench. Ohmni does not require or start Groq for this mode.
2. **Use a built-in agent (secondary):** opt into Groq when its endpoint is configured, or choose the deterministic walkthrough for a no-key fallback. Both are WebMCP consumers and use the same tool implementations as the external agent.

Either agent mode can reason over the virtual DUT. The external path can also operate descriptor-approved instruments from a device connected over Web Serial.


## Device mode 1: virtual DUT

This is the default judge path and requires neither a physical board nor Groq.

1. Open the agent-ready workbench in a WebMCP-capable browser or agent host.
2. Keep the default virtual device and copy the suggested prompt.
3. Give that prompt to your external agent. It discovers and invokes Ohmni's registered page tools.
4. Approve or deny the relay stress test in Ohmni—not in the agent chat. Approval releases the already-pending WebMCP call; denial leaves the relay open and returns a denial result.
5. When the agent requests a repair, use the workbench's human-intervention UI to simulate moving virtual JP1, record the human observation, then ask the agent to continue and retest.

Suggested prompt:

> The controller restarts unexpectedly whenever the cooling fan relay turns on. Investigate the root cause using the available WebMCP diagnostic instruments, request human help at the device boundary when needed, and experimentally verify the repair.

The complete 19-step script, expected results, and a no-Groq fallback are in [docs/JUDGE-DEMO.md](docs/JUDGE-DEMO.md).

## Device mode 2: Web Serial device

1. Use desktop Chrome, Edge, Opera, or Brave in a secure context (`https://` or `localhost`). Web Serial is not available in Safari or Firefox.
2. Choose **Connect hardware**, select the serial port in the browser-owned picker, and keep the board at **115200 baud**.
3. Ohmni sends `{"type":"hello","protocol":1}` followed by a newline. The peer must answer with a valid protocol-v1 `descriptor` message.
4. `SerialDeviceAdapter` derives the displayed device identity and capabilities from that descriptor. Red, destructive, forbidden, unknown, or otherwise untrusted capabilities are not registered.
5. Allowed capabilities become the external agent's WebMCP tools. RPC requests are correlated; cancellation sends a protocol cancel message; asynchronous events and chunked telemetry feed the workbench; reset boot text is quarantined and triggers re-handshake.
6. Disconnecting aborts the device session, rejects active work, returns actuators to their safe state, and unregisters device tools through the session `AbortSignal`.

The reference protocol peer is in [`firmware/ohmni-esp32-reference/`](firmware/ohmni-esp32-reference/). Software support for this path is implemented by [`web-serial-transport.ts`](src/infrastructure/serial/web-serial-transport.ts), [`serial-device-adapter.ts`](src/infrastructure/serial/serial-device-adapter.ts), and [`protocol.ts`](src/infrastructure/serial/protocol.ts).

## Optional built-in agents are secondary

External WebMCP is the product path. The default virtual workbench does not require, check, or start Groq.

- **Built-in Groq:** an opt-in convenience when the deployment has its Groq endpoint configured. It discovers and executes the same WebMCP tools; it does not call `DeviceAdapter` privately.
- **Deterministic walkthrough:** the reliable offline/no-key fallback. Choose **Try built-in demo** to run the canonical brownout investigation through the same WebMCP tool surface, approval gate, evidence ledger, and intervention UI.

Neither fallback changes which tools exist or weakens the safety policy.

## Real registration path

Ohmni does not merely display tool-shaped JSON. This is the production registration loop, copied from [`src/infrastructure/webmcp/device-tool-registrar.ts`](src/infrastructure/webmcp/device-tool-registrar.ts):

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

`tool` is a real `ModelContextTool` produced by a trusted factory. For example, the current `measure_supply_voltage` factory in [`src/infrastructure/webmcp/capability-registry.ts`](src/infrastructure/webmcp/capability-registry.ts) is:

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

The `AbortController` owns the device session: disconnecting it removes those registrations. The real source path is:

1. [`src/main.tsx`](src/main.tsx) — detects native WebMCP and creates the model context, registries, adapters, and stores.
2. [`src/infrastructure/webmcp/mirrored-model-context.ts`](src/infrastructure/webmcp/mirrored-model-context.ts) — keeps native registration authoritative while providing the same effective tools to local consumers.
3. [`src/infrastructure/webmcp/execution-coordinator.ts`](src/infrastructure/webmcp/execution-coordinator.ts) — wraps invocations with shared ledger, approval, and intervention behavior.
4. [`src/infrastructure/webmcp/device-tool-registrar.ts`](src/infrastructure/webmcp/device-tool-registrar.ts) — registers only descriptor capabilities accepted by the registry and tears them down on disconnect.
5. [`src/infrastructure/webmcp/capability-registry.ts`](src/infrastructure/webmcp/capability-registry.ts) — owns the vetted device-tool schemas and implementations.
6. [`src/infrastructure/webmcp/evidence-tools.ts`](src/infrastructure/webmcp/evidence-tools.ts) and [`hypothesis-tools.ts`](src/infrastructure/webmcp/hypothesis-tools.ts) — register evidence and diagnostic-reasoning tools.

## Safety model

| Class | Examples | Agent behavior | Browser behavior |
|---|---|---|---|
| Green / read-only | `read_reset_history`, `measure_supply_voltage`, `read_system_health` | May invoke autonomously | Runs through the adapter and records the result |
| Amber / actuation | `run_relay_stress_test` | May request, but cannot self-authorize | Keeps the call pending; the human approves or denies; bounded execution returns relay to open on denial, abort, timeout, error, or disconnect |
| Human hands | jumper, cable, component, or switch change | Calls `request_human_intervention` with target, instruction, and rationale | Opens the repair workflow; only the human applies the change and records an observation |
| Red / forbidden | flash erase, raw memory write, arbitrary serial, eFuse or bootloader modification | Not available | Stripped before registration |

The approval is attached to the tool execution path, not just to a button in the built-in demo. An external invocation therefore receives the same gate. `request_human_intervention` never silently changes device state.

## Local development

Prerequisites: [Bun](https://bun.sh) 1.2+ and a current Chromium browser.

```bash
git clone https://github.com/Fadyio/Ohmni.git
cd Ohmni
bun install
bun run dev
```

Open `http://localhost:5173`. Use a WebMCP-capable host for the external-agent path; use **Try built-in demo** for a browser-independent, no-key walkthrough.

Common verification commands maintained by the repository include:

```bash
bun test
bun run typecheck
bun run build
bun run test:serial
bun run test:e2e:serial
bun run test:chrome
bun run release:verify
```

## Verification boundary

**Verified in software:** the virtual scenarios, tool schemas and lifecycle, safety firewall, shared approval flow, evidence and hypothesis state, Web Serial protocol parsing and lifecycle, and browser behavior exercised against virtual or simulated serial peers.

**Not verified on a physical board:** electrical voltage/current values, ADC calibration, divider tolerances, noise floors, relay-coil inrush, flyback behavior, timing under real load, or successful repair of an attached device. The values shown in the virtual brownout challenge (including 3.31 V baseline, 2.72 V sag, and 3.18 V post-intervention result) are deterministic simulator outputs, not physical measurements.

```text
PHYSICAL-BOARD ELECTRICAL VERIFICATION: NOT PERFORMED
Web Serial software and protocol behavior have been exercised with simulated peers;
an attached board and external instruments are still required for electrical validation.
```

## License

MIT License — see [LICENSE](LICENSE) for details.
