/**
 * Abstract Serial Transport Boundary.
 *
 * Provides a uniform byte-stream transport interface for both native Web Serial
 * (`WebSerialTransport`) and in-memory test peers (`LoopbackSerialTransport`).
 */

export interface SerialTransport {
  /**
   * Open the underlying serial port or connection.
   */
  connect(): Promise<void>;

  /**
   * Gracefully close the connection and release locks.
   */
  disconnect(reason?: string): Promise<void>;

  /**
   * True if transport is currently connected and ready for I/O.
   */
  readonly connected: boolean;

  /**
   * Transmit binary or string data to the peer.
   */
  write(data: Uint8Array | string): Promise<void>;

  /**
   * Subscribe to raw incoming byte chunks.
   */
  subscribeData(listener: (data: Uint8Array) => void): () => void;

  /**
   * Subscribe to transport disconnection events.
   */
  subscribeDisconnect(listener: (reason?: string) => void): () => void;
}
