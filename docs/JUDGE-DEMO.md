# Ohmni Judge Demo

## What this proves

Ohmni lets a bring-your-own WebMCP agent discover and call browser-local hardware instruments as typed tools. The external agent does not need screenshots, UI-coordinate automation, a Groq key, or a private Ohmni API. Its calls use the page's native `document.modelContext`, while Ohmni keeps authorization and physical intervention under human control and reflects every call in the same investigation UI.

The end-to-end external agent flow using ChatGPT Desktop site tools has been manually verified live by a human (see [docs/CHATGPT-SITE-TOOLS-TEST.md](CHATGPT-SITE-TOOLS-TEST.md)). The primary walkthrough below uses the deterministic virtual DUT, so any displayed voltage and electrical behavior are simulator results. It does **not** prove electrical behavior on a physical ESP32 board (REAL PHYSICAL HARDWARE ELECTRICAL TEST: NOT PERFORMED).

## Primary path: external WebMCP agent

### Prerequisites

- A browser-level agent or host that supports native WebMCP tool discovery and invocation, such as a compatible ChatGPT, Codex, or Chromium WebMCP environment.
- The production workbench: [https://ohmni-three.vercel.app](https://ohmni-three.vercel.app)
- No API keys, external models, or physical board required.

If the page reports browser compatibility mode rather than native WebMCP, use a WebMCP-capable host for this primary path. The compatibility context supports Ohmni's built-in fallback, but it does not manufacture browser-level tool access for an external agent.

### Prompt

Copy this prompt from the workbench and give it to the external agent:

> There is a problem with this controller: it resets when the cooling fan turns on. Investigate the root cause using the available hardware instruments. Gather evidence before proposing a diagnosis. You may use read-only measurements autonomously, but ask for my approval before any actuation or physical change. If you identify a repair, ask me to perform it and then experimentally verify that the problem is fixed.

### 19-step script

1. **Open Ohmni** at [https://ohmni-three.vercel.app](https://ohmni-three.vercel.app) inside the WebMCP-capable agent host.

2. **Choose `Launch virtual diagnosis`.** Keep the virtual device selected. This route becomes ready without checking or starting any built-in AI provider.

3. **Confirm the ready state.** It should identify an external WebMCP agent path, show the suggested prompt and a **Copy prompt** action, and identify the connected virtual DUT rather than claiming a physical board.

4. **Confirm native WebMCP availability.** The workbench should report native WebMCP. If the host offers an inspection surface, verify that tools are exposed by the page's `document.modelContext`.

5. **Copy the suggested prompt** shown above and paste it into the external agent. Ask the agent to use the page's WebMCP tools and continue until it either needs human authorization or human hands.

6. **Let the agent discover the live tool set.** The exact count is runtime-derived, not a hardcoded demo number. The available set should include `read_reset_history`, `measure_supply_voltage`, `run_relay_stress_test`, evidence tools, hypothesis tools, and `request_human_intervention` for this virtual descriptor.

7. **Observe `read_reset_history`.** The agent should invoke this read-only tool without approval. The result reports brownout reset history, and the same invocation should appear in Ohmni's investigation history.

8. **Observe `measure_supply_voltage`.** This is also autonomous and read-only. The virtual DUT reports a nominal baseline around **3.31 V**; this is modeled data, not a physical meter reading.

9. **Wait for `run_relay_stress_test`.** The agent should request a bounded call, conventionally `{"cycles":3,"duration_ms":50}`. Do not pre-authorize it in chat.

10. **Verify the Amber gate before clicking anything.** The external tool promise must remain pending, the workbench must show the shared human-approval UI, and the virtual relay must remain open. This demonstrates that WebMCP invocation itself is intercepted; the gate is not merely decoration around the built-in agent.

11. **Approve the test in Ohmni.** Approval must come from the human-facing workbench. To exercise the alternate safe path, a judge may deny first, observe a structured denial with no actuation, then have the agent request the test again and approve it.

12. **Observe the reproduced fault.** After approval, the virtual test drops the modeled rail to about **2.72 V**, below the **2.80 V** brownout threshold, records a reset, returns the relay to open, and creates experiment evidence. The pending external call now resolves.

13. **Let the agent inspect or cite the evidence.** It should use the returned evidence IDs and/or `list_evidence` / `get_evidence`, rather than inventing measurements from the UI.

14. **Let the agent register a hypothesis.** Using `propose_hypothesis`, it should identify relay-coil inrush on the shared 3.3 V rail as the likely cause and cite the pre-repair evidence. The hypothesis should appear in the workbench state.

15. **Wait for `request_human_intervention`.** The agent should request target `relay_power_jumper` and explain why virtual JP1 must move from the shared 3.3 V rail to the independent 5 V rail. This tool opens Ohmni's repair UI; it must not change the jumper automatically.

16. **Perform the human-only virtual intervention.** In Ohmni, choose the **5 V / independent rail** state for JP1 and confirm the change. The workbench applies the virtual-DUT state change and records a human observation. Then tell the external agent that the requested intervention is complete and ask it to continue.

17. **Approve the external agent's retest.** The agent should call `run_relay_stress_test` again. Because it is still an Amber tool, the same approval gate appears again and the new promise remains pending until the judge approves.

18. **Observe post-intervention evidence and hypothesis verification.** The virtual retest should remain around **3.18 V** with zero brownout resets. The agent should read evidence from that exact experiment, use `update_hypothesis`, and then call `confirm_hypothesis` with the post-repair evidence and verified experiment ID.

19. **Confirm the final state.** Ohmni should show an experimentally verified diagnosis, the complete external-agent tool history, both human approvals, the human observation, and the pre/post evidence trail. The conclusion is valid for the deterministic virtual scenario only; do not present it as physical-board electrical verification.

## What to point out during the demo

- **The external agent is replaceable.** The WebMCP contract belongs to the page; ChatGPT, Codex, or another compatible host can discover the same tools.
- **The instruments are structured.** The agent receives schemas and data, not pixels or copied console text.
- **State is shared.** Calls originating outside the app still drive the investigation timeline, evidence, hypothesis, approval, and intervention UI.
- **Safety is on the execution seam.** `run_relay_stress_test` cannot bypass the human gate just because the caller is external.
- **Pure tool server architecture.** The workbench runs without embedded live-LLM dependencies or serverless proxy requirements; external agents discover tools on document.modelContext.

## Optional fallback: built-in deterministic demo

Use this only if the judge's browser-level agent does not support native WebMCP.

### Deterministic walkthrough

1. Reload the workbench and choose **Try built-in demo**.
2. Start the deterministic brownout walkthrough. It requires no API key or network model.
3. Approve the Amber relay test when prompted.
4. Complete the same virtual JP1 intervention when prompted.
5. Approve the retest and observe the verified diagnosis.

This fallback exercises the same registered tool implementations, approval coordinator, evidence ledger, and intervention workflow. It proves the page's behavior but is not a substitute for showing an external host discover native WebMCP tools.

## Optional physical-device path

For a physical transport demonstration, choose **Connect hardware** in a secure desktop Chromium context and select the port in the browser picker. Ohmni opens it at 115200 baud, performs the version-1 newline-delimited JSON `hello`/`descriptor` handshake, derives identity and capabilities from the descriptor, filters those capabilities through its trusted registry, and registers the accepted tools. Disconnecting aborts calls and removes device-specific tools.

The repository includes reference ESP32-S3 firmware, and the Web Serial software path has been exercised against simulated peers. However, this submission has **not** verified physical voltage accuracy, ADC calibration, relay current, flyback response, timing under real load, or successful repair on an attached board. A judge must not interpret the virtual 3.31 V / 2.72 V / 3.18 V values as physical measurements.

## Source inspection map

- [`src/main.tsx`](../src/main.tsx): native WebMCP detection and application wiring.
- [`src/infrastructure/webmcp/mirrored-model-context.ts`](../src/infrastructure/webmcp/mirrored-model-context.ts): native/local registration parity.
- [`src/infrastructure/webmcp/device-tool-registrar.ts`](../src/infrastructure/webmcp/device-tool-registrar.ts): real `registerTool(tool, { signal })` device registration and teardown.
- [`src/infrastructure/webmcp/capability-registry.ts`](../src/infrastructure/webmcp/capability-registry.ts): trusted schemas and device tool implementations.
- [`src/infrastructure/webmcp/execution-coordinator.ts`](../src/infrastructure/webmcp/execution-coordinator.ts): shared ledger, approval, and intervention interception.
- [`src/infrastructure/serial/web-serial-transport.ts`](../src/infrastructure/serial/web-serial-transport.ts): browser Web Serial lifecycle.
- [`src/infrastructure/serial/serial-device-adapter.ts`](../src/infrastructure/serial/serial-device-adapter.ts): handshake, descriptor conversion, capability firewall, RPC, telemetry, reset recovery, and cancellation.
