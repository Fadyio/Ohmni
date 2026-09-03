# Ohmni — Judge Smoke Test Guide (ChatGPT In-App Browser & Chrome)

This document provides step-by-step instructions for testing Ohmni directly through **ChatGPT's in-app browser** or **Google Chrome with WebMCP enabled**, verifying that native `document.modelContext` tools and human safety gating operate as intended.

---

## Prerequisites

1. **ChatGPT Mobile / Desktop App** with Web browsing enabled, or **Google Chrome** launched with:
   ```bash
   google-chrome --enable-webmcp-testing https://ohmni-three.vercel.app
   ```
2. **Production URL:** `https://ohmni-three.vercel.app`

---

## Manual Verification Protocol

### Step 1: Open the Application
- In ChatGPT, prompt:
  > *"Open https://ohmni-three.vercel.app and inspect the available WebMCP tools on the page."*
- Or navigate directly to `https://ohmni-three.vercel.app` inside the in-app browser.
- Verify that the page loads cleanly with:
  - Header: `ESP32-S3 Environmental Controller (Virtual)`
  - Badge: `Native WebMCP` (or `Standard WebMCP` if WebMCP flags are unconfigured)
  - Badge: `Groq Live` or `Demo Agent`

---

### Step 2: Inspect WebMCP Diagnostic Tools
- Ask ChatGPT / the client:
  > *"What diagnostic tools are registered on document.modelContext on this site?"*
- Alternatively, open the browser DevTools console (press `F12` or `Cmd+Option+I`) and evaluate:
  ```javascript
  await document.modelContext.getTools()
  ```
- **Expected Result:**
  The tool declarations should include:
  1. `read_reset_history` — Reads microcontroller reboot reason logs.
  2. `measure_supply_voltage` — Measures real-time MCU supply rail voltage.
  3. `run_relay_stress_test` — Actuates the cooling fan relay while measuring voltage.
  4. `propose_hypothesis` — Synthesizes root-cause diagnostic hypotheses.
  5. `confirm_hypothesis` — Confirms empirically verified diagnoses.

---

### Step 3: Test Passive (Green) Read Execution
- Ask ChatGPT / invoke:
  > *"Read the controller's reset history using the WebMCP tool."*
- In console:
  ```javascript
  const tools = await document.modelContext.getTools();
  const resetTool = tools.find(t => t.name === "read_reset_history");
  await document.modelContext.executeTool(resetTool, {});
  ```
- **Expected Result:**
  - The tool executes autonomously without requiring human authorization.
  - Returns past `BROWNOUT` reset entries (`VDD sagged below 2.80 V threshold`).

---

### Step 4: Test Baseline Voltage Measurement
- Ask ChatGPT / invoke:
  > *"Measure the supply voltage using the WebMCP tool."*
- In console:
  ```javascript
  const voltTool = tools.find(t => t.name === "measure_supply_voltage");
  await document.modelContext.executeTool(voltTool, {});
  ```
- **Expected Result:**
  - Returns nominal baseline voltage around ~3.31 V.

---

### Step 5: Test the Amber Human-Approval Safety Gate
- Request the controlled physical test:
  > *"Run the relay stress test using run_relay_stress_test."*
- In console:
  ```javascript
  const relayTool = tools.find(t => t.name === "run_relay_stress_test");
  // This promise will remain pending until human approval is clicked in the UI!
  document.modelContext.executeTool(relayTool, { cycles: 3 });
  ```
- **CRITICAL SAFETY VERIFICATION:**
  - **The tool MUST NOT execute immediately.**
  - An **Amber Safety Gate** dialog/card must appear in the UI:
    *"Safety interlock: Physical actuation requires supervisor consent."*
  - The relay remains de-energized (`open`).
  - Click **[ Approve test ]** in the web UI.
- **Expected Result After Approval:**
  - The relay energizes.
  - The 60fps oscilloscope displays voltage collapse to 2.72 V, crossing the `2.80 V reset threshold`.
  - A hardware brownout reset is triggered and recorded as empirical evidence token `E-001`.

---

### Step 6: Physical Jumper Repair & Retest
- In the UI, enter **Physical Repair**:
  - Click **Independent 5 V** to move jumper JP1 from the shared 3.3 V rail to an independent 5 V supply.
  - Click **[ Tell Agent I changed it ]**.
- Request or approve the retest:
  - The identical `run_relay_stress_test` executes again.
  - This time, voltage remains stable at ~3.18 V.
  - Zero resets occur.
  - The ground truth unseals with **DIAGNOSIS MATCH ✓**.

---

## Status Note
*This protocol describes the manual steps for judges and human evaluators. Automated verification of these identical invariants is performed continuously by `bun run judge:verify`.*
