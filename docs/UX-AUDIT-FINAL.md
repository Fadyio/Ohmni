# OHMNI — FINAL PRODUCT DESIGN, UX & WEBMCP AUDIT

**Audit Date:** 2026-09-03  
**Target Tested:** https://ohmni-three.vercel.app  
**Baseline Git SHA:** `cd875efc95d8bb96bf95a76eb9b1d257a2a68fb2`  
**Environments:** Installed Google Chrome (Normal + `--enable-webmcp-testing` WebMCP flag), Viewports 1440×900, 1366×768, 1512×982, and simulated serial transport.

---

## 1. SCREEN: LANDING PAGE

- **PURPOSE:** Introduce Ohmni's core value proposition: turning browser-native hardware diagnostic instruments into WebMCP tools operated by the user's external AI agent (ChatGPT, Codex, etc.).
- **WHAT USER SHOULD UNDERSTAND IN 3 SECONDS:** Ohmni gives your AI agent safe instruments to inspect, test, and diagnose physical or virtual hardware through the browser.
- **WHAT CURRENTLY WORKS:** Clear headline ("Give your AI agent instruments for the physical world."), clean board visual, navigation to workbench works.
- **WHAT IS CONFUSING:** The landing view leaks underneath the hero into an embedded workbench preview ("No target connected", "OBSERVE TEST DIAGNOSE REPAIR VERIFY", "Compatibility mode · 11 tools active", "ESP32-S3 Environmental Controller"), confusing the user about whether they are on the landing page or already inside the workbench.
- **WHAT IS REDUNDANT:** Duplicate buttons: "Open agent-ready workbench", "Start investigation", "Try built-in demo" all rendered on one page. Multiple conflicting status badges.
- **WHAT IS TECHNICAL JARGON:** "Dual Core 240MHz", "BOD REG: 2.80V THRESHOLD", "TP1 (3V3)", "Xtensa Dual-Core", "16MB Flash • 8MB PSRAM", "EvidenceStore", "NDJSON".
- **VISUAL PROBLEM:** Card-inside-card syndrome; excessive borders; small all-caps badges everywhere; workbench components bleeding into the landing page; footer is crowded.
- **COPY PROBLEM:** "Human-gated actuation · Evidence-backed diagnosis · Retest to verify" below CTA should be a single compact line: "WebMCP tools · Human-gated actuation · Web Serial".
- **FUNCTIONAL BUG:** Clicking "Connect Hardware" from landing opens a modal that doesn't cleanly initialize or show the direct options without scrolling or button discovery.
- **FIX:**
  1. Isolate Landing cleanly: Top bar with Ohmni logo, Hero Left (headline, concise subline, single compact proof line, Primary: [Open agent-ready workbench], Secondary: [Connect hardware], Tertiary: Try built-in demo →), Hero Right: polished reference board illustration labeled "Virtual ESP32 reference device".
  2. Eliminate all workbench preview bleed on landing.

---

## 2. SCREEN: CONNECT HARDWARE MODAL & SERIAL FLOW

- **PURPOSE:** Guide user to connect a physical device via Web Serial or test with the built-in reference virtual device / loopback simulator.
- **WHAT USER SHOULD UNDERSTAND IN 3 SECONDS:** How to connect a serial board to the browser and expose it to the agent as WebMCP instruments.
- **WHAT CURRENTLY WORKS:** Web Serial transport and Loopback reference simulator logic exist in domain code.
- **WHAT IS CONFUSING:** Technical serial jargon (baud rate, NDJSON protocol, parity, handshakes, transport descriptors) shown upfront instead of simple step-by-step connection instructions.
- **WHAT IS REDUNDANT:** Too many explanations of internal transports and serial framing.
- **WHAT IS TECHNICAL JARGON:** "Baud rate 115200", "NDJSON streaming parser", "Correlated RPC frame", "Virtual reference loopback".
- **VISUAL PROBLEM:** Plain dialog with dense technical text, inconsistent button styling, lack of clear 1-2-3-4 step progression.
- **COPY PROBLEM:** Leads with transport mechanics rather than user action ("Choose serial device").
- **FUNCTIONAL BUG:** Clicking "Try without hardware" does not transition directly into the physical descriptor view with mock telemetry if user wants to evaluate physical device mode.
- **FIX:**
  1. Follow the clean 5-step connection flow:
     1. Choose serial device
     2. Connecting…
     3. Reading device descriptor…
     4. Registering instruments…
     5. Ready
  2. Put technical serial parameters behind a collapsed "Connection details" disclosure.
  3. Include a prominent "Try without hardware" button that launches the simulated physical hardware profile cleanly.

