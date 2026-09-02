# OHMNI — Milestone 7.5 Product Experience Redesign Document

## 1. Visual & Product Architecture Audit

A rigorous inspection of all previous interface screenshots in `artifacts/screenshots/` (`idle`, `connected`, `brownout-fault`, `evidence`, `hypotheses`, `agent-idle`, `agent-investigating`, `agent-approval-request`, `agent-hypothesis`) reveals that while the technical domain layer and WebMCP orchestration function correctly, the product experience failed the 5-second comprehension test.

### Root Visual & UX Deficiencies Identified:

1. **First-time visitors cannot understand what Ohmni does:**
   Opening the application presented a cold, empty oscilloscope and disconnected panels with no narrative framing or clear value proposition.
2. **Empty states consume enormous amounts of space:**
   The oscilloscope canvas, evidence ledger, and event timeline occupied over 70% of the screen while completely blank or populated with generic placeholders.
3. **Monotonous dark styling and identical borders:**
   Every card, panel, and drawer used uniform dark gray backgrounds and identical 1px borders, causing severe eye fatigue and zero depth separation.
4. **Insufficient visual hierarchy:**
   Secondary technical parameters (such as `260px` fixed inspector text) had identical weight to critical diagnostic states, brownout alerts, and agent hypotheses.
5. **WebMCP tool drawer visually dominated the product:**
   The drawer auto-opened on tool discovery, covering more than 300px of the workspace and distracting the user with raw RPC names.
6. **Tool names are developer/debug information, not the primary user experience:**
   Labeling operations with raw snake_case names (`read_device_info`, `run_relay_stress_test`) made the app look like an internal test harness rather than a finished product.
7. **The device inspector was too small and visually unimportant:**
   The hardware being tested was reduced to a tiny 120px silhouette tucked into a corner, hiding the physical causality of the failure.
8. **The oscilloscope was huge but contained almost no meaningful visual information:**
   With only 2 sparse discrete samples, the scope failed to convey realistic electrical dynamics, inrush sag, or threshold crossing.
9. **Agent activity, evidence, and hypotheses were disconnected and hard to follow:**
   There was no visible bridge showing how a tool call produced a trace measurement, how that measurement became an immutable evidence token, or how evidence grounded a hypothesis.
10. **Lack of compelling visual narrative:**
    The core loop (`CONNECT → INVESTIGATE → TEST → EVIDENCE → DIAGNOSIS`) was completely implicit rather than guided.
11. **Engineering scaffolding appearance:**
    Unstyled buttons, stark monochrome borders, and unformatted JSON views made the interface look like a developer prototype.
12. **No obvious "Start Here" experience:**
    A first-time judge or user had to manually find connection buttons without guided intent or prefilled diagnostic scenarios.
13. **Terminal/debug color palette:**
    Overuse of stark black and neon cyan failed to establish a coherent, trustworthy industrial product identity.
14. **Overlapping drawers and modals:**
    The WebMCP capability drawer and hypothesis modals obscured active instrumentation during critical test cycles.
15. **"Unknown / No Target Attached" first impression:**
    Starting with warning badges and "Unknown" device placeholders gave the impression of a broken or unconfigured tool.

---

## 2. Redesign Architecture & Solutions

### 2.1 Two-Mode Information Architecture
- **Mode 1: Intro / Ready State**
  - Hero narrative: *"Hardware debugging that measures before it guesses."*
  - Interactive SVG architecture diagram: `DEVICE ↔ BROWSER (OHMNI) ↔ BENCH AGENT` with live animated signal pulses.
  - Clear Primary CTA: `[ Start Virtual Diagnosis ]` to immediately jump into a guided brownout diagnostic scenario.
- **Mode 2: Resizable Investigation Workbench**
  - Smooth shared-layout morphing from Intro to Workbench via Motion `layoutId`.
  - Balanced 3-column resizable layout (`react-resizable-panels`):
    - **Left**: Rich authored SVG Device Visualization (ESP32-S3 board with animated relay coil, power rail indicators, status LED, and active signal pulses).
    - **Center**: High-fidelity Live Lab (Real-time 60fps oscilloscope with sweep cursor, threshold glow, integrated readout metrics, and expandable event timeline).
    - **Right**: Agent Investigation Rail & Grounded Evidence Ledger (Transparent tool taxonomy, real-time activity steps, amber human-in-the-loop approval card, and animated evidence citation links).

### 2.2 Color & Aesthetic System
- **Background:** `#0B0E14` (Deep obsidian)
- **Elevated Surfaces:** `#101621` & `#151C28`
- **Soft Subsurface Borders:** `rgba(148, 163, 184, 0.12)`
- **Brand & Agent Primary:** `#6C7CFF` / `#4F6BFF` (Vibrant cobalt/violet)
- **Instrument Signals & Voltage:** `#35C6F4` (Electric cyan)
- **Verified Success & Nominal:** `#35D39A` (Emerald green)
- **Physical Test & Human Approval:** `#F4B860` (Amber warning)
- **Faults & Brownout Resets:** `#FF5D68` (Vivid fault red)

### 2.3 Telemetry & Oscilloscope Fidelity
- Rich deterministic simulation generating 60+ samples capturing:
  1. Stable pre-trigger 3.31V baseline.
  2. Relay coil energization inrush current.
  3. Exponential supply rail collapse crossing 2.80V threshold down to 2.72V minimum.
  4. Brownout reset trigger and coil de-energization bounce.
  5. Post-reset rail recovery and boot sequence.
- Animated sweep cursor, hover coordinate inspection, and integrated metric chips.

### 2.4 Human-in-the-Loop Approval Experience
- Replaced generic modal with an integrated, high-context Approval Card explaining:
  - *Why* the agent proposes the test (correlated brownout reset history).
  - *What* will physically happen (500ms relay pulse, 3 max attempts, supply monitoring, fail-safe abort).
  - Explicit interactive `[ Approve Test ]` and `[ Deny ]` actions with highlighted relay coil on the device schematic.

### 2.5 WebMCP Secondary Inspector
- Compact `13 Agent Instruments (WebMCP Native)` status button replacing intrusive auto-opening drawer.
- Structured taxonomy: `OBSERVE` (read-only sensors), `REASON` (evidence & hypothesis synthesis), and `PHYSICAL TEST` (amber actuation requiring approval).
