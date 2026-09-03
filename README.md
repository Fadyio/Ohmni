# OHMNI

> **Ohmni turns browser-connected hardware into a WebMCP instrument surface for AI agents.**

Connect real hardware over Web Serial or explore the virtual fault challenge.
The AI agent observes autonomously, physical actuation is human-gated, measurements become immutable evidence, and hardware modifications require your hands.
---

## Live Demo & Repository

- **Live Production Workbench:** [https://ohmni-three.vercel.app](https://ohmni-three.vercel.app)
- **Repository:** [https://github.com/Fadyio/Ohmni](https://github.com/Fadyio/Ohmni)
- **Submission Track:** The WebMCP Challenge (Devpost)

---

## 90-Second Architecture

```text
                    ┌─────────────────────────┐
                    │       Bench Agent       │
                    └────────────┬────────────┘
                                 │ WebMCP
                    ┌────────────▼────────────┐
                    │   Instrument Registry   │
                    └────────────┬────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │      DeviceAdapter      │
                    └───────┬─────────┬───────┘
                            │         │
                 ┌──────────▼──┐   ┌──▼──────────────┐
                 │   Virtual   │   │  SerialDevice   │
                 │   Adapter   │   │    Adapter      │
                 └─────────────┘   └──┬──────────────┘
                                      │ Web Serial (NDJSON v1)
                                      ▼
                                Physical Hardware

```

> **Honesty & Verification Notice:** Automated release tests validate the complete `SerialDeviceAdapter` protocol path using a simulated serial peer. Physical electrical validation requires an attached microcontroller board (see [docs/REAL-HARDWARE-QUICKSTART.md](docs/REAL-HARDWARE-QUICKSTART.md)).
---

## Why WebMCP?

Embedded engineers waste hours determining whether a failure is firmware, wiring, power, buses, configuration, or physical hardware. Today's coding agents can inspect source code but stop at the edge of the computer.

A remote Model Context Protocol (MCP) server reaches cloud databases. Today Ohmni demonstrates the browser-native control plane on a deterministic virtual ESP32 reference board, with the device-adapter boundary designed for physical Web Serial hardware next.

Ohmni lets the device's web console expose live measurements and bounded tests directly to an agent through the browser's native `document.modelContext` API. The browser owns the hardware connection, enforces safety boundaries, and requires human consent before physical actuation.

---

## Try the Blind Challenge

Ohmni features reproducible hardware fault challenges designed for autonomous evaluation. The underlying fault is strictly firewalled from the agent's context. The agent receives only the reported symptom:

> *"The controller restarts whenever the cooling fan turns on."*

1. **Observe:** The agent calls `read_reset_history` and `measure_supply_voltage` to observe power state.
2. **Test:** The agent requests a controlled load test via `run_relay_stress_test`.
3. **Safety Gate:** The browser halts execution until the human user authorizes the physical actuation.
4. **Reproduce:** Under load, the 3.3 V rail collapses to 2.72 V, triggering a brownout reset captured on the live oscilloscope.
5. **Human Hands:** The AI diagnoses the shared power rail fault. Unable to move physical jumpers itself, it requests human intervention: *"Move JP1 from 3.3 V to the 5 V auxiliary rail."*
6. **Verify:** After the human switches the jumper, the agent reruns the stress test, confirms 3.18 V rail stability with zero resets, and unseals the ground truth for an empirical diagnosis match.

---

## Five Key Instruments

The connected board dynamically exposes diagnostic instruments tailored to its physical capabilities:

1. `read_reset_history` — Inspect non-volatile microcontroller reset logs (`BROWNOUT`, `WATCHDOG`, `SOFTWARE_PANIC`).
2. `measure_supply_voltage` — Sample real-time rail voltage with statistical min/max/average.
3. `run_relay_stress_test` — **[Amber Physical Gate]** Actuate fan relay under load to test supply stability.
4. `list_evidence` — Query captured empirical facts and telemetry citations.
5. `request_human_intervention` — Request physical human action (e.g. relocate jumper, reseat wiring) with scientific rationale.

*(Full tool registry with domain instruments is accessible in-app via the WebMCP Inspector).*

---

## Human Safety Model

- **Green Instruments (Passive Observation):** Autonomous execution. Passive voltage sensing and register reads cannot alter hardware state.
- **Amber Instruments (Physical Actuation):** Pauses execution. Requires explicit human authorization (`[Approve]` / `[Deny]`).
- **Fail-Safe Invariant:** The relay coil is guaranteed to return to `OPEN` across all termination paths: tool denial, user abort, timeout, exception, or disconnect.
- **Physical Boundary:** The AI cannot physically touch hardware; physical repairs require intentional human action.

---

## How to Run Locally

### Prerequisites
- [Bun](https://bun.sh) (v1.2+)
- Google Chrome (latest stable)

```bash
# Clone the official repository
git clone https://github.com/Fadyio/Ohmni.git
cd Ohmni

# Install dependencies
bun install

# Start development server
bun run dev
```

Open `http://localhost:5173` in Google Chrome.

---

## Testing & Verification

```bash
# Run strict TypeScript check and full test suite
bun run typecheck
bun test

# Run the fail-closed judge verification gate against production
bun run judge:verify

# Run the release verification suite
bun run release:verify

The test suite validates:
- 300+ unit, domain, safety, and scenario tests across 44 test suites (0 failures).
- Real Chrome WebMCP discovery and execution.
- 60fps telemetry ring buffer and oscilloscope sweep.
- Amber safety gate approval/denial invariants.
- Strict hidden-state firewall isolating ground truth from model context.

---

## License

MIT License — see [LICENSE](LICENSE) for details.