---

## 3. SCREEN: WORKBENCH READY (READY SCENE)

- **PURPOSE:** Confirm the hardware workbench is initialized, WebMCP instruments are registered, and the workbench is waiting for the external agent.
- **WHAT USER SHOULD UNDERSTAND IN 3 SECONDS:** The board is connected and idle. Your external AI agent (or the built-in demo) can now begin diagnosing it.
- **WHAT CURRENTLY WORKS:** Hardware board silhouette renders, top bar shows device title and workflow stages, prompt copy button is available.
- **WHAT IS CONFUSING:** Right rail looks like a chatbot transcript panel with an empty chat log instead of an external agent activity stream.
- **WHAT IS REDUNDANT:** Duplicate "Start investigation" button inside the main canvas competing with the right rail external agent prompt.
- **WHAT IS TECHNICAL JARGON:** "Compatibility mode · 19 tools active", "BOD REG: 2.80V THRESHOLD", "TP1 (3V3)", "INVESTIGATION RECORD (0)".
- **VISUAL PROBLEM:** Empty card containers in right rail; high contrast badges; all-caps titles; main canvas hardware visual lacks a cohesive instrument rack feel.
- **COPY PROBLEM:** "READY FOR YOUR AGENT" duplicated as heading and sub-badge; prompt mentions internal implementation terms.
- **FUNCTIONAL BUG:** If user clicks "Start investigation" on the main canvas, it tries to auto-start Groq rather than prioritizing the external agent or demo mode cleanly.
- **FIX:**
  1. Main canvas: Headline "Hardware workbench ready", Subline "Your agent can now inspect this device using the instruments exposed by Ohmni."
  2. Small clean status strip: "3.31 V supply · Relay open · No experiment running".
  3. Right rail: "YOUR AGENT", "Ready for your agent", clear copyable prompt box with [Copy prompt] button, and a secondary link "Use built-in demo agent".
  4. Top bar: Unified shell showing "OHMNI · Virtual ESP32 reference device | OBSERVE · TEST · DIAGNOSE · REPAIR · VERIFY | Native WebMCP · Connected · •••".

---

## 4. SCREEN: OBSERVATION (READ RESET HISTORY / DEVICE INFO)

- **PURPOSE:** Display the empirical results of passive register inspection (`read_reset_history`, `read_device_info`).
- **WHAT USER SHOULD UNDERSTAND IN 3 SECONDS:** The agent read the controller's reset registers, revealing that all recent reboots were caused by power supply brownouts.
- **WHAT CURRENTLY WORKS:** Data from `read_reset_history` correctly populates counts (3 Brownouts, 0 Watchdog, 0 Software).
- **WHAT IS CONFUSING:** The screen mixes raw register readouts with a simulated oscilloscope baseline and multiple cards with nested borders.
- **WHAT IS REDUNDANT:** Multiple badges saying "OBSERVING", "HARDWARE STATE", "DIAGNOSTIC REGISTERS".
- **WHAT IS TECHNICAL JARGON:** "BOD Detector Triggered", "VDD sagged below 2.80 V", "Assertions failed: 0".
- **VISUAL PROBLEM:** All-caps headline "RESET HISTORY", cards inside cards, heavy borders, dark scope surface competing with bright white card background.
- **COPY PROBLEM:** Technical descriptions instead of user-facing findings.
- **FUNCTIONAL BUG:** None, tool data correctly arrives from `read_reset_history`.
- **FIX:**
  1. Headline: "Reset history" (title case).
  2. Clean metric cards:
     - Brownout resets: 3
     - Watchdog resets: 0
     - Software crashes: 0
  3. Plain-English interpretation: "Recent resets were caused by the power rail falling below the MCU's operating threshold."
  4. Right rail activity stream updates to: "External agent · Reading reset history · ✓ Tool completed".

---

## 5. SCREEN: PASSIVE MEASUREMENT (MEASURE SUPPLY VOLTAGE)

