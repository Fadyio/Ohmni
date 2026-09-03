/**
 * Device Session Manager.
 *
 * Coordinates adapter lifecycle transitions between Virtual and Physical hardware modes.
 * Ensures:
 * - Clean tool unregistration from WebMCP ModelContext when switching or disconnecting.
 * - Zero listener leaks on TelemetryEventBus.
 * - Investigation history (Evidence Ledger, Hypothesis Store, Experiment Store) is preserved.
 * - Smooth in-page mode transitions without full page reloads.
 */

import type { DeviceAdapter } from "./adapter";
import type { DeviceDescriptor } from "./descriptor";
import type { DeviceMode, DeviceConnectionState, DeviceSessionState } from "./session";
import type { DeviceToolRegistrar } from "@/infrastructure/webmcp/device-tool-registrar";
import type { ITelemetryEventBus } from "@/domain/telemetry/bus";

export interface DeviceSessionManagerOptions {
  readonly initialAdapter: DeviceAdapter;
  readonly initialMode?: DeviceMode;
  readonly toolRegistrar: DeviceToolRegistrar;
  readonly telemetryBus?: ITelemetryEventBus;
}

export class DeviceSessionManager {
  private activeMode: DeviceMode;
  private activeAdapter: DeviceAdapter;
  private connectionState: DeviceConnectionState = "disconnected";
  private errorMessage?: string;
  private readonly toolRegistrar: DeviceToolRegistrar;
  private readonly telemetryBus?: ITelemetryEventBus;
  private readonly listeners = new Set<(state: DeviceSessionState) => void>();
  private unsubscribeAdapterEvents?: () => void;

  constructor(options: DeviceSessionManagerOptions) {
    this.activeAdapter = options.initialAdapter;
    this.activeMode = options.initialMode ?? "virtual";
    this.toolRegistrar = options.toolRegistrar;
    this.telemetryBus = options.telemetryBus;

    if (this.activeAdapter.isConnected()) {
      this.connectionState = "connected";
      this.bindAdapterEvents(this.activeAdapter);
    }
  }

  public getMode(): DeviceMode {
    return this.activeMode;
  }

  public getAdapter(): DeviceAdapter {
    return this.activeAdapter;
  }

  public getState(): DeviceSessionState {
    const isConn = this.activeAdapter.isConnected();
    let desc: DeviceDescriptor | null = null;
    try {
      desc = this.activeAdapter.getDescriptor();
    } catch {
      desc = null;
    }

    return {
      mode: this.activeMode,
      adapter: this.activeAdapter,
      descriptor: desc,
      connectionState: isConn ? "connected" : this.connectionState,
      errorMessage: this.errorMessage,
    };
  }

  public subscribe(listener: (state: DeviceSessionState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    const state = this.getState();
    for (const listener of this.listeners) {
      try {
        listener(state);
      } catch (err) {
        console.error("[DeviceSessionManager] Listener error:", err);
      }
    }
  }

  private bindAdapterEvents(adapter: DeviceAdapter): void {
    if (this.unsubscribeAdapterEvents) {
      this.unsubscribeAdapterEvents();
      this.unsubscribeAdapterEvents = undefined;
    }

    if (this.telemetryBus) {
      this.unsubscribeAdapterEvents = adapter.subscribe((event) => {
        this.telemetryBus?.publish(event);
      });
    }
  }

  public async switchToVirtual(virtualAdapter: DeviceAdapter): Promise<void> {
    await this.teardownCurrentAdapter();

    this.activeAdapter = virtualAdapter;
    this.activeMode = "virtual";
    this.connectionState = "disconnected";
    this.errorMessage = undefined;

    this.notify();
  }

  public async switchToPhysical(physicalAdapter: DeviceAdapter): Promise<void> {
    await this.teardownCurrentAdapter();

    this.activeAdapter = physicalAdapter;
    this.activeMode = "physical";
    this.connectionState = "disconnected";
    this.errorMessage = undefined;

    this.notify();
  }

  public setConnectionState(
    state: DeviceConnectionState,
    errorMessage?: string
  ): void {
    this.connectionState = state;
    this.errorMessage = errorMessage;
    this.notify();
  }

  public async connect(): Promise<void> {
    this.connectionState = "opening_port";
    this.errorMessage = undefined;
    this.notify();

    try {
      this.connectionState = "negotiating_protocol";
      this.notify();

      await this.activeAdapter.connect();

      // Register discovered WebMCP instruments
      await this.toolRegistrar.registerDevice(this.activeAdapter);

      // Bind telemetry bus bridge
      this.bindAdapterEvents(this.activeAdapter);

      this.connectionState = "connected";
      this.notify();
    } catch (err) {
      this.connectionState = "error";
      this.errorMessage = err instanceof Error ? err.message : String(err);
      this.notify();
      throw err;
    }
  }

  public async disconnect(): Promise<void> {
    await this.teardownCurrentAdapter();
    this.connectionState = "disconnected";
    this.notify();
  }

  private async teardownCurrentAdapter(): Promise<void> {
    if (this.unsubscribeAdapterEvents) {
      this.unsubscribeAdapterEvents();
      this.unsubscribeAdapterEvents = undefined;
    }

    // 1. Unregister WebMCP tools
    this.toolRegistrar.unregisterDevice(this.activeAdapter);

    // 2. Disconnect adapter
    if (this.activeAdapter.isConnected()) {
      try {
        await this.activeAdapter.disconnect();
      } catch (err) {
        console.warn("[DeviceSessionManager] Error during adapter disconnect:", err);
      }
    }
  }
}
