/**
 * Incremental NDJSON Stream Parser.
 *
 * Implements resilient streaming line assembly for Web Serial:
 * - Handles chunks split mid-line or across multi-message frames.
 * - Supports CRLF and LF line delimiters.
 * - Safely decodes UTF-8 Uint8Array or string chunks.
 * - Protects against memory exhaustion with an oversized line cap.
 * - Routes non-JSON lines and bootloader noise to RawDeviceLog without crashing.
 */

import { parseProtocolMessage, type ProtocolMessage } from "./protocol";
import { RawDeviceLog } from "./raw-device-log";

export interface NdjsonParserOptions {
  readonly maxLineLength?: number;
  readonly rawLog?: RawDeviceLog;
}

export class NdjsonParser {
  private readonly maxLineLength: number;
  private readonly rawLog: RawDeviceLog;
  private buffer = "";
  private readonly decoder = new TextDecoder("utf-8", { fatal: false });
  private readonly messageListeners: Set<(message: ProtocolMessage) => void> = new Set();
  private readonly rawLineListeners: Set<(line: string) => void> = new Set();

  constructor(options: NdjsonParserOptions = {}) {
    this.maxLineLength = options.maxLineLength ?? 65_536; // 64 KB cap
    this.rawLog = options.rawLog ?? new RawDeviceLog();
  }

  public getRawLog(): RawDeviceLog {
    return this.rawLog;
  }

  public push(chunk: string | Uint8Array): void {
    const text = typeof chunk === "string" ? chunk : this.decoder.decode(chunk, { stream: true });
    this.buffer += text;

    if (this.buffer.length > this.maxLineLength && !this.buffer.includes("\n")) {
      const dropped = this.buffer;
      this.buffer = "";
      this.rawLog.append(`[OVERSIZED_FRAME_DISCARDED: ${dropped.length} bytes]`);
      return;
    }

    let newlineIndex = this.buffer.indexOf("\n");
    while (newlineIndex !== -1) {
      let line = this.buffer.slice(0, newlineIndex);
      this.buffer = this.buffer.slice(newlineIndex + 1);

      if (line.endsWith("\r")) {
        line = line.slice(0, -1);
      }

      this.processLine(line);
      newlineIndex = this.buffer.indexOf("\n");
    }
  }

  private processLine(line: string): void {
    const trimmed = line.trim();
    if (trimmed.length === 0) {
      return;
    }

    this.rawLineListeners.forEach((listener) => {
      try {
        listener(line);
      } catch (err) {
        console.error("[NdjsonParser] Raw line listener error:", err);
      }
    });

    const result = parseProtocolMessage(line);
    if (result.ok) {
      for (const listener of this.messageListeners) {
        try {
          listener(result.message);
        } catch (err) {
          console.error("[NdjsonParser] Message listener error:", err);
        }
      }
    } else {
      this.rawLog.append(line);
    }
  }

  public flush(): void {
    if (this.buffer.trim().length > 0) {
      this.processLine(this.buffer);
    }
    this.buffer = "";
  }

  public reset(): void {
    this.buffer = "";
  }

  public onMessage(listener: (message: ProtocolMessage) => void): () => void {
    this.messageListeners.add(listener);
    return () => this.messageListeners.delete(listener);
  }

  public onRawLine(listener: (line: string) => void): () => void {
    this.rawLineListeners.add(listener);
    return () => this.rawLineListeners.delete(listener);
  }
}