- **PURPOSE:** Show the live/quiescent electrical state of the device under observation (`measure_supply_voltage`).
- **WHAT USER SHOULD UNDERSTAND IN 3 SECONDS:** Baseline MCU supply voltage is normal (3.31 V) when the relay is idle.
- **WHAT CURRENTLY WORKS:** `measure_supply_voltage` returns `{ voltage: 3.31, unit: "V", status: "normal" }`.
- **WHAT IS CONFUSING:** When `measure_supply_voltage` is called, the UI currently switches to the empty Evidence Ledger scene ("MEASURED EVIDENCE LEDGER - Captured Empirical Facts (0)") rather than displaying a dedicated instrument measurement!
- **WHAT IS REDUNDANT:** Empty evidence card showing "No evidence records captured yet".
- **WHAT IS TECHNICAL JARGON:** "Captured Empirical Facts", "EvidenceStore Ledger".
- **VISUAL PROBLEM:** Empty state card taking up the full screen with zero visual indication of the 3.31 V measurement.
- **COPY PROBLEM:** No measurement copy is displayed on the main canvas.
- **FUNCTIONAL BUG:** `measure_supply_voltage` tool invocation does not mount a dedicated Passive Measurement instrument scene.
- **FIX:**
  1. Create a dedicated Passive Measurement instrument presentation for `measure_supply_voltage`:
     - Large numeric measurement: **3.31 V** (48-64px font)
     - Secondary label: "MCU supply rail"
     - Status: "Within expected range (3.3 V nominal)"
  2. Single physical instrument surface; no card-in-card wrapping.

---

## 6. SCREEN: AMBER APPROVAL (RUN RELAY STRESS TEST SAFETY GATE)

- **PURPOSE:** Hardware safety interlock requiring explicit human authorization before energizing physical actuators or high-current loads.
- **WHAT USER SHOULD UNDERSTAND IN 3 SECONDS:** The agent is asking permission to run an electrical stress test that could actuate the relay. The user must authorize it.
- **WHAT CURRENTLY WORKS:** Safety gate intercepts `run_relay_stress_test`, holds execution, and displays approval buttons.
- **WHAT IS CONFUSING:** Visual presentation feels like a software SaaS confirmation modal rather than a hardware safety interlock.
- **WHAT IS REDUNDANT:** Repetitive text ("Tool: run_relay_stress_test", "Controlled Physical Actuation", "AMBER SAFETY GATE • HUMAN AUTHORIZATION", "VIRTUAL DUT INTERVENTION: RELAY & 3V3 RAIL ARMED").
- **WHAT IS TECHNICAL JARGON:** "VIRTUAL DUT INTERVENTION", "BOD SAG", "GPIO14 NO NC".
- **VISUAL PROBLEM:** Excessive amber borders, pills, and badges. Competing buttons. Schematic looks cluttered.
- **COPY PROBLEM:** Headline is awkward: "Your agent wants to energize relay up to 500 ms."
- **FUNCTIONAL BUG:** None in gate logic; UI layout needs structural cleanup.
- **FIX:**
  1. Layout:
     - Left: Focused board schematic highlighting the relay and the shared 3.3 V power trace in amber.
     - Right:
       - Headline: "Your agent wants to run a controlled load test"
       - Purpose: "See whether relay activation collapses the MCU supply."
       - What will happen:
         • Relay energizes briefly
         • Supply voltage is measured
         • Test stops immediately if the MCU resets
       - Safety envelope:
         - Maximum actuation: 500 ms
         - Relay returns open automatically
       - Action buttons: `[ Deny ]` and `[ Approve test ]` (Amber button).
       - Technical name: `run_relay_stress_test` small, muted monospace underneath.

---

## 7. SCREEN: RUNNING EXPERIMENT (OSCILLOSCOPE & LOAD TEST)

- **PURPOSE:** Hero visual of Ohmni: real-time oscilloscope trace recording supply voltage during relay actuation, capturing the exact moment of brownout collapse.
- **WHAT USER SHOULD UNDERSTAND IN 3 SECONDS:** The relay energized, the supply voltage crashed to 2.72 V (below the 2.80 V threshold), and the MCU brownout detector tripped.
- **WHAT CURRENTLY WORKS:** High-performance Canvas-based oscilloscope renders waveform with trigger markers and baseline annotations.
- **WHAT IS CONFUSING:** The transition from running to fault is not cleanly staged; status headers sometimes say "Captured Oscilloscope Waveform (Frozen at 2.72 V Sag)" before the user understands that a fault occurred.
- **WHAT IS REDUNDANT:** Redundant status strips below the oscilloscope.
- **WHAT IS TECHNICAL JARGON:** "BOD REG: 2.80V THRESHOLD", "Coil inrush dv/dt".
- **VISUAL PROBLEM:** Oscilloscope frame has multiple nested containers and dark borders; needs a polished physical laboratory instrument frame.
- **COPY PROBLEM:** Inconsistent status: needs explicit "LOAD TEST RUNNING" transitioning instantly to "FAULT REPRODUCED".
- **FUNCTIONAL BUG:** None in waveform math.
- **FIX:**
  1. During execution:
     - Badge: `LOAD TEST RUNNING`
     - Relay: `ENERGIZED`
     - Supply: live moving voltage value
     - Trace: moving sweep across 2.80 V threshold line.
  2. On reset:
     - Header clearly flips to: `FAULT REPRODUCED`
     - Frozen waveform display:
       - Baseline: 3.31 V
       - Minimum: 2.72 V
       - Reset: Brownout
       - Relay: Safely open

