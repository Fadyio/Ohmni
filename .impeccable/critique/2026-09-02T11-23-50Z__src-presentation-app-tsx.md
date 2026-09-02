---
target: src/presentation/App.tsx
total_score: 37
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 2
target_identity: "file:/Users/fady/Dev/ohmni/src/presentation/App.tsx"
target_fingerprint: "sha256:4e4c931ea564ca0bd5a7598a7979e7f8d4346daf7c8debf8b6b9ed93ae149dc6"
target_path: /Users/fady/Dev/ohmni/src/presentation/App.tsx
timestamp: 2026-09-02T11-23-50Z
slug: src-presentation-app-tsx
---
### Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|:-----:|-----------|
| 1 | Visibility of System Status | **4/4** | Real-time 60fps oscilloscope rendering, live relay coil status badge (`⚡ CLOSED` vs `OPEN`), zero-jitter tabular numerals, and responsive agent status chips. |
| 2 | Match Between System / Real World | **4/4** | Authentic EE terminology and schematic symbols: BOD register readouts, relay coil inductance symbols, armature COM/NO/NC switch contacts, and voltage division lines. |
| 3 | User Control and Freedom | **3/4** | Robust approval gates (`Approve [A]` / `Deny [D]`) and Emergency Stop (`Stop Agent`). Disconnection in `App.tsx` abruptly unmounts workbench instead of holding an offline/reconnecting state. |
| 4 | Consistency and Standards | **4/4** | Strict design token architecture (`tokens.css`), standardized button classes (`.btn-primary`, `.btn-secondary`), and uniform monospace typography. |
| 5 | Error Prevention | **4/4** | Amber-gated physical actuation prevents autonomous agent loops from damaging hardware; safety bounds (500ms duration, max 3 attempts, auto-abort on reset) are visible. |
| 6 | Recognition Rather Than Recall | **4/4** | Dynamic scene progression shows the active fault state immediately; hypothesis cards cite immutable evidence tokens (`E-001`, `E-002`) directly. |
| 7 | Flexibility and Efficiency | **3/4** | Global keyboard accelerators (`[A]` / `[D]`) expedite approvals. Advanced EEs cannot adjust oscilloscope timebase or voltage graticules manually. |
| 8 | Aesthetic and Minimalist Design | **4/4** | High signal-to-noise ratio. Matte industrial canvas (`#F4F2ED`) with dark `#0C1017` instrument insets and `#101722` PCB silkscreen vectors keeps focus on telemetry. |
| 9 | Error Recovery | **4/4** | Pinpoints exact fault mechanism (3.3V rail collapsed 80mV below 2.80V BOD threshold upon relay energization) and specifies direct physical remedy. |
| 10 | Help and Documentation | **3/4** | Built-in WebMCP Capability Drawer categorizes all 13 tools with schemas. Lacks inline tooltips for hardware acronyms (BOD, SRD-03VDC). |
| **Total** | | **37/40** | **Excellent (92.5%)** |

---

### Design Specificity Verdict

**Verdict: Deeply Grounded & Domain-Specific (Non-Generic)**

- **LLM Assessment**: OHMNI eschews generic SaaS dashboard patterns in favor of an authentic electronic test bench aesthetic (Teenage Engineering / Rohde & Schwarz / Linear Technology influence). The physical instrumentation metaphor is reinforced by a calibrated 60fps canvas oscilloscope with hardware threshold graticules, an interactive SVG PCB schematic, and amber safety approval interlocks with keyboard shortcuts (`[A]` / `[D]`).
- **Deterministic Scan**: Scanned `src/presentation/App.tsx` and all component subdirectories. Found **2 warnings** across 2 files:
  - `BenchAgentPanel.tsx:358`: `side-tab` accent border on alert container (`borderLeft: "3px solid..."`).
  - `EventTimeline.tsx:48`: `layout-transition` on container height property (`transition: height 0.22s`).
- **Visual & Brand Assets**:
  - `public/brand/ohmni-logo.svg`: hardcodes `#F5F7FA` white strokes and fills, producing a near-invisible ~1.05:1 contrast ratio against light header and cream background surfaces.

---

### Overall Impression

OHMNI is an exceptionally well-crafted, agent-native hardware diagnostic workbench. The dynamic 5-scene investigation rail and physical-to-digital repair verification flow eliminate dashboard clutter while maintaining total visibility over hardware safety. The biggest opportunity is hardening connection resilience so unexpected USB-UART drops do not wipe the active investigation state.

