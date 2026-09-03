/**
 * In-Memory Loopback Serial Transport for Testing.
 *
 * Implements a symmetrical bidirectional byte channel that simulates serial
 * wire characteristics:
 * - Arbitrary chunk fragmentation
 * - Configurable transmission delay
 * - Peer disconnect propagation
 */

import type { SerialTransport } from "./serial-transport";

export interface LoopbackTransportOptions {
  readonly chunkSize?: number;
  readonly delayMs?: number;
}

export class LoopbackSerialTransport implements SerialTransport {
  private _connected = false;
  private peer?: LoopbackSerialTransport;
  private readonly dataListeners: Set<(data: Uint8Array) => void> = new Set();
  private readonly disconnectListeners: Set<(reason?: string) => void> = new Set();
  private readonly encoder = new TextEncoder();
  private chunkSize?: number;
  private delayMs?: number;

  constructor(options: LoopbackTransportOptions = {}) {
    this.chunkSize = options.chunkSize;
    this.delayMs = options.delayMs;
  }

  public static createPair(
    optionsA: LoopbackTransportOptions = {},
    optionsB: LoopbackTransportOptions = {}
  ): [LoopbackSerialTransport, LoopbackSerialTransport] {
    const transportA = new LoopbackSerialTransport(optionsA);
    const transportB = new LoopbackSerialTransport(optionsB);
    transportA.peer = transportB;
    transportB.peer = transportA;
    return [transportA, transportB];
  }

  public setChunkSize(chunkSize?: number): void {
    this.chunkSize = chunkSize !== undefined && chunkSize > 0 ? chunkSize : undefined;
  }

  public setDelayMs(delayMs?: number): void {
    this.delayMs = delayMs !== undefined && delayMs >= 0 ? delayMs : undefined;
  }

  public async connect(): Promise<void> {
    this._connected = true;
  }

  public async disconnect(reason?: string): Promise<void> {
    if (!this._connected) return;
    this._connected = false;
    for (const listener of this.disconnectListeners) {
      try {
        listener(reason);
      } catch (err) {
        console.error("[LoopbackSerialTransport] Disconnect listener error:", err);
      }
    }
    // Also notify peer of disconnection if still connected
    if (this.peer && this.peer._connected) {
      void this.peer.disconnect(reason ?? "Peer closed connection");
    }
  }

  public get connected(): boolean {
    return this._connected;
  }

  public async write(data: Uint8Array | string): Promise<void> {
    if (!this._connected) {
      throw new Error("Cannot write to disconnected LoopbackSerialTransport");
    }
    if (!this.peer || !this.peer._connected) {
      // Peer not connected — bytes dropped or lost
      return;
    }

    const bytes = typeof data === "string" ? this.encoder.encode(data) : data;
    const targetPeer = this.peer;

    const dispatch = () => {
      if (!targetPeer._connected) return;

      if (this.chunkSize && this.chunkSize > 0 && bytes.length > this.chunkSize) {
        for (let offset = 0; offset < bytes.length; offset += this.chunkSize) {
          const slice = bytes.slice(offset, offset + this.chunkSize);
          targetPeer.receiveBytes(slice);
        }
      } else {
        targetPeer.receiveBytes(bytes);
      }
    };

    if (this.delayMs && this.delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.delayMs));
      dispatch();
    } else {
      dispatch();
    }
  }

  private receiveBytes(bytes: Uint8Array): void {
    for (const listener of this.dataListeners) {
      try {
        listener(bytes);
      } catch (err) {
        console.error("[LoopbackSerialTransport] Data listener error:", err);
      }
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
