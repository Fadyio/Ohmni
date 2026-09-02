/**
 * Device Tool Registrar.
 * Bridges connected DeviceAdapter instances with the WebMCP ModelContext surface.
 * Dynamically registers vetted tools on connection and unregisters them on disconnect
 * via AbortController signals.
 */

import type { DeviceAdapter } from "@/domain/device/adapter";
import type { ModelContext } from "./types";
import { CapabilityRegistry } from "./capability-registry";

export interface DeviceSession {
  readonly adapter: DeviceAdapter;
  readonly abortController: AbortController;
  readonly registeredToolNames: readonly string[];
}

export class DeviceToolRegistrar {
  private readonly modelContext: ModelContext;
  private readonly capabilityRegistry: CapabilityRegistry;
  private readonly activeSessions: Map<DeviceAdapter, DeviceSession> = new Map();

  constructor(
    modelContext: ModelContext,
    capabilityRegistry: CapabilityRegistry = new CapabilityRegistry()
  ) {
    this.modelContext = modelContext;
    this.capabilityRegistry = capabilityRegistry;
  }

  public async registerDevice(adapter: DeviceAdapter): Promise<DeviceSession> {
    if (!adapter.isConnected()) {
      throw new Error("Cannot register WebMCP tools for a disconnected device");
    }

    // Unregister existing session for this adapter if present
    if (this.activeSessions.has(adapter)) {
      this.unregisterDevice(adapter);
    }

    const abortController = new AbortController();
    const descriptor = adapter.getDescriptor();
    const registeredToolNames: string[] = [];

    for (const capability of descriptor.capabilities) {
      const tool = this.capabilityRegistry.createTool(capability.name, adapter);
      if (!tool) {
        // Unknown or untrusted capability — skip registration
        continue;
      }

      await this.modelContext.registerTool(tool, {
        signal: abortController.signal,
      });
      registeredToolNames.push(tool.name);
    }

    const session: DeviceSession = {
      adapter,
      abortController,
      registeredToolNames,
    };

    this.activeSessions.set(adapter, session);
    return session;
  }

  public unregisterDevice(adapter: DeviceAdapter): void {
    const session = this.activeSessions.get(adapter);
    if (session) {
      session.abortController.abort();
      this.activeSessions.delete(adapter);
    }
  }

  public unregisterAll(): void {
    for (const session of this.activeSessions.values()) {
      session.abortController.abort();
    }
    this.activeSessions.clear();
  }

  public getSession(adapter: DeviceAdapter): DeviceSession | undefined {
    return this.activeSessions.get(adapter);
  }
}