---

### What's Working

1. **Dynamic Scene-Based Investigation Architecture**: The 68%/32% layout dynamically focuses the engineer on the active milestone (`Observing` → `TestRequest` → `Running` → `Evidence` → `Hypothesis`), keeping cognitive load low despite complex underlying telemetry.
2. **Rigorous Hardware Safety Contracts**: Amber-gated boundary prompts make human authorization an active physical safety interlock, backed by visible execution limits (500ms duration, auto-abort on reset) and instant keyboard accelerators (`[A]` / `[D]`).
3. **Split-Screen Before-and-After Verification**: Side-by-side oscillograms comparing collapsed brownout voltage (2.72 V) with post-repair stability (3.18 V) provide conclusive empirical proof of root-cause resolution.

---

### Priority Issues

- **[P1] Connection Drop Unmounts Active Investigation State**
  - **Why it matters**: Serial/bridge connections often bounce during hardware brownout resets. Dropping back to `WelcomeView` destroys active investigation context and telemetry logs.
  - **Fix**: Retain `InvestigationStoryView` with an inline "Offline / Reconnecting" state banner rather than unmounting the view.
  - **Suggested command**: `$impeccable harden`

- **[P1] White Brand Logo Wordmark on Light Background**
  - **Why it matters**: `public/brand/ohmni-logo.svg` hardcodes `#F5F7FA` text and strokes, making the logo unreadable (~1.05:1 contrast) on light headers.
  - **Fix**: Update `ohmni-logo.svg` to use `currentColor` or `--ohmni-text-primary` (`#181D27`).
  - **Suggested command**: `$impeccable polish`

- **[P2] Layout Reflow During Event Timeline Expansion**
  - **Why it matters**: Animating `height` in `EventTimeline.tsx:48` causes full layout reflow on every frame.
  - **Fix**: Animate using `grid-template-rows: 0fr -> 1fr` or CSS `transform` / `opacity`.
  - **Suggested command**: `$impeccable optimize`

- **[P2] Side-Tab Accent Border in BenchAgentPanel**
  - **Why it matters**: Single-side thick accent borders (`borderLeft: 3px solid var(--ohmni-fault)`) trigger common AI-generated UI tells.
  - **Fix**: Replace with an enclosing subtle border (`1px solid var(--ohmni-border)`) and a dedicated status icon.
  - **Suggested command**: `$impeccable colorize`

- **[P2] Jumper Repair Lacks Live Physical Re-Verification Trigger**
  - **Why it matters**: Selecting 5.0V (Repaired) updates the visual diagram but lacks a button to re-run the physical stress test against live hardware.
  - **Fix**: Add a "Re-run Stress Test" CTA in the repaired state that re-engages the relay and streams live post-repair telemetry into the oscilloscope.
  - **Suggested command**: `$impeccable delight`

---

### Persona Red Flags

- **Alex (Power User / Hardware EE)**:
  - Fixed timebase (ms/div) and voltage scales prevent zooming in on inductive kickback transients.
  - Inability to export raw telemetry buffers to CSV / JSON for external SPICE analysis.
- **Jordan (First-Timer / Software Dev)**:
  - Lacks contextual hover tooltips for hardware acronyms (BOD, SRD-03VDC, WROOM-1).
  - Needs clearer inline visual cues explaining how relay coil inrush voltage sag triggers the 2.80V BOD trip.
- **Sam (Accessibility-Dependent User)**:
  - 60fps Canvas Oscilloscope lacks an `aria-live` region announcing voltage minima (`"Brownout detected: 2.72 V"`).
  - Physical Jumper selector in `RepairVerificationScene` uses styled `<div>` elements without `aria-checked` or `role="radiogroup"`.

---

### Minor Observations
- Tabular numeric fonts (`font-variant-numeric: tabular-nums`) cleanly eliminate layout jitter during high-frequency telemetry updates.
- Motion sensitivity is respected across all scenes via `useReducedMotion()`.

---

### Questions to Consider
- What if the workbench offered a dual-channel view (CH1: GPIO14 Logic Output, CH2: 3.3V Power Rail Sag) to make the causal link undeniable at a glance?
- Could engineers drag-and-drop the jumper wire directly on the PCB silkscreen rather than clicking button toggles?