---

## 8. SCREEN: EVIDENCE COLLECTION

- **PURPOSE:** Summarize empirical facts gathered during experiments without overwhelming the user with raw database tables.
- **WHAT USER SHOULD UNDERSTAND IN 3 SECONDS:** Exactly what physical facts were proven by the experiment.
- **WHAT CURRENTLY WORKS:** `EvidenceStore` records immutable facts (E-001 through E-005).
- **WHAT IS CONFUSING:** Forensic database look with UUIDs, JSON blobs, and cryptographic hashes presented front-and-center.
- **WHAT IS REDUNDANT:** Multiple rows with duplicate timestamp and provenance metadata.
- **WHAT IS TECHNICAL JARGON:** "Evidence Ledger", "Provenance Hash", "Event Correlation ID", "Immutable Telemetry Slice".
- **VISUAL PROBLEM:** Wall of cards with tiny monospace text and grey boxes.
- **COPY PROBLEM:** Focuses on forensic data structure rather than "What did we learn?".
- **FUNCTIONAL BUG:** None in data model.
- **FIX:**
  1. Headline: "Evidence collected"
  2. 3 clean factual takeaways:
     • **2.72 V** minimum supply voltage recorded
     • **Brownout reset** occurred
     • Reset directly followed **relay activation** (166 ms)
  3. Evidence IDs (`E-001`, `E-002`, `E-003`) displayed as small secondary reference tags.
  4. Collapsible "View evidence details" for deeper inspection.

---

## 9. SCREEN: DIAGNOSIS (HYPOTHESIS SCENE)

- **PURPOSE:** Present the AI agent's synthesized causal explanation grounded in the measured evidence.
- **WHAT USER SHOULD UNDERSTAND IN 3 SECONDS:** The agent's working diagnosis: relay activation is collapsing the shared 3.3 V MCU rail. A physical hardware change is needed to verify.
- **WHAT CURRENTLY WORKS:** Hypothesis title, confidence tier, and linked evidence records are displayed.
- **WHAT IS CONFUSING:** UI leads with database keys: "H-001", "MEDIUM CONFIDENCE", "NEEDS CONTROLLED RETEST", "GROUNDED BY 5 FACTS", obscuring the actual diagnosis statement.
- **WHAT IS REDUNDANT:** "WORKING DIAGNOSIS" in uppercase with redundant subtitle.
- **WHAT IS TECHNICAL JARGON:** "H-001", "Causal graph synthesis", "Qualitative confidence tier".
- **VISUAL PROBLEM:** Cluttered badges with multiple colors (blue, yellow, green) on a single card.
- **COPY PROBLEM:** Missing the clear CTA to proceed to physical verification.
- **FUNCTIONAL BUG:** None.
- **FIX:**
  1. Headline: "Working diagnosis"
  2. Primary statement: "Relay activation is collapsing the MCU supply rail." (Large clear typography)
  3. Confidence: "High" (or qualitative tier clearly stated)
  4. Supported by:
     • Supply fell to 2.72 V
     • Brownout reset occurred
     • Failure reproduced during relay activation
  5. Status: "Needs physical verification"
  6. Primary CTA: `[ Verify with hardware change ]`
  7. Move "H-001" and schema citations into the secondary inspector.

---

## 10. SCREEN: HUMAN REPAIR (DUT JUMPER INTERVENTION)

