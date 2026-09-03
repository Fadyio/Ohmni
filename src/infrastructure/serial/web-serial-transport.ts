/**
 * Production Web Serial Transport.
 *
 * Backed by the W3C Web Serial API (`navigator.serial`).
 * Manages port discovery, reader/writer stream lifecycles, device unplug events,
 * and clean resource reclamation.
 */

import type { SerialTransport } from "./serial-transport";

export interface SerialPortFilter {
  readonly usbVendorId?: number;
  readonly usbProductId?: number;
}

export interface SerialPortRequestOptions {
  readonly filters?: readonly SerialPortFilter[];
}

export interface SerialOptions {
  readonly baudRate: number;
  readonly dataBits?: number;
  readonly stopBits?: number;
  readonly parity?: "none" | "even" | "odd";
  readonly bufferSize?: number;
  readonly flowControl?: "none" | "hardware";
}

export interface SerialPortInfo {
  readonly usbVendorId?: number;
  readonly usbProductId?: number;
}

export interface WebSerialPort {
  open(options: SerialOptions): Promise<void>;
  close(): Promise<void>;
  getInfo?(): SerialPortInfo;
  readonly readable: ReadableStream<Uint8Array> | null;
  readonly writable: WritableStream<Uint8Array> | null;
}

export interface NavigatorSerial {
  requestPort(options?: SerialPortRequestOptions): Promise<WebSerialPort>;
  getPorts(): Promise<WebSerialPort[]>;
  addEventListener(
    type: "connect" | "disconnect",
    listener: (event: { readonly port: WebSerialPort }) => void
  ): void;
  removeEventListener(
    type: "connect" | "disconnect",
    listener: (event: { readonly port: WebSerialPort }) => void
  ): void;
}

export function isWebSerialSupported(): boolean {
  if (typeof navigator === "undefined") return false;
  return Boolean("serial" in navigator && (navigator as unknown as { serial?: unknown }).serial);
}

export function checkWebSerialSupport(): { readonly supported: boolean; readonly reason?: string } {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return {
      supported: false,
      reason: "Web Serial requires a browser window environment.",
    };
  }
  if (!window.isSecureContext) {
    return {
      supported: false,
      reason: "Web Serial requires a secure context (HTTPS or localhost).",
    };
  }
  if (!isWebSerialSupported()) {
    return {
      supported: false,
      reason:
        "Web Serial is available in desktop Chromium browsers (Chrome, Edge, Opera, Brave). Safari and Firefox do not support Web Serial.",
    };
  }
  return { supported: true };
}

export interface WebSerialTransportOptions {
  readonly baudRate?: number;
  readonly port?: WebSerialPort;
  readonly requestOptions?: SerialPortRequestOptions;
}

export class WebSerialTransport implements SerialTransport {
  private _connected = false;
  private port?: WebSerialPort;
  private reader?: ReadableStreamDefaultReader<Uint8Array>;
  private writer?: WritableStreamDefaultWriter<Uint8Array>;
  private readonly baudRate: number;
  private readonly requestOptions?: SerialPortRequestOptions;
  private readonly dataListeners: Set<(data: Uint8Array) => void> = new Set();
  private readonly disconnectListeners: Set<(reason?: string) => void> = new Set();
  private readonly encoder = new TextEncoder();
  private disconnectHandler?: (event: { readonly port: WebSerialPort }) => void;

  constructor(options: WebSerialTransportOptions = {}) {
    this.baudRate = options.baudRate ?? 115_200;
    this.port = options.port;
    this.requestOptions = options.requestOptions;
  }

  public get connected(): boolean {
    return this._connected;
  }

  public getPort(): WebSerialPort | undefined {
    return this.port;
  }

