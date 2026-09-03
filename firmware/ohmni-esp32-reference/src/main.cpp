/**
 * OHMNI ESP32-S3 Reference Controller Firmware.
 *
 * Implements the ADR 0006 Versioned NDJSON Protocol v1 over Serial (115200 baud).
 * Bridges physical hardware instrumentation directly to the in-browser WebMCP agent surface.
 *
 * HARDWARE SAFETY INVARIANTS:
 * 1. On boot, GPIO pins initialize to safe OPEN/OFF states before protocol negotiation.
 * 2. Actuator operations (relay coil) are bounded in duration (<= 500 ms per cycle).
 * 3. Cancel signals or resets restore relay to inert open contact.
 * 4. Brownouts or unexpected resets are tracked via esp_reset_reason() and reported.
 */

#include <Arduino.h>
#include <ArduinoJson.h>
#include <esp_system.h>

// ==============================================================================
// CONFIGURABLE PIN DEFINITIONS & SCALING CONSTANTS
// Customize for your target hardware / breadboard setup.
// ==============================================================================
#ifndef OHMNI_RELAY_PIN
#define OHMNI_RELAY_PIN 4        // Active-HIGH transistor driving relay coil
#endif

#ifndef OHMNI_SUPPLY_ADC_PIN
#define OHMNI_SUPPLY_ADC_PIN 5   // Analog input connected to supply voltage divider
#endif

#ifndef OHMNI_SUPPLY_ADC_SCALE
#define OHMNI_SUPPLY_ADC_SCALE 2.0 // Voltage divider ratio (e.g. 10k/10k = 2.0)
#endif

#ifndef OHMNI_BAUD_RATE
#define OHMNI_BAUD_RATE 115200
#endif

#define PROTOCOL_VERSION 1
#define FIRMWARE_VERSION "1.0.0"
#define DEVICE_ID "esp32s3-physical-001"
#define DEVICE_NAME "ESP32-S3 Bench Controller"

// State tracking
static bool relayActive = false;
static uint32_t bootCount = 0;
static esp_reset_reason_t lastResetReason = ESP_RST_UNKNOWN;

// Forward declarations
void handleCommand(const String& line);
void sendDescriptor();
float readSupplyVoltage();
const char* getResetReasonString(esp_reset_reason_t reason);

void setup() {
    // 1. Hardware Safety First: Guarantee relay starts in inert open state
    pinMode(OHMNI_RELAY_PIN, OUTPUT);
    digitalWrite(OHMNI_RELAY_PIN, LOW);
    relayActive = false;

    // Configure ADC pin
    analogReadResolution(12);
    pinMode(OHMNI_SUPPLY_ADC_PIN, INPUT);

    // Initialize serial communication
    Serial.begin(OHMNI_BAUD_RATE);

    // Capture boot diagnostics
    lastResetReason = esp_reset_reason();

    // Small delay to allow USB-CDC enumeration on ESP32-S3
    delay(500);
}

void loop() {
    if (Serial.available()) {
        String line = Serial.readStringUntil('\n');
        line.trim();
        if (line.length() > 0) {
            handleCommand(line);
        }
    }
}