- **PURPOSE:** The moment of human-agent physical collaboration: the agent cannot touch physical hardware, so it asks the human to change a jumper.
- **WHAT USER SHOULD UNDERSTAND IN 3 SECONDS:** Your agent needs your hands to move the relay power jumper from the 3.3 V MCU supply to the 5 V independent supply.
- **WHAT CURRENTLY WORKS:** Interactive jumper switch toggles between 3.3 V and 5 V; simulator updates internal resistance and power topology.
- **WHAT IS CONFUSING:** The repair view sometimes appears as a popup modal over the hypothesis view, or looks like a completely different sub-application.
- **WHAT IS REDUNDANT:** Repeated instructions across multiple dialogue boxes.
- **WHAT IS TECHNICAL JARGON:** "JUMPER_JP1", "VCC_AUX_RAIL", "Inductive Flyback Isolation".
- **VISUAL PROBLEM:** Jumper graphics look disconnected from the main application shell; lacks clear post-switch feedback explaining that retesting is still required.
- **COPY PROBLEM:** Inconsistent naming: "Aux Rail", "Independent Rail", "External 5V", "5V Aux".
- **FUNCTIONAL BUG:** Switching the jumper immediately showed "Repair Complete" in some states before the verification test was actually executed! Changing hardware is not verification.
- **FIX:**
  1. Maintain the global application shell:
     - Headline: "Your agent needs your hands"
     - Instruction: "Move the relay supply from the shared 3.3 V MCU rail to the independent 5 V supply."
  2. In virtual mode: Interactive jumper graphic showing `[ 3.3 V MCU ]` -> `[ Independent 5 V ]`.
  3. After user switches jumper:
     - Clear status: "Hardware configuration changed. Retest required."
     - Action button: `[ Tell agent I've changed it ]`
  4. Standardize canonical naming across all files: **Independent 5 V supply**.

---

## 11. SCREEN: VERIFY (RETEST LOAD TEST)

- **PURPOSE:** Rerun the identical controlled load test after the hardware change to experimentally confirm the fault is resolved.
- **WHAT USER SHOULD UNDERSTAND IN 3 SECONDS:** We are rerunning the load test to prove the 5 V independent supply fixed the brownout.
- **WHAT CURRENTLY WORKS:** Retest executes, relay energizes, voltage sags only to 3.18 V (safe), and 0 resets occur.
- **WHAT IS CONFUSING:** The verify screen looked identical to the first failure experiment, leaving the user unsure whether anything changed.
- **WHAT IS REDUNDANT:** Approval request repeats the original failure warning text without clarifying this is the post-repair retest.
- **WHAT IS TECHNICAL JARGON:** "Post-Intervention Actuation Verification Matrix".
- **VISUAL PROBLEM:** Absence of a clear side-by-side or direct before/after comparison during or immediately following the test.
- **COPY PROBLEM:** "Controlled Physical Actuation" repeated without saying "Verify the repair".
- **FUNCTIONAL BUG:** None in verification execution.
- **FIX:**
  1. Headline: "Verify the repair"
  2. Subline: "Run the same load test again and compare the result."
  3. Post-run Before / After comparison:
     - **Before:** 2.72 V minimum · Brownout reset
     - **After:** 3.18 V minimum · Stable (No reset)
  4. Reserve emerald green ONLY for post-repair verified state.

---

## 12. SCREEN: FINAL RESULT / ASSESSMENT

- **PURPOSE:** Deliver the final investigation payoff: verified repair, comparison with ground truth, and investigation summary.
- **WHAT USER SHOULD UNDERSTAND IN 3 SECONDS:** The repair is experimentally verified. The diagnosis is confirmed.
- **WHAT CURRENTLY WORKS:** Ground truth comparison compares agent conclusion with sealed scenario ground truth.
- **WHAT IS CONFUSING:** Overwhelming benchmark scoring internals (turn counts, latency benchmarks, confidence delta formulas) cluttering the user view.
- **WHAT IS REDUNDANT:** Multiple banners stating "INVESTIGATION COMPLETE", "ASSESSMENT SUBMITTED", "DIAGNOSIS MATCH".
- **WHAT IS TECHNICAL JARGON:** "Agent Turn Budget", "Tool Invocation Graph Depth", "NDJSON Token Count".
- **VISUAL PROBLEM:** Too many metrics competing for attention; no single dominant headline.
- **COPY PROBLEM:** Uses academic evaluation terms ("Scenario Evaluation Passed") instead of product completion terms.
- **FUNCTIONAL BUG:** None.
- **FIX:**
  1. Headline: "Repair verified"
  2. Large primary comparison:
     - **BEFORE:** 2.72 V · Brownout reset
     - **AFTER:** 3.18 V · Stable
  3. Agent diagnosis: "Relay-induced supply brownout"
  4. Ground truth: "Relay powered from shared MCU rail" (DIAGNOSIS MATCH)
  5. Compact secondary stats: "1 human intervention · 2 controlled experiments"
  6. Collapsible evidence trail link. Remove all benchmark scoring internals.

