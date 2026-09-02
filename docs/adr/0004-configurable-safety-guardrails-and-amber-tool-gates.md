# 0004. Configurable Safety Guardrails and Amber Tool Execution Gates

Date: 2026-09-02

## Status

Accepted

## Context

AI agents interacting with hardware test benches can potentially cause physical damage if given uncontrolled actuation powers. We must enforce defense-in-depth safety boundaries that distinguish observation from physical actuation, prevent privilege self-escalation by the LLM, and provide immediate human intervention capabilities.

## Decision

We will implement a **Three-Tier Safety Classification and Configurable Safety Gate System**:

1. **Tripartite Safety Tiers:**
   - **Green (Observational):** Safe, read-only diagnostic measurements (`read_device_info`, `read_reset_history`, `measure_supply_voltage`, `scan_i2c_bus`). Invoked autonomously.
   - **Amber (Controlled Actuation):** Physical side-effect experiments with rigid JSON Schema bounds (`run_relay_stress_test`, `pulse_relay`, `run_fan_test`).
   - **Red (Prohibited):** Destructive or unbounded primitives (`erase_flash`, `write_efuse`, raw serial commands) are entirely excluded from WebMCP registration.
2. **Supervised Mode as the Strict Default:**
   - Whenever hardware connects, the workbench defaults to **Supervised Mode**.
   - Invoking an Amber tool suspends the WebMCP `execute` promise and presents an explanatory human approval modal on the UI with risk details, duration, and test rationale.
   - The agent cannot approve its own requests; approval is strictly a physical human click.
3. **Session-Scoped Autonomous Safe Envelope:**
   - Users may explicitly toggle the "Autonomous Safe Envelope" for repetitive testing cycles.
   - Amber tools execute autonomously only if parameters strictly conform to website-enforced policy bounds. The envelope automatically revokes upon disconnect or page reload.
4. **Permanent Emergency Stop:**
   - A globally available Emergency Stop button instantly fires the active `AbortSignal`, aborts the WebMCP call, returns hardware to a safe state, and logs an aborted record to the Evidence Ledger.

```text
  Agent calls Amber Tool (e.g. run_relay_stress_test)
                   │
                   ▼
       Schema & Safety Validation
                   │
         ┌─────────┴─────────┐
         ▼                   ▼
  [Supervised Mode]   [Autonomous Envelope]
         │                   │
  Show Approval Modal        ▼
   [Approve] [Deny]    Enforce Safety Limits
         │                   │
         └─────────┬─────────┘
                   ▼
        Execute Hardware Actuation (with AbortSignal)
```

## Consequences

### Positive
- **Guaranteed Physical Safety:** Human maintains ultimate authority over physical changes.
- **Compelling Collaboration Demo:** Judges clearly observe the human-in-the-loop permission boundary during live diagnostic tests.
- **Deep WebMCP Alignment:** Demonstrates robust use of `AbortSignal` for hardware safety and cancellation.

### Negative / Tradeoffs
- Supervised mode introduces an asynchronous pause into the agent loop while waiting for the human to approve tests.