void handleCommand(const String& line) {
    JsonDocument doc;
    DeserializationError error = deserializeJson(doc, line);

    if (error) {
        // Non-JSON or malformed line — ignore gracefully
        return;
    }

    const char* type = doc["type"];
    if (!type) return;

    if (strcmp(type, "hello") == 0) {
        int protocol = doc["protocol"] | 0;
        if (protocol == PROTOCOL_VERSION) {
            sendDescriptor();
        } else {
            JsonDocument resp;
            resp["type"] = "response";
            resp["ok"] = false;
            resp["error"]["code"] = "PROTOCOL_MISMATCH";
            resp["error"]["message"] = "Firmware only supports ADR 0006 protocol v1";
            serializeJson(resp, Serial);
            Serial.println();
        }
    } else if (strcmp(type, "request") == 0) {
        const char* reqId = doc["id"];
        const char* capability = doc["capability"];

        if (!reqId || !capability) return;

        if (strcmp(capability, "read_device_info") == 0) {
            JsonDocument resp;
            resp["type"] = "response";
            resp["id"] = reqId;
            resp["ok"] = true;
            resp["result"]["chip"] = "ESP32-S3";
            resp["result"]["cores"] = 2;
            resp["result"]["cpuFreqMhz"] = getCpuFrequencyMhz();
            resp["result"]["firmware"] = FIRMWARE_VERSION;
            resp["result"]["deviceId"] = DEVICE_ID;
            serializeJson(resp, Serial);
            Serial.println();
        } else if (strcmp(capability, "read_reset_history") == 0) {
            JsonDocument resp;
            resp["type"] = "response";
            resp["id"] = reqId;
            resp["ok"] = true;
            JsonArray resets = resp["result"]["resets"].to<JsonArray>();
            JsonObject r = resets.add<JsonObject>();
            r["reason"] = getResetReasonString(lastResetReason);
            r["timestamp"] = millis();
            serializeJson(resp, Serial);
            Serial.println();
        } else if (strcmp(capability, "read_system_health") == 0) {
            JsonDocument resp;
            resp["type"] = "response";
            resp["id"] = reqId;
            resp["ok"] = true;
            resp["result"]["freeHeapBytes"] = ESP.getFreeHeap();
            resp["result"]["uptimeMs"] = millis();
            resp["result"]["internalTempC"] = temperatureRead();
            serializeJson(resp, Serial);
            Serial.println();
        } else if (strcmp(capability, "measure_supply_voltage") == 0) {
            float v = readSupplyVoltage();
            JsonDocument resp;
            resp["type"] = "response";
            resp["id"] = reqId;
            resp["ok"] = true;
            resp["result"]["voltage"] = v;
            resp["result"]["unit"] = "V";
            resp["result"]["nominal"] = 3.3;
            resp["result"]["withinLimits"] = (v >= 2.9 && v <= 3.5);
            serializeJson(resp, Serial);
            Serial.println();
        } else if (strcmp(capability, "run_relay_stress_test") == 0) {
            // Amber Actuator: Bounded Relay Stress Test
            int cycles = doc["params"]["cycles"] | 1;
            int durationMs = doc["params"]["duration_ms"] | 200;

            // Firmware-level safety envelope clamping
            if (cycles < 1) cycles = 1;
            if (cycles > 10) cycles = 10;
            if (durationMs < 10) durationMs = 10;
            if (durationMs > 500) durationMs = 500;

            // Emit started event
            JsonDocument startEvt;
            startEvt["type"] = "event";
            startEvt["event"] = "stress_test_started";
            startEvt["cycles"] = cycles;
            startEvt["duration_ms"] = durationMs;
            serializeJson(startEvt, Serial);
            Serial.println();

            // Execute test with live telemetry
            bool aborted = false;
            float minV = 5.0;

            for (int c = 0; c < cycles && !aborted; c++) {
                // Check for incoming cancel
                if (Serial.available()) {
                    String check = Serial.readStringUntil('\n');
                    if (check.indexOf("\"cancel\"") >= 0) {
                        aborted = true;
                        break;
                    }
                }

                // Energize coil
                digitalWrite(OHMNI_RELAY_PIN, HIGH);
                relayActive = true;

                // High-frequency telemetry chunk
                JsonDocument telem;
                telem["type"] = "telemetry";
                telem["channel"] = "supply_voltage";
                telem["unit"] = "V";
                telem["t0_ms"] = millis();
                telem["dt_ms"] = 10;
                JsonArray samples = telem["samples"].to<JsonArray>();

                unsigned long start = millis();
                while (millis() - start < (unsigned long)durationMs) {
                    float s = readSupplyVoltage();
                    samples.add(s);
                    if (s < minV) minV = s;
                    delay(10);
                }

                // De-energize coil
                digitalWrite(OHMNI_RELAY_PIN, LOW);
                relayActive = false;

                serializeJson(telem, Serial);
                Serial.println();

                delay(100);
            }

            // Always restore safe open state
            digitalWrite(OHMNI_RELAY_PIN, LOW);
            relayActive = false;

            // Send correlated RPC response
            JsonDocument resp;
            resp["type"] = "response";
            resp["id"] = reqId;
            resp["ok"] = !aborted;
            if (aborted) {
                resp["error"]["code"] = "CANCELLED";
                resp["error"]["message"] = "Execution cancelled by host";
            } else {
                resp["result"]["completedCycles"] = cycles;
                resp["result"]["minVoltage"] = minV;
                resp["result"]["nominalVoltage"] = 3.3;
                resp["result"]["brownoutTriggered"] = (minV < 2.80);
            }
            serializeJson(resp, Serial);
            Serial.println();
        } else {
            JsonDocument resp;
            resp["type"] = "response";
            resp["id"] = reqId;
            resp["ok"] = false;
            resp["error"]["code"] = "UNKNOWN_CAPABILITY";
            resp["error"]["message"] = "Capability not implemented on this microcontroller";
            serializeJson(resp, Serial);
            Serial.println();
        }
    } else if (strcmp(type, "cancel") == 0) {
        // Immediate hardware safe cutoff
        digitalWrite(OHMNI_RELAY_PIN, LOW);
        relayActive = false;
    }
}