---

## 13. SCREEN: GENERIC PHYSICAL DEVICE UI (UNKNOWN / CUSTOM HARDWARE)

- **PURPOSE:** When real hardware is connected over Web Serial whose descriptor does not match the ESP32 demo board, present a clean, professional instrumentation rack for the hardware's actual capabilities.
- **WHAT USER SHOULD UNDERSTAND IN 3 SECONDS:** Real physical board connected. Here are its live signals and the WebMCP instruments available to your agent.
- **WHAT CURRENTLY WORKS:** `GenericDeviceVisualization.tsx` renders basic signals.
- **WHAT IS CONFUSING:** Looks like an unstyled developer fallback screen or empty JSON dumper.
- **WHAT IS REDUNDANT:** Multiple text fields repeating "Unknown target", "Generic fallback mode".
- **WHAT IS TECHNICAL JARGON:** "Raw Web Serial Stream", "NDJSON Packet Inspector", "Unmatched Profile Descriptor".
- **VISUAL PROBLEM:** Sparse layout, plain monospace tables, gray boxes, lacks the visual polish of the virtual board.
- **COPY PROBLEM:** Describes what is missing ("No graphical schematic available for this board") instead of what is present ("Connected device: USB Serial").
- **FUNCTIONAL BUG:** None.
- **FIX:**
  1. Redesign `GenericDeviceVisualization` as a professional laboratory instrumentation rack:
     - Top: "Connected device" · `<Device Name>` · `Firmware <version>` · `USB Serial` · `<N> instruments`
     - Middle: LIVE SIGNALS cards (Supply voltage, Reset count, Actuator state)
     - Bottom: AVAILABLE INSTRUMENTS categorized into Observe and Controlled Tests
  2. Never display raw JSON on the primary surface.

---

## 14. SCREEN: WEBMCP INSTRUMENT INSPECTOR (DRAWER)

- **PURPOSE:** Allow judges and engineers to inspect all 19 WebMCP instruments registered with `document.modelContext`.
- **WHAT USER SHOULD UNDERSTAND IN 3 SECONDS:** Ohmni registers 19 real WebMCP tools directly with the browser, enabling external AI models to operate the hardware.
- **WHAT CURRENTLY WORKS:** Drawer slides out and lists registered tools.
- **WHAT IS CONFUSING:** Dense paragraphs explaining the WebMCP protocol architecture and hackathon history, pushing tool definitions off-screen.
- **WHAT IS REDUNDANT:** Giant JSON schemas expanded by default; duplicated status pills on every tool.
- **WHAT IS TECHNICAL JARGON:** "Mirrored Model Context Proxy", "Blink Feature Enable Flag", "Bidirectional RPC Dispatcher".
- **VISUAL PROBLEM:** Schema clutter; raw JSON walls; drawer trigger button has awkward labeling in the top bar.
- **COPY PROBLEM:** Academic paragraphs about browser standards instead of concise tool documentation.
- **FUNCTIONAL BUG:** Drawer trigger button was hard to target reliably with keyboard and automated tests.
- **FIX:**
  1. Clean drawer header: "WebMCP Instrument Inspector"
  2. Subtitle: "19 instruments registered with document.modelContext"
  3. 5 structured categories:
     - **OBSERVE:** `read_device_info`, `read_reset_history`, `measure_supply_voltage`, `read_system_health`, `scan_i2c_bus`, `read_sensor_status`
     - **CONTROLLED TEST:** `run_relay_stress_test`
     - **EVIDENCE:** `list_evidence`, `get_evidence`, `export_evidence_bundle`
     - **REASONING:** `propose_hypothesis`, `update_hypothesis`, `link_evidence`, `list_hypotheses`, `get_hypothesis`, `confirm_hypothesis`, `record_conclusion`
     - **HUMAN:** `request_human_intervention`
  4. Each item: Human title, technical monospace name, safety indicator (Green read-only vs Amber gated), one-line description.
  5. Schemas and raw JSON collapsed by default behind `<details>`.
  6. Clean footer: "These instruments are available to the agent currently viewing this page."

