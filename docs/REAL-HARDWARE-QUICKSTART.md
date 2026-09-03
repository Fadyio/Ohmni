# Real Hardware Manual Quickstart (For George)

This concise guide walks through connecting a physical ESP32 microcontroller board to the **OHMNI Hardware Diagnostic Workbench** via Web Serial.

---

## 1. Prerequisites

- An **ESP32-S3** board (or compatible ESP32 module).
- USB cable with data lines connected to your computer.
- Desktop **Google Chrome** or **Microsoft Edge** (Web Serial is not supported on Safari or Firefox).
- [PlatformIO CLI](https://platformio.org/) installed:
  ```bash
  pip install platformio
  ```

---

## 2. Configure & Flash Firmware

1. Navigate to the reference firmware directory:
   ```bash
   cd firmware/ohmni-esp32-reference
   ```
2. Open `src/main.cpp` and verify the pin definitions match your board:
   - `OHMNI_RELAY_PIN` (default: `GPIO 4`)
   - `OHMNI_SUPPLY_ADC_PIN` (default: `GPIO 5`)
   - `OHMNI_SUPPLY_ADC_SCALE` (default: `2.0` for 10k/10k divider)
3. Compile and upload to your board:
   ```bash
   pio run --target upload
   ```

---

## 3. Connect to Ohmni in Chrome

1. Open **[https://ohmni-three.vercel.app](https://ohmni-three.vercel.app)** in desktop Chrome.
2. Click **Connect Hardware** on the landing page.
3. In the modal, click **Select Serial Device**.
4. Chrome will prompt you to select your ESP32's USB Serial Port (e.g. `/dev/tty.usbmodem...` on macOS or `COMx` on Windows).
5. The workbench will automatically:
   - Negotiate ADR 0006 Protocol v1 over 115200 baud.
   - Discover the device descriptor and firmware metadata.
   - Dynamically register WebMCP instruments (`read_device_info`, `measure_supply_voltage`, `run_relay_stress_test`).
   - Transition to the Hardware Workbench displaying live signals and telemetry.

---

## 4. Run Hardware Diagnostics

1. Ask the Bench Agent to run observational tools:
   - `measure_supply_voltage`
   - `read_system_health`
   - `read_reset_history`
2. Test an Amber Actuator operation:
   - Request `run_relay_stress_test`.
   - Notice the **Amber Safety Authorization Gate** pauses execution.
   - Click **Authorize & Energize** to approve.
   - Observe real-time chunked voltage telemetry streaming into the 60fps oscilloscope canvas!
3. Test emergency cutoff:
   - Trigger an actuation and click the **Emergency Stop** / abort button.
   - Confirm the relay immediately clicks open and returns to its safe, inert state.
4. Click **Disconnect** when finished to release the serial port.

---

## 5. Troubleshooting

| Symptom | Cause | Solution |
| :--- | :--- | :--- |
| **"Web Serial unavailable"** | Using Safari, Firefox, or non-secure context | Use desktop Google Chrome or Edge over HTTPS or `localhost`. |
| **Port access denied / busy** | Port held by Arduino Serial Monitor or `pio device monitor` | Close any external serial terminals before clicking Connect. |
| **Handshake timeout (3000ms)** | Wrong baud rate or board not running firmware | Verify firmware is flashed; ensure baud is 115200. |
| **Unexpected reset / brownout** | Relay coil drawing too much current from 3.3V rail | Power relay from an independent 5V supply with common ground. |
| **Garbage / raw lines in log** | Normal ESP32 ROM bootloader output during power-on | Expected! Ohmni's `RawDeviceLog` safely quarantines boot text without crashing. |
