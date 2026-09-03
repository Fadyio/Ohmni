# OHMNI — WebMCP Challenge Hackathon Submission

## One-Liner
A browser-resident hardware diagnostic and safety layer that exposes microcontroller instruments as native WebMCP tools, allowing AI agents to investigate, actuate, and empirically verify physical faults under human safety supervision.

---

## 1. Why This Use Case is a Strong Fit for WebMCP

Software coding assistants are transforming software development: they can read files, explain stack traces, and write unit tests. But the instant code interfaces with the physical world—embedded microcontrollers, power rails, inductive loads, sensors, and actuators—AI assistants lose visibility. They cannot sample voltages, inspect brownout flags, or verify whether a motor restart was caused by a software crash or power collapse.

A standard remote Model Context Protocol (MCP) server runs in a cloud container or local workstation daemon. It can access databases, git repositories, and cloud APIs, but it cannot safely reach the browser-connected physical devices on a developer's bench.

**WebMCP bridges this physical boundary:**
1. **The browser is the natural hardware boundary:** Through Web Serial, WebUSB, or reference virtual adapters, the browser already manages the direct connection to physical devices.
2. **The browser enforces physical safety interlocks:** The browser's document context can enforce human authorization before physical side effects execute (the Amber Safety Gate).
3. **Zero local setup for operators and judges:** Rather than requiring Python daemons, custom drivers, or complex terminal setups, an engineer or judge opens standard Google Chrome or the ChatGPT in-app browser with WebMCP enabled and immediately interacts with real diagnostic instruments through `document.modelContext`.

*Implementation Note:* Today Ohmni demonstrates this browser-native control plane on a deterministic virtual ESP32 reference device under test (DUT). The device-adapter boundary (`DeviceAdapter`) is explicitly designed to extend to physical browser-connected hardware via Web Serial next.

---

## 2. How WebMCP Creates a Better User Experience

Before WebMCP, hardware troubleshooting was fragmented and dangerous:
- An engineer had to manually configure logic analyzers, multimeters, and oscilloscopes while manually interpreting raw waveform captures.
- LLMs could only offer generic advice like "check your power supply" without any ability to observe what was actually happening on the circuit board.
- Allowing an AI agent to blindly execute scripts against hardware risks permanent damage: energizing coils continuously, shorting outputs, or exceeding voltage limits.

**With WebMCP in Ohmni:**
- **Tiered Safety Envelopes:** The browser classifies tools into passive reads (`green` / read-only) vs physical side effects (`amber` / load-bearing). Passive reads like `read_reset_history` and `measure_supply_voltage` execute autonomously and fluidly, while physical actuations like `run_relay_stress_test` pause execution and demand human consent in the browser UI.
- **Empirical Grounding Over Hallucination:** Every diagnostic observation is committed to an immutable factual ledger (`EvidenceStore`). The agent cannot invent measurements or hallucinate fixed hardware; its hypotheses must cite specific empirical evidence tokens (`E-001`, `E-002`).
- **Verifiable Outcome:** The user does not wonder if the agent is right. The agent re-executes the exact same physical experiment that previously failed, observing whether the voltage sag has disappeared under identical load conditions.

---

## 3. What Humans and Agents Can Do Together That Was Difficult Before

Ohmni establishes a disciplined division of labor between AI reasoning, browser safety policy, and human physical agency:

| Role | Responsibility | Why This Partner Owns It |
|---|---|---|
| **AI Agent (Groq Live / Llama)** | Scientific reasoning, anomaly detection, hypothesis synthesis, experiment selection | Fast causal synthesis across telemetry streams and reset logs |
| **Browser (WebMCP Runtime)** | Hardware abstraction, instrument registry, safety gating, session rate-limiting | The browser owns the device boundary and strictly enforces human consent policies |
| **Human Operator** | Safety authorization, physical intervention (relocating jumpers, flipping switches) | The human owns ultimate consent and has physical hands the agent lacks |