---

## 15. SCREEN: DEVELOPER INSPECTOR [CMD+SHIFT+D]

- **PURPOSE:** Hidden developer diagnostic overlay for judges and engineers needing deep protocol verification.
- **WHAT USER SHOULD UNDERSTAND IN 3 SECONDS:** Developer diagnostics: protocol logs, commit SHA, raw event streams, and scenario status.
- **WHAT CURRENTLY WORKS:** Opens on `Cmd+Shift+D` or `Ctrl+Shift+D`, displays SHA and internal logs.
- **WHAT IS CONFUSING:** Some developer controls and protocol details were previously scattered across the user-facing workbench.
- **WHAT IS REDUNDANT:** Repeated build SHAs in multiple tabs.
- **WHAT IS TECHNICAL JARGON:** Appropriate here since it is strictly a developer inspector.
- **VISUAL PROBLEM:** High contrast dark terminal style; needs clean tabs (Overview, Tools, Serial Log, Protocol, Evidence Ledger).
- **COPY PROBLEM:** Ensure all developer-only concepts are quarantined here and not present in normal UI.
- **FUNCTIONAL BUG:** None.
- **FIX:**
  1. Ensure 100% of technical plumbing (build SHA, raw JSON payloads, transport frames, protocol logs, seed values) is located in Developer Inspector.
  2. Keep keyboard shortcut `Cmd+Shift+D` / `Ctrl+Shift+D` and discreet link in the `•••` More menu.

---

## 16. SCREEN: ERROR STATES & EDGE CASES

- **PURPOSE:** Provide graceful, actionable recovery when external conditions fail (browser unsupported, hardware disconnected, agent unavailable, tool rejected).
- **WHAT USER SHOULD UNDERSTAND IN 3 SECONDS:** What went wrong and the single button to fix or continue.
- **WHAT CURRENTLY WORKS:** Basic error boundaries exist.
- **WHAT IS CONFUSING:** Technical error stack traces or raw exception messages displayed to the user when an external provider fails.
- **WHAT IS REDUNDANT:** "An error occurred" generic modal.
- **WHAT IS TECHNICAL JARGON:** "WebSocket handshake failed", "Failed to fetch /api/bench-agent: 500", "DOMException: The port is already open".
- **VISUAL PROBLEM:** Unstyled red boxes.
- **COPY PROBLEM:** Missing user-centric guidance.
- **FUNCTIONAL BUG:** Disconnecting a serial device didn't provide a clean "Reconnect" or "Switch to Virtual" action.
- **FIX:**
  1. Standardize 4 clean error states:
     - **MODEL UNAVAILABLE:** "The external agent remains usable. Built-in Groq agent is temporarily unavailable." -> `[ Retry ]` `[ Use external agent ]` `[ Use deterministic demo ]`
     - **SERIAL DISCONNECTED:** "Hardware disconnected. Investigation history and evidence were preserved." -> `[ Reconnect ]` `[ Switch to virtual device ]`
     - **UNSUPPORTED BROWSER:** "Web Serial requires desktop Chromium." -> `[ Continue with virtual device ]`
     - **TOOL FAILED:** "Instrument could not complete. No hardware changes were made." -> `[ Retry ]`
  2. Zero raw stack traces in normal user UI.

---

## SUMMARY OF REQUIRED IMPLEMENTATION PHASES

1. **Tokens & Design System:** Centralize semantic palette (`--canvas`, `--surface`, `--ink`, `--brand`, `--observe`, `--approval`, `--fault`, `--verified`), typography scale, 8px rhythm in `tokens.css`.
2. **App Shell & Top Bar:** Single permanent shell across all scenes with unified workflow stage indicator and clean right-side indicators.
3. **External Agent First:** Rework right rail into an activity stream with copyable prompt; remove chatbot look.
4. **Scene Refinement:** Upgrade Landing, Ready, Observe, Measure, Approval, Running, Evidence, Hypothesis, Repair, Verify, Result scenes according to the style guide.
5. **Inspectors & Modals:** Polish WebMCP Drawer, Developer Inspector, and Connect Hardware modal.
6. **ChatGPT Desktop Guide & Documentation:** Create `docs/CHATGPT-SITE-TOOLS-TEST.md` and overhaul `README.md`.
7. **Full Verification:** Run all test suites, capture final screenshots, record video, deploy to production, and verify.
