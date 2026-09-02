# 0005. Interactive SVG PCB Diagram and Physical Intervention Points

Date: 2026-09-02

## Status

Accepted

## Context

A foundational thesis of the project is the physical boundary between agent and human: the AI can observe, hypothesize, and measure, but the human must physically repair the board. In Virtual Device Mode, replacing this physical act with generic buttons or free-form text input ("I moved the jumper") undermines the visual impact, credibility, and tactile agency of the human collaborator.

## Decision

We will implement an **Interactive SVG PCB Component Canvas with Explicit Intervention Points**:

1. **Precision SVG Board Representation:** The ESP32-S3 Environmental Controller is rendered as a clean, dark-theme SVG PCB featuring accurate component outlines, silk-screen labels, and active trace highlights.
2. **Explicit Intervention Points (`InterventionPoint`):** A curated set of discrete physical controls (3–5 points: `relay_power_jumper`, `i2c_address_switch`, `sensor_bus_connector`, `boot_button`) with defined states (`3v3` ↔ `5v`, `0x76` ↔ `0x77`, `connected` ↔ `disconnected`).
3. **Physical-to-Electrical Causality:** Manipulating an `InterventionPoint` directly alters the electrical/bus simulation parameters in `VirtualDeviceAdapter`. The agent is given no magical "problem fixed" signal—it must rerun diagnostic experiments to observe whether the physical change resolved the fault.
4. **Agent-Directed Component Targeting:** When an agent calls `request_human_intervention`, it passes an `intervention_point` ID. The UI highlights the exact board region with a focused halo and animated callout instruction.
5. **Direct Manipulation + Accessible Inspector:** Users interact by clicking/dragging jumper caps and switches directly on the PCB. A synchronized component inspector panel provides accessible keyboard control and testing parity.

```text
  Agent invokes request_human_intervention({ intervention_point: "relay_power_jumper" })
                               │
                               ▼
        PCB Dims + Illuminates JP3 with Animated Callout
                               │
                               ▼
            Human clicks/drags jumper cap on SVG PCB
                               │
                               ▼
          VirtualDeviceAdapter circuit state updates (3.3V -> 5V)
                               │
                               ▼
        Human Intervention logged to Evidence Ledger (E-xxx)
                               │
                               ▼
            Agent reruns identical stress test to verify
```

## Consequences

### Positive
- **High Visual Wow-Factor:** Judges physically experience the human role in the hardware repair loop.
- **Deterministic & Safe:** The agent cannot invent arbitrary screen coordinates or unmodeled physical states.
- **Genuine Verification:** Prevents superficial fixes; forces the agent to prove fault resolution through real before/after measurements.

### Negative / Tradeoffs
- Requires authoring SVG assets and state bindings for each supported board component and intervention point.
