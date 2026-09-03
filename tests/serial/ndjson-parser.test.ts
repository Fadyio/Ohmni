import { describe, it, expect } from "bun:test";
import { NdjsonParser } from "../../src/infrastructure/serial/ndjson-parser";
import { RawDeviceLog } from "../../src/infrastructure/serial/raw-device-log";
import type {
  ProtocolMessage,
  HelloMessage,
  DescriptorMessage,
  RequestMessage,
  ResponseMessage,
  TelemetryMessage,
} from "../../src/infrastructure/serial/protocol";

describe("NdjsonParser & Protocol v1", () => {
  it("parses a single complete JSON line ending in LF", () => {
    const parser = new NdjsonParser();
    const messages: ProtocolMessage[] = [];
    parser.onMessage((m) => messages.push(m));

    parser.push('{"type":"hello","protocol":1}\n');

    expect(messages).toHaveLength(1);
    expect(messages[0].type).toBe("hello");
    expect((messages[0] as HelloMessage).protocol).toBe(1);
    expect(parser.getRawLog().count()).toBe(0);
  });

  it("handles CRLF line endings", () => {
    const parser = new NdjsonParser();
    const messages: ProtocolMessage[] = [];
    parser.onMessage((m) => messages.push(m));

    parser.push('{"type":"hello","protocol":1}\r\n');

    expect(messages).toHaveLength(1);
    expect(messages[0].type).toBe("hello");
  });

  it("handles multiple messages arriving in a single chunk", () => {
    const parser = new NdjsonParser();
    const messages: ProtocolMessage[] = [];
    parser.onMessage((m) => messages.push(m));

    const chunk = [
      '{"type":"hello","protocol":1}',
      '{"type":"request","id":"req_1","capability":"measure_supply_voltage"}',
      '{"type":"response","id":"req_1","ok":true,"result":{"voltage":3.31}}',
    ].join("\n") + "\n";

    parser.push(chunk);

    expect(messages).toHaveLength(3);
    expect(messages[0].type).toBe("hello");
    expect(messages[1].type).toBe("request");
    expect(messages[2].type).toBe("response");
    expect((messages[2] as ResponseMessage).ok).toBe(true);
  });

  it("assembles fragmented lines arriving across multiple chunks", () => {
    const parser = new NdjsonParser();
    const messages: ProtocolMessage[] = [];
    parser.onMessage((m) => messages.push(m));

    parser.push('{"type":"req');
    expect(messages).toHaveLength(0);

    parser.push('uest","id":"cmd_abc",');
    expect(messages).toHaveLength(0);

    parser.push('"capability":"measure_supply_voltage"}\n');
    expect(messages).toHaveLength(1);
    expect((messages[0] as RequestMessage).capability).toBe("measure_supply_voltage");
  });

  it("handles Uint8Array input with multi-byte UTF-8 safely", () => {
    const parser = new NdjsonParser();
    const messages: ProtocolMessage[] = [];
    parser.onMessage((m) => messages.push(m));

    const text = '{"type":"event","event":"sensor_reading","name":"Ωhm-Meter"}\n';
    const bytes = new TextEncoder().encode(text);

    parser.push(bytes);
    expect(messages).toHaveLength(1);
    expect(messages[0].type).toBe("event");
  });

  it("ignores empty lines and pure whitespace", () => {
    const parser = new NdjsonParser();
    const messages: ProtocolMessage[] = [];
    parser.onMessage((m) => messages.push(m));

    parser.push("\n\n   \n\r\n");
    expect(messages).toHaveLength(0);
    expect(parser.getRawLog().count()).toBe(0);
  });

  it("quarantines malformed JSON lines into RawDeviceLog without crashing", () => {
    const rawLog = new RawDeviceLog();
    const parser = new NdjsonParser({ rawLog });
    const messages: ProtocolMessage[] = [];
    parser.onMessage((m) => messages.push(m));

    parser.push('THIS IS NOT JSON AT ALL\n{"type":"hello","protocol":1}\n{broken json\n');

    expect(messages).toHaveLength(1);
    expect(messages[0].type).toBe("hello");

    const entries = rawLog.getEntries();
    expect(entries).toHaveLength(2);
    expect(entries[0].line).toBe("THIS IS NOT JSON AT ALL");
    expect(entries[1].line).toBe("{broken json");
  });

  it("identifies and logs ESP32 ROM boot text and reset notices in RawDeviceLog", () => {
    const rawLog = new RawDeviceLog();
    let bootDetected = false;
    rawLog.onBootDetected((entry) => {
      if (entry.isBootText) bootDetected = true;
    });

    const parser = new NdjsonParser({ rawLog });
    parser.push("rst:0x10 (RTCWDT_RTC_RESET),boot:0x13 (SPI_FAST_FLASH_BOOT)\n");
    parser.push("configsip: 0, SPIWP:0xee\n");
    parser.push("rst:0xf (BROWNOUT_RST)\n");

    expect(rawLog.count()).toBe(3);
    expect(rawLog.getEntries()[0].isBootText).toBe(true);
    expect(rawLog.getEntries()[2].isBootText).toBe(true);
    expect(bootDetected).toBe(true);
  });

  it("enforces bounded buffer on RawDeviceLog", () => {
    const rawLog = new RawDeviceLog(20);
    for (let i = 0; i < 50; i++) {
      rawLog.append(`log line ${i}`);
    }

    expect(rawLog.count()).toBe(20);
    expect(rawLog.getEntries()[0].line).toBe("log line 30");
    expect(rawLog.getEntries()[19].line).toBe("log line 49");
  });

  it("discards oversized frames without unbounded memory growth", () => {
    const rawLog = new RawDeviceLog();
    const parser = new NdjsonParser({ maxLineLength: 100, rawLog });
    const messages: ProtocolMessage[] = [];
    parser.onMessage((m) => messages.push(m));

    // Push 200 bytes without any newline
    const hugeChunk = "A".repeat(200);
    parser.push(hugeChunk);

    // Buffer should be discarded and logged to rawLog
    expect(rawLog.count()).toBe(1);
    expect(rawLog.getEntries()[0].line).toContain("OVERSIZED_FRAME_DISCARDED");

    // Normal message after oversized frame should parse successfully
    parser.push('{"type":"hello","protocol":1}\n');
    expect(messages).toHaveLength(1);
  });

  it("validates complex telemetry messages", () => {
    const parser = new NdjsonParser();
    const messages: ProtocolMessage[] = [];
    parser.onMessage((m) => messages.push(m));

    const telemetryJson = JSON.stringify({
      type: "telemetry",
      channel: "supply_voltage",
      unit: "V",
      t0_ms: 1700000000000,
      dt_ms: 10,
      samples: [3.31, 3.30, 3.28, 2.75, 2.72, 3.30],
    }) + "\n";

    parser.push(telemetryJson);
    expect(messages).toHaveLength(1);
    const msg = messages[0] as TelemetryMessage;
    expect(msg.type).toBe("telemetry");
    expect(msg.samples).toHaveLength(6);
    expect(msg.samples[3]).toBe(2.75);
  });

  it("validates descriptor message with capabilities and limits", () => {
    const parser = new NdjsonParser();
    const messages: ProtocolMessage[] = [];
    parser.onMessage((m) => messages.push(m));

    const descriptorJson = JSON.stringify({
      type: "descriptor",
      protocol: 1,
      device: {
        id: "esp32s3-real",
        name: "ESP32-S3 Physical Node",
        firmwareVersion: "1.0.0",
        manufacturer: "Espressif",
        model: "DevKitC-1",
      },
      capabilities: [
        {
          name: "measure_supply_voltage",
          description: "Sample 3.3V rail ADC",
          safety: "green",
          readOnly: true,
        },
      ],
      limits: {
        maxRelayDurationMs: 500,
      },
    }) + "\n";

    parser.push(descriptorJson);
    expect(messages).toHaveLength(1);
    const desc = messages[0] as DescriptorMessage;
    expect(desc.type).toBe("descriptor");
    expect(desc.device.id).toBe("esp32s3-real");
    expect(desc.capabilities).toHaveLength(1);
  });
});
