# ChatGPT Desktop Site-Tools Manual Verification Guide

## Acceptance Status

REAL CHATGPT SITE-TOOLS MANUAL TEST: PASS
Verified by Human (Fady) on 2026-09-04 using ChatGPT Desktop App with Ohmni live WebMCP site tools.

### Acceptance Results (2026-09-04)
- **WebMCP tools discovered:** PASS
- **Read-only instrument calls:** PASS
- **Human approval gate:** PASS
- **Fault reproduced:** PASS
- **Evidence-backed diagnosis:** PASS
- **Human intervention request:** PASS
- **Verification retest:** PASS
- **Final hypothesis confirmation:** PASS
- **Before/after minimum voltages:** 2.72 V → 3.18 V
- **Root cause:** cooling-fan relay load shared the 3.3 V MCU rail, causing MCU brownout.
- **Final repair:** relay supply isolated onto independent 5 V rail.
- **Final verification:** 3.18 V minimum, zero resets.

> [!NOTE]
> **Observed Caveat:**
> The ChatGPT test-call interface displayed a timeout while waiting for the human authorization step. Ohmni itself correctly displayed the Amber approval gate, executed only after authorization, recorded the experiment, completed the subsequent workflow, and reached the final verified result.

---

## Verification Protocol (Reference)

1. Open production Ohmni inside the ChatGPT browser/site-tools environment.
2. Enter the virtual workbench.
3. Confirm ChatGPT detects site tools.
4. Paste the canonical prompt.
5. Do NOT guide the model after that unless approval is requested.
6. Approve the controlled stress test.
7. Simulate the requested repair.
8. Approve the verification test.
9. Confirm ChatGPT independently reaches the verified diagnosis.

## Architecture Context

Ohmni exposes browser-native diagnostic instruments directly on `document.modelContext` using the WebMCP open standard. When you open Ohmni inside ChatGPT's desktop built-in browser:

1. ChatGPT detects the registered instruments from `document.modelContext` (`site-tools`).
2. The user prompts ChatGPT directly in the ChatGPT desktop interface.
3. ChatGPT invokes Ohmni's WebMCP tools via the browser context.
4. Ohmni executes the instrument, updates live telemetry and the oscilloscope on screen, and enforces safety gates.
5. High-risk actuation tools (`run_relay_stress_test`) require the user to click **Approve test** in the Ohmni browser window before hardware actuation occurs.

---

## Step-by-Step Test Procedure

### 1. Open ChatGPT Desktop App
Launch the official ChatGPT macOS desktop application.

### 2. Open Built-In Browser
Navigate to the built-in browser in the ChatGPT desktop app.

### 3. Visit Production URL
Enter the production URL:
```
https://ohmni-three.vercel.app
```

### 4. Enter the Virtual Workbench
On the Ohmni landing page, click:
```
[ Launch virtual diagnosis ]
```
The workbench loads in its quiescent, idle state:
- Top bar displays: `OHMNI · Virtual ESP32 reference device | OBSERVE · TEST · DIAGNOSE · REPAIR · VERIFY | Native WebMCP · Connected · •••`
- Right rail displays: `AGENT ACTIVITY | Waiting for tool calls`

### 5. Verify Site-Tools Discovery
Look for the site-tools indicator / tool icon in the ChatGPT interface.
- ChatGPT should indicate that tools are available on the page.

### 6. Inspect Discovered Tools
Click the tools indicator in ChatGPT to verify that Ohmni instruments are registered:
- `read_device_info` (Read microcontroller hardware identity)
- `read_reset_history` (Inspect recorded MCU reset causes and boot history)
- `measure_supply_voltage` (Measure the controller supply rail at the current operating state)
- `run_relay_stress_test` (Controlled load test — Amber safety-gated)
- Reasoning & Evidence tools (`list_evidence`, `propose_hypothesis`, `request_human_intervention`, `confirm_hypothesis`, etc.)