void sendDescriptor() {
    JsonDocument desc;
    desc["type"] = "descriptor";
    desc["protocol"] = PROTOCOL_VERSION;

    desc["device"]["id"] = DEVICE_ID;
    desc["device"]["name"] = DEVICE_NAME;
    desc["device"]["firmwareVersion"] = FIRMWARE_VERSION;
    desc["device"]["manufacturer"] = "Espressif Systems";
    desc["device"]["model"] = "ESP32-S3";
    desc["device"]["hardwareRevision"] = "1.0";
    desc["device"]["transport"] = "Web Serial";

    JsonArray caps = desc["capabilities"].to<JsonArray>();

    // 1. read_device_info
    JsonObject c1 = caps.add<JsonObject>();
    c1["name"] = "read_device_info";
    c1["description"] = "Read hardware identity, chip model, and firmware version.";
    c1["safety"] = "green";
    c1["readOnly"] = true;

    // 2. read_reset_history
    JsonObject c2 = caps.add<JsonObject>();
    c2["name"] = "read_reset_history";
    c2["description"] = "Retrieve chronological log of system reset events and causes.";
    c2["safety"] = "green";
    c2["readOnly"] = true;

    // 3. read_system_health
    JsonObject c3 = caps.add<JsonObject>();
    c3["name"] = "read_system_health";
    c3["description"] = "Read operational diagnostics including free heap, core temp, and uptime.";
    c3["safety"] = "green";
    c3["readOnly"] = true;

    // 4. measure_supply_voltage
    JsonObject c4 = caps.add<JsonObject>();
    c4["name"] = "measure_supply_voltage";
    c4["description"] = "Sample instantaneous voltage on the primary 3.3V rail.";
    c4["safety"] = "green";
    c4["readOnly"] = true;

    // 5. run_relay_stress_test (Amber)
    JsonObject c5 = caps.add<JsonObject>();
    c5["name"] = "run_relay_stress_test";
    c5["description"] = "Actuate relay coil and monitor supply rail for brownout droop.";
    c5["safety"] = "amber";
    c5["readOnly"] = false;
    JsonObject p = c5["parameters"].to<JsonObject>();
    p["cycles"]["type"] = "integer";
    p["cycles"]["minimum"] = 1;
    p["cycles"]["maximum"] = 10;
    p["duration_ms"]["type"] = "integer";
    p["duration_ms"]["minimum"] = 10;
    p["duration_ms"]["maximum"] = 500;

    JsonObject limits = desc["limits"].to<JsonObject>();
    limits["maxRelayCycles"] = 10;
    limits["maxRelayDurationMs"] = 500;
    limits["voltageSagThreshold"] = 2.80;

    serializeJson(desc, Serial);
    Serial.println();
}

float readSupplyVoltage() {
    int raw = analogRead(OHMNI_SUPPLY_ADC_PIN);
    // 3.3V reference, 12-bit ADC (4095)
    float pinV = (raw / 4095.0) * 3.3;
    return pinV * OHMNI_SUPPLY_ADC_SCALE;
}

const char* getResetReasonString(esp_reset_reason_t reason) {
    switch (reason) {
        case ESP_RST_POWERON: return "POWER_ON";
        case ESP_RST_BROWNOUT: return "BROWNOUT";
        case ESP_RST_INT_WDT:
        case ESP_RST_TASK_WDT:
        case ESP_RST_WDT: return "WATCHDOG";
        case ESP_RST_SW: return "SOFTWARE";
        case ESP_RST_EXT: return "EXTERNAL_PIN";
        default: return "UNKNOWN";
    }
}