### The Reference Investigation Sequence:
1. **Blind Challenge:** The agent receives only a real-world symptom: *"The controller unexpectedly restarts whenever the cooling fan turns on."* The ground-truth cause (relay coil powered from shared 3.3 V MCU rail instead of isolated 5 V rail) is sealed outside the agent's context.
2. **Autonomous Observation:** The agent calls `read_reset_history` and discovers past `BROWNOUT` reset entries, then measures baseline voltage (`measure_supply_voltage`).
3. **Amber Safety Gate:** To test whether fan actuation collapses the supply rail, the agent requests `run_relay_stress_test`. The browser interlocks the call: the relay remains open and no actuation occurs until the human clicks **[ Approve test ]**.
4. **Empirical Reproduction:** Upon approval, the relay energizes. The 60fps oscilloscope captures the MCU rail collapsing to 2.72 V, crossing the 2.80 V reset threshold and triggering a hardware brownout reset.
5. **Grounded Diagnosis:** The agent registers Hypothesis `H-001`: *"Relay-induced MCU supply brownout due to shared 3.3 V rail."*
6. **Physical Intervention:** The agent recognizes its physical limitation and requests human hands: *"Move jumper JP1 from shared 3.3 V to independent 5 V auxiliary rail."* The human relocates the jumper.
7. **Empirical Retest & Verification:** The agent does not guess. It reruns the identical relay stress test. This time, the rail stays stable at 3.18 V with zero resets. The hypothesis is elevated to `VERIFIED` and the unsealed ground truth reveals a confirmed diagnosis match.

---

## 4. Briefly How WebMCP Was Implemented

### Browser-Native Tool Exposure:
At workbench initialization (`src/main.tsx`), Ohmni detects whether native WebMCP is supported:
```typescript
const isNativeWebMCP = typeof document !== "undefined" && "modelContext" in document;
```
If running in Chrome with `--enable-webmcp-testing` or compatible in-app browsers, Ohmni registers instruments directly onto `document.modelContext`. A standards-compliant fallback adapter ensures standard Chrome browsers can operate during guided evaluation.

### Tool Registry Architecture:
Hardware instruments are registered through `DeviceToolRegistrar` and `CapabilityRegistry`:
- `read_reset_history` (Green / Read-only): Returns hardware reset reason logs.
- `measure_supply_voltage` (Green / Read-only): Samples instantaneous voltage on the primary MCU rail.
- `run_relay_stress_test` (Amber / Mutating): Energizes the relay coil for up to 500 ms while sampling voltage at high frequency. Rejection or timeout guarantees fail-safe de-energization.
- `propose_hypothesis` & `confirm_hypothesis` (Green / Scientific Reasoning): Records and tests explanatory causal hypotheses backed by evidence IDs.

### Agent Modes:
- **Groq Live (`openai/gpt-oss-120b` via Groq LPU):** The production live LLM agent. It receives the real system instruction, discovers registered WebMCP tools dynamically, and makes live tool calls through `/api/bench-agent`.
- **Demo Agent (Deterministic Walkthrough):** A reproducible, scripted fallback agent used for regression verification and self-guided evaluation without requiring external API quota. It is explicitly labeled as a deterministic walkthrough, never disguised as live LLM behavior.

---

## 5. Verification & Testing Instructions for Judges

### Option A: Open in Live Browser (Recommended)
1. Open **https://ohmni-three.vercel.app** in Google Chrome or ChatGPT in-app browser.
2. Click **[ Start blind diagnosis ]**.
3. Confirm the sealed symptom: *"Controller resets when fan starts."*
4. Click **[ Begin Investigation ]**:
   - The workbench mounts with **Native WebMCP** and **Groq Live** indicators.
   - Watch Groq autonomously inspect reset history (`read_reset_history`).
   - Groq requests the controlled relay stress test (`run_relay_stress_test`).
   - The **Amber Safety Gate** blocks execution until you click **[ Approve test ]**.
   - Watch the live oscilloscope trace capture the 2.72 V sag crossing the 2.80 V reset threshold.
5. Groq diagnoses the shared power rail fault and asks for your hands.
6. Click **[ Proceed to Physical Repair ]**:
   - Click **Independent 5 V** to move jumper JP1.
   - Click **[ Tell Agent I changed it ]**.
7. Groq requests an empirical verification retest. Approve the retest.
8. The split-screen verification oscilloscope confirms:
   - **BEFORE:** 2.72 V minimum (Brownout reset triggered)
   - **AFTER:** 3.18 V minimum (Stable, 0 resets)
9. Ground truth is unsealed: **DIAGNOSIS MATCH ✓**.

### Option B: Automated Fail-Closed Judge Verification Gate
From the repository root:
```bash
bun run judge:verify
```
This command tests the live production deployment against 12 strict criteria and fails closed if any mock, fallback, Gemini reference, or failed assertion is detected.