### 7. Send the Investigation Prompt
In the ChatGPT chat input, enter the canonical prompt (you can click **Copy prompt** in Ohmni's right rail):

```
There is a problem with this controller: it resets when the cooling fan turns on. Investigate the root cause using the available hardware instruments. Gather evidence before proposing a diagnosis. You may use read-only measurements autonomously, but ask for my approval before any actuation or physical change. If you identify a repair, ask me to perform it and then experimentally verify that the problem is fixed.
```

### 8. Confirm Passive Observation Tools Execute
Watch the Ohmni workbench while ChatGPT begins:
- ChatGPT calls `read_device_info` and/or `read_reset_history`.
- Ohmni updates the main instrument view in real time to show **RESET HISTORY**:
  - Brownout resets: 3
  - Watchdog resets: 0
  - Software crashes: 0
- The right rail switches to show completed tool calls under **AGENT ACTIVITY**.

### 9. Confirm Amber Safety Interlock Pauses for User
When ChatGPT decides to test the power rail under relay load by calling `run_relay_stress_test`:
- Ohmni's Amber safety interlock appears:
  - Headline: **Your agent wants to run a controlled load test**
  - Purpose: *See whether relay activation collapses the MCU supply.*
  - Safety envelope: *Maximum actuation: 500 ms · Auto-abort on reset · Relay returns open automatically*
  - Technical tool name: `run_relay_stress_test`
- ChatGPT's execution pauses, waiting for tool resolution.

### 10. Approve the Test
Click `[ Approve test ]` in the Ohmni browser window:
- The oscilloscope becomes active: **LOAD TEST RUNNING**
- The virtual relay energizes.
- The 3.3 V supply collapses below the 2.80 V reset threshold down to 2.72 V.
- Microcontroller resets: screen cleanly transitions to **FAULT REPRODUCED**.
- Waveform freezes at 2.72 V minimum sag. Relay safely returns to open.

### 11. Confirm Evidence Returned to ChatGPT
ChatGPT receives the structured tool result containing:
- `reset_occurred: true`
- `minimum_supply_v: 2.72`
- `evidence_ids: ["E-001", "E-002", "E-003", ...]`
ChatGPT analyzes the result and formulates the diagnosis:
*Relay coil inrush on the shared 3.3 V rail collapses MCU voltage below the reset threshold.*

### 12. Human Repair Intervention & Retest
When ChatGPT calls `request_human_intervention`:
- Ohmni displays the repair scene: **Your agent needs your hands**
- Instruction: *Move the relay supply from the shared 3.3 V MCU rail to the independent 5 V supply.*
- Reason: *This isolates the relay load from the controller's sensitive supply rail.*
- Click `[ Simulate moving JP1 ]` to isolate the relay onto the independent 5 V rail.
- Ohmni displays: `✓ Hardware configuration changed · Waiting for the agent to verify the repair.`
- When ChatGPT requests the retest, approve the verification test (`Authorize & Energize`).
- Retest completes with 3.18 V stable rail and zero resets:
  - Immediately displays empirical result: `Retest passed · rail stable at 3.18 V` / `Awaiting agent confirmation`.
  - Right rail displays verification pending / awaiting confirmation.
  - Zero premature "REPAIR VERIFIED" text is rendered before agent confirmation.
- ChatGPT reviews the empirical evidence and calls `confirm_hypothesis`:
  - Ohmni transitions to the final reveal scene:
    - **REPAIR VERIFIED**
    - **DIAGNOSIS MATCH ✓**
    - **SEALED VIRTUAL GROUND TRUTH**: Relay Supply Misconfiguration
    - **AGENT DIAGNOSIS**: Relay-induced MCU supply brownout
    - Right rail displays: **COMPLETED**

---

## Hardware Boundary & Verification Disclosures

- **Real ChatGPT External WebMCP Flow:** Manually tested and passed.
- **Web Serial Protocol:** Tested with simulated serial peer across 17 automated gates.
- **Real Physical Hardware Electrical Test:** NOT PERFORMED (Physical attached board electrical validation remains future work).
