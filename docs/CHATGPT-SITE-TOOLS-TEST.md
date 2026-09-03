# ChatGPT Desktop Site-Tools Manual Verification Guide

This guide describes how to verify Ohmni using the **ChatGPT Desktop App Built-in Browser** (OpenAI Site-Tools integration).

> [!IMPORTANT]
> This test requires manual verification by an operator in the ChatGPT Desktop app. Do not claim automated PASS without hands-on verification.

---

## Architecture Context

Ohmni exposes browser-native diagnostic instruments directly on `document.modelContext` using the WebMCP open standard. When you open Ohmni inside ChatGPT's desktop built-in browser:

1. ChatGPT detects the registered instruments from `document.modelContext` (`site-tools`).
2. The user prompts ChatGPT directly in the ChatGPT desktop interface.
3. ChatGPT invokes Ohmni's WebMCP tools via the browser context.
4. Ohmni executes the instrument, updates live telemetry and the oscilloscope on screen, and enforces safety gates.
5. High-risk actuation tools (`run_relay_stress_test`) require the user to click **Approve** in the Ohmni browser window before hardware actuation occurs.

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

### 4. Open Agent-Ready Workbench
On the Ohmni landing page, click:
```
[ Open agent-ready workbench ]
```
The workbench loads in its quiescent, idle state:
- Top bar displays: `OHMNI · Virtual ESP32 reference device | OBSERVE · TEST · DIAGNOSE · REPAIR · VERIFY | Native WebMCP · Connected · •••`
- Right rail displays: `YOUR AGENT | Ready for a WebMCP-capable agent`

### 5. Verify Site-Tools Discovery
Look for the site-tools indicator / tool icon in the ChatGPT interface.
- ChatGPT should indicate that tools are available on the page.

### 6. Inspect Discovered Tools
Click the tools indicator in ChatGPT to verify that Ohmni instruments are registered:
- `read_device_info` (Read microcontroller hardware identity)
- `read_reset_history` (Read bootloader crash registers)
- `measure_supply_voltage` (Measure baseline 3.3V rail)
- `run_relay_stress_test` (Controlled load test — Amber safety-gated)
- Reasoning & Evidence tools (`list_evidence`, `propose_hypothesis`, `request_human_intervention`, etc.)

### 7. Send the Investigation Prompt
In the ChatGPT chat input, enter the canonical prompt (you can click **Copy prompt** in Ohmni's right rail):

```
Investigate why this controller resets when the fan turns on.
Use the available instruments.
Gather evidence before proposing a cause.
Do not perform physical actuation without my approval.
```

### 8. Confirm Passive Observation Tools Execute
Watch the Ohmni workbench while ChatGPT begins:
- ChatGPT calls `read_device_info` and/or `read_reset_history`.
- Ohmni updates the main instrument view in real time to show **Reset history**:
  - Brownout resets: 3
  - Watchdog resets: 0
  - Software crashes: 0
- The right rail switches from prompt mode to **CURRENT ACTION** / **INVESTIGATION LOG**, recording completed tool calls.

### 9. Confirm Amber Safety Interlock Pauses for User
When ChatGPT decides to test the power rail under relay load by calling `run_relay_stress_test`:
- Ohmni's Amber safety interlock appears:
  - Headline: **Your agent wants to run a controlled load test**
  - Purpose: *See whether relay activation collapses the MCU supply.*
  - Safety envelope: *Maximum actuation: 500 ms · Relay returns open automatically*
  - Technical tool name: `run_relay_stress_test`
- ChatGPT's execution pauses, waiting for tool resolution.

### 10. Approve the Test
Click `[ Approve test ]` in the Ohmni browser window:
- The oscilloscope becomes active: **LOAD TEST RUNNING**
- The virtual relay energizes.
- The 3.3 V supply collapses below the 2.80 V reset threshold down to 2.72 V.
- Microcontroller resets: screen cleanly transitions to **FAULT REPRODUCED**.
- Waveform freezes at 2.72 V minimum sag. Relay safely opens.

### 11. Confirm Evidence Returned to ChatGPT
ChatGPT receives the structured tool result containing:
- `resetOccurred: true`
- `minimumVoltage: 2.72`
- `evidence_ids: ["E-001", "E-002", "E-003"]`
ChatGPT analyzes the result and formulates the diagnosis:
*Relay coil current causes power supply sag below the 2.80 V brownout threshold.*

### 12. Human Repair Intervention & Retest
When ChatGPT calls `request_human_intervention`:
- Ohmni displays the repair scene: **Your agent needs your hands**
- Instruction: *Move the relay supply from the shared 3.3 V MCU rail to the independent 5 V supply.*
- Click `Simulate moving JP1` to isolate the relay onto the independent 5 V rail.
- Click `[ Tell agent I've changed it ]`.
- Authorize the retest load test.
- Verify Before (2.72 V / Brownout) vs After (3.18 V / Stable).

---

## Verification Status

- **Status:** Requires Fady manual verification in ChatGPT desktop built-in browser.
- **Date:** 2026-09-03
