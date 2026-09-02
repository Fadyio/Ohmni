# 0006. Versioned NDJSON Protocol with Correlated RPC and Chunked Telemetry

Date: 2026-09-02

## Status

Accepted

## Context

Physical hardware communication over Web Serial requires a reliable, transparent framing mechanism that can handle three concurrent responsibilities: device capability handshaking, correlated request-response command execution, and high-frequency asynchronous telemetry streaming, while remaining resilient to non-JSON ROM/bootloader text during microcontroller resets.

## Decision

We will implement a **Versioned Newline-Delimited JSON (NDJSON) Protocol (v1)** operating over standard 115200 baud Web Serial:

1. **Explicit Message Typing:** Every message line contains a distinct `type` discriminant (`hello`, `descriptor`, `request`, `response`, `event`, `telemetry`, `cancel`).
2. **Handshake & Capability Discovery:**
   - Host sends `{"type": "hello", "protocol": 1}`.
   - Device returns `{"type": "descriptor", "capabilities": [...], "limits": {...}}`.
   - The browser matches reported capabilities against its trusted tool registry before registering WebMCP tools.
3. **Correlated Request-Response RPC:** Every host command includes a unique `id`. The device echoes this `id` in its structured response (`ok: true, result` or `ok: false, error: { code, message }`).
4. **Chunked Telemetry Arrays:** To prevent serial framing overhead at 100+ samples/sec, continuous measurements are emitted as chunked arrays (`{ type: "telemetry", channel: "supply_voltage", t0_ms, dt_ms, samples: [...] }`).
5. **Fault-Tolerant Parser & Boot Text Quarantine:** Lines failing `JSON.parse` (e.g., ESP32 ROM bootloader text `rst:0xf (BROWNOUT_RST)`) are routed into an untrusted `RawDeviceLog` buffer without crashing the protocol parser.
6. **Automatic Re-Handshake on MCU Reset:** If the target resets during a test (e.g., brownout), the host detects the reboot, re-runs the handshake to verify device identity, and restores instrument state while preserving prior investigation history.

```text
  Browser                                    ESP32 Hardware
     │                                             │
     │──── {"type":"hello","protocol":1} ─────────►│
     │◄─── {"type":"descriptor",...} ──────────────│ (WebMCP tools registered)
     │                                             │
     │──── {"type":"request","id":"cmd_1",...} ───►│
     │◄─── {"type":"event","event":"started"} ─────│
     │◄─── {"type":"telemetry","samples":[...]} ───│ (Feeds Oscilloscope bus)
     │◄─── {"type":"response","id":"cmd_1",...} ───│ (Resolves WebMCP tool)
```

## Consequences

### Positive
- **Human-Readable & Debuggable:** Easy inspection in browser DevTools and developer serial monitors.
- **High Telemetry Efficiency:** Chunked sample arrays allow rich 100Hz+ waveforms without packet flooding.
- **Robust Against Microcontroller Resets:** Clean separation of protocol JSON from raw ROM crash logs.

### Negative / Tradeoffs
- Slightly higher text framing overhead compared to binary CBOR/Protobuf protocols (though negligible for 115200 baud diagnostic telemetry).
