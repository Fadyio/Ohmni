# OHMNI — Devpost Hackathon Submission

## One-Liner
A browser-native AI hardware investigation lab powered by WebMCP that safely investigates, actuates, and experimentally verifies physical faults on connected microcontrollers.

---

## Problem
AI coding agents are transforming software engineering. They can read codebases, fix syntax errors, run tests, and refactor architecture. But the moment software interfaces with the physical world—a robot, an environmental sensor board, an industrial motor controller—AI agents become completely blind. 

They cannot safely probe physical voltages. They cannot observe brownout restarts. They cannot actuate inductive loads without risking hardware damage. And when a physical jumper is misplaced or a sensor address is mismatched, software agents either hallucinate the bug or give up.

---

## Why WebMCP?
A remote Model Context Protocol (MCP) server runs in a cloud container or local workstation daemon. It can access cloud APIs and filesystem paths. **WebMCP can reach the device on your desk.**

By leveraging the browser's emerging `document.modelContext` standard:
1. **The browser owns the physical device connection** (via Web Serial or virtual hardware adapters).
2. **The browser enforces physical safety boundaries** (Amber authorization gates prevent unauthorized actuation).
3. **The human and AI collaborate naturally**: Gemini performs scientific reasoning and diagnostic instrument operation; the human provides physical hands and safety consent.
4. **Zero desktop software installation**: Judges and engineers can inspect real hardware instruments directly in standard Google Chrome.

---

## What It Does
Ohmni turns the browser into an interactive hardware diagnostic lab:
- **Blind Mystery Fault Challenge**: A hardware fault is injected into a virtual or physical ESP32-S3 controller. Neither Gemini nor the human is told what the fault is. The ground truth is sealed outside the agent's context.
- **Autonomous Empirical Investigation**: Gemini discovers 19 native WebMCP instruments (oscilloscope sampling, reset history logs, I²C bus scanners, logic state analyzers) and autonomously investigates the symptom.
- **Physical Safety Gate**: When Gemini needs to run an active physical test (like cycling a high-load cooling relay), the browser pauses and demands human approval (`[Approve]` / `[Deny]`).
- **Human Collaboration Loop**: Gemini synthesizes an evidence-backed hypothesis and asks the human for physical assistance: *"I need your hands. Move jumper JP1 from the shared 3.3V rail to the external 5V supply."*
- **Empirical Verification**: Gemini does not guess whether the repair worked. It reruns the identical physical stress test, measures the new voltage curve, proves that resets have ceased, and confirms the repair.
- **Ground Truth Reveal**: The sealed fault is unsealed, displaying a semantic diagnosis match and full before/after split-scope proof.

---

## How It Works: Technical Architecture
- **WebMCP Integration**: Tools are registered on `document.modelContext` using standards-compliant tool definitions. Both native Chrome WebMCP (`--enable-features=WebMCPTesting`) and high-fidelity fallback modes are seamlessly supported.
- **Domain Modeling**: Clean separation between immutable factual evidence (`EvidenceStore`: `E-001`, `E-002`), revisable explanatory hypotheses (`HypothesisStore`: `H-001`), and physical intervention points (`InterventionStore`).
- **Telemetry Engine**: 60fps WebGL/Canvas oscilloscope rendering with ring buffers, real-time voltage sag sampling, and hardware reset trigger markers.
- **Deterministic Mystery Engine**: Three canonical hardware scenarios:
  1. *Relay Supply Brownout* (ESP32-S3 shared 3.3V rail collapse under inrush current).
  2. *I²C Address Mismatch* (Sensor hardware acknowledges at 0x77 while firmware polls 0x76).
  3. *Physical SDA Continuity Fault* (Floating SDA bus line due to unseated jumper wire).
- **Safety Invariants**: Physical tools enforce the *Fail-Safe Open Relay Invariant*—the relay coil is guaranteed open on all exit paths (normal return, error, timeout, denial, emergency stop, or device disconnect).

---

## Human + Agent Collaboration
In Ohmni, the AI and the human have complementary, non-overlapping capabilities:
- **AI Agent**: Hypothesis generation, causal reasoning, multi-instrument sequencing, statistical anomaly detection, and automated test execution.
- **Human**: Physical actuation consent, safety oversight, and mechanical hands (moving physical jumpers, reseating cables, flipping DIP switches).
- **WebMCP**: The bidirectional bridge that makes this partnership safe, structured, and auditable.

---

## Challenges We Overcame
1. **Preventing Truth Leaks**: Ensuring that the LLM could not cheat by inspecting hidden scenario parameters. We built an automated hidden-state firewall test (`tests/security/scenario-hidden-state-audit.test.ts`) that verifies zero ground-truth values exist in prompt context, tool schemas, or public evidence tokens.
2. **Timing & Race Conditions in Browser Automation**: Synchronizing Chrome CDP remote debugging with 60fps oscilloscope rendering and React 19 `AnimatePresence` transitions without fragile arbitrary sleeps.
3. **Physical Safety Without Stalling**: Designing the Amber approval workflow so that non-mutating observational tools (`read_reset_history`, `measure_supply_voltage`) execute autonomously without annoying the user, while genuinely destructive or load-bearing actuations (`run_relay_stress_test`) always pause for consent.

---

## What's Next
- **Expanded Physical Hardware Drivers**: Productionizing the Web Serial driver for USB-connected ESP32, STM32, and Raspberry Pi Pico boards.
- **Logic Analyzer Waveform Tools**: Exposing SPI and UART protocol decoding over WebMCP.
- **Collaborative Remote Multi-User Labs**: Allowing remote engineers to pair with local lab technicians through shared WebMCP sessions.

---

## Demo Instructions for Judges
1. Visit the deployed application: **https://ohmni-three.vercel.app**
2. Click **[ Start Mystery Diagnosis ]**.
3. Observe the sealed fault status: Gemini receives only the symptom ("The controller unexpectedly restarts when the fan turns on").
4. Click **[ Begin Investigation ]**:
   - Watch Gemini autonomously query reset history and observe brownout reset records.
   - Watch Gemini request the physical relay stress test.
   - Click **[ Approve test ]** (or press keyboard key `A`).
   - Watch the live 60fps oscilloscope capture the rail voltage collapsing to 2.72V and triggering a brownout.
5. Gemini synthesizes Hypothesis `H-001` and asks for your hands.
6. Click **[ Proceed to physical verification & repair ]**:
   - Select **External 5 V** jumper setting.
   - Click **[ Tell Gemini I changed it ]**.
7. Gemini requests an experimental re-test. Click **[ Approve Retest ]**.
8. Observe the split-screen Before vs After scope: voltage remains stable at 3.18V with zero resets.
9. Ground truth is revealed: **MATCH ✓**.
