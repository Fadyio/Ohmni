# OHMNI ESP32-S3 Reference Firmware

Reference firmware implementing the **ADR 0006 Versioned NDJSON Protocol (v1)** for microcontroller diagnostic instrumentation over Web Serial.

Exposes physical measurements, MCU health, reset history, and bounded actuator stress testing directly to the in-browser WebMCP AI Bench Agent.

---

## Hardware Safety & Electrical Invariants

1. **Inert Boot State:** On power-on or microcontroller reboot, the relay control pin (`OHMNI_RELAY_PIN`) is initialized to `LOW` (safe open contacts) before serial communication starts.
2. **Firmware Bounded Envelopes:** Actuator durations are strictly clamped in firmware (`cycles <= 10`, `duration_ms <= 500 ms`) independently of browser limits.
3. **Emergency Cutoff:** Any incoming `{"type": "cancel"}` line immediately de-energizes the coil.
4. **Brownout Recovery:** Uses `esp_reset_reason()` to detect supply droop resets and reports them honestly during re-handshake.

---

## Pin Configuration

Defaults configured at the top of `src/main.cpp`:

| Define | Default | Description |
| :--- | :--- | :--- |
| `OHMNI_RELAY_PIN` | `GPIO 4` | Active-HIGH transistor gate/base driving relay coil |
| `OHMNI_SUPPLY_ADC_PIN` | `GPIO 5` | Analog input connected to 3.3V rail voltage divider |
| `OHMNI_SUPPLY_ADC_SCALE` | `2.0` | Scaling factor for external voltage divider (e.g. 10k/10k) |
| `OHMNI_BAUD_RATE` | `115200` | Standard serial baud rate for ADR 0006 v1 |

> **IMPORTANT:** Reference firmware demonstrates the protocol on an ESP32-S3. Actual ADC scaling, GPIO mapping, voltage-divider values, relays, and hardware interfaces **MUST** be configured for your target board before flashing. Do not assume arbitrary boards match these pins.

---

## Flashing Instructions (PlatformIO)

1. Connect your ESP32-S3 board over USB.
2. Open terminal in `firmware/ohmni-esp32-reference`:
   ```bash
   pio run --target upload
   ```
3. Open desktop Google Chrome to `https://ohmni-three.vercel.app` (or `http://localhost:5173`).
4. Click **Connect Hardware**, select the USB serial port, and the workbench will dynamically discover the device and register its instruments!