  public async connect(): Promise<void> {
    if (this._connected) {
      return;
    }

    const check = checkWebSerialSupport();
    if (!check.supported) {
      throw new Error(`Web Serial unsupported: ${check.reason}`);
    }

    const navSerial = (navigator as unknown as { serial: NavigatorSerial }).serial;

    if (!this.port) {
      try {
        this.port = await navSerial.requestPort(this.requestOptions);
      } catch (err: unknown) {
        if (err instanceof DOMException && (err.name === "NotFoundError" || err.name === "AbortError")) {
          throw new Error("Port selection cancelled by user");
        }
        throw new Error(
          `Failed to request serial port: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }

    try {
      await this.port.open({ baudRate: this.baudRate });
    } catch (err: unknown) {
      throw new Error(
        `Failed to open serial port at ${this.baudRate} baud: ${err instanceof Error ? err.message : String(err)}`
      );
    }

    this._connected = true;

    if (this.port.readable) {
      this.reader = this.port.readable.getReader();
      void this.startReadLoop(this.reader);
    }

    if (this.port.writable) {
      this.writer = this.port.writable.getWriter();
    }

    this.disconnectHandler = (event) => {
      if (event.port === this.port) {
        void this.handleExternalDisconnect("Device physically unplugged");
      }
    };
    navSerial.addEventListener("disconnect", this.disconnectHandler);
  }

  private async startReadLoop(reader: ReadableStreamDefaultReader<Uint8Array>): Promise<void> {
    while (this._connected) {
      try {
        const { value, done } = await reader.read();
        if (done) {
          break;
        }
        if (value && value.length > 0) {
          for (const listener of this.dataListeners) {
            try {
              listener(value);
            } catch (err) {
              console.error("[WebSerialTransport] Data listener error:", err);
            }
          }
        }
      } catch (err) {
        if (this._connected) {
          void this.handleExternalDisconnect(
            `Serial read stream failed: ${err instanceof Error ? err.message : String(err)}`
          );
        }
        break;
      }
    }
  }

  private async handleExternalDisconnect(reason: string): Promise<void> {
    if (!this._connected) return;
    await this.cleanup();
    for (const listener of this.disconnectListeners) {
      try {
        listener(reason);
      } catch (err) {
        console.error("[WebSerialTransport] Disconnect listener error:", err);
      }
    }
  }

  public async write(data: Uint8Array | string): Promise<void> {
    if (!this._connected || !this.writer) {
      throw new Error("Cannot write to disconnected WebSerialTransport");
    }

    const bytes = typeof data === "string" ? this.encoder.encode(data) : data;
    try {
      await this.writer.write(bytes);
    } catch (err) {
      throw new Error(`Serial write failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  public async disconnect(reason?: string): Promise<void> {
    if (!this._connected) return;
    await this.cleanup();
    for (const listener of this.disconnectListeners) {
      try {
        listener(reason ?? "User disconnected");
      } catch (err) {
        console.error("[WebSerialTransport] Disconnect listener error:", err);
      }
    }
  }

  private async cleanup(): Promise<void> {
    this._connected = false;

    if (this.disconnectHandler && isWebSerialSupported()) {
      try {
        const navSerial = (navigator as unknown as { serial: NavigatorSerial }).serial;
        navSerial.removeEventListener("disconnect", this.disconnectHandler);
      } catch {}
      this.disconnectHandler = undefined;
    }

    if (this.reader) {
      try {
        await this.reader.cancel();
      } catch {}
      try {
        this.reader.releaseLock();
      } catch {}
      this.reader = undefined;
    }

    if (this.writer) {
      try {
        await this.writer.close();
      } catch {}
      try {
        this.writer.releaseLock();
      } catch {}
      this.writer = undefined;
    }

    if (this.port) {
      try {
        await this.port.close();
      } catch {}
    }
  }

  public subscribeData(listener: (data: Uint8Array) => void): () => void {
    this.dataListeners.add(listener);
    return () => this.dataListeners.delete(listener);
  }

  public subscribeDisconnect(listener: (reason?: string) => void): () => void {
    this.disconnectListeners.add(listener);
    return () => this.disconnectListeners.delete(listener);
  }
}
