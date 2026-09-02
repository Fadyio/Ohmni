# 0002. Decoupled Real-Time Telemetry and Structured WebMCP Summaries

Date: 2026-09-02

## Status

Accepted

## Context

Hardware diagnosis produces high-frequency time-series data (voltage/current samples at 100Hz–1000Hz, rapid relay transitions, reset interrupts). Humans require continuous, real-time visual feedback (e.g. oscilloscope sweeps, immediate event markers), whereas LLM agents require concise, high-signal semantic summaries (e.g. baseline vs minimum voltage, reset counts, correlation timing) without context window bloat or latency overhead.

## Decision

We will decouple the data delivery paths for human visualizers and AI agents using an experiment-correlated architecture:

1. **Experiment Correlation:** Every diagnostic run receives a unique `experiment_id`. All downstream telemetry and tool responses correlate with this identifier.
2. **Real-Time Telemetry Event Bus:** `DeviceAdapter` implementations (`SerialDeviceAdapter` and `VirtualDeviceAdapter`) stream high-frequency events directly to `TelemetryEventBus`. The Oscilloscope and UI meters consume these streams via dedicated ring buffers and `requestAnimationFrame` rendering, bypassing React state overhead.
3. **Structured WebMCP Summaries:** The `ExperimentRunner` computes semantic aggregates during the run and returns a concise JSON summary to the invoking WebMCP tool (e.g., minimum voltage, sag delta, reset causes, timing correlations).
4. **Local Trace Persistence & Inspection:** Full high-density traces are preserved in `ExperimentRecord`s for local before/after verification overlays and user inspection. If an agent needs fine-grained waveform data, it queries a bounded `inspect_experiment_trace` tool.

```text
                  DEVICE / SIMULATOR
                         │
                         ▼
                    DeviceAdapter
                         │
              ┌──────────┴──────────┐
              │                     │
              ▼                     ▼
      TelemetryEventBus       ExperimentRunner
              │                     │
              ▼                     │
      Oscilloscope / UI             │
                                    │
                                    ▼
                            Structured Summary
                                    │
                                    ▼
                            WebMCP Tool Result
```

## Consequences

### Positive
- **Optimal Representation:** Humans get fluid 60fps oscilloscope rendering; agents receive high-signal, token-efficient JSON summaries.
- **Zero Divergence:** Virtual and physical backends feed the exact same `DeviceEvent` stream.
- **Trace Replay & Verification:** Before-and-after traces can be visually overlaid to prove fault resolution.

### Negative / Tradeoffs
- Requires ring-buffer management and canvas drawing abstractions to ensure high-rate events do not leak memory during long browser sessions.
