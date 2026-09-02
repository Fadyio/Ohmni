/**
 * Reusable DeviceAdapter Behavioral Contract Test Suite.
 * Every DeviceAdapter implementation (VirtualDeviceAdapter, SerialDeviceAdapter)
 * must satisfy this contract.
 */

import { describe, it, expect, beforeEach } from "bun:test";
import type { DeviceAdapter } from "@/domain/device/adapter";
import type { DeviceEvent } from "@/domain/device/events";

export interface AdapterFactory {
  createAdapter(): DeviceAdapter;
}

export function describeDeviceAdapterContract(
  adapterName: string,
  factory: AdapterFactory
): void {
  describe(`DeviceAdapter Contract: ${adapterName}`, () => {
    let adapter: DeviceAdapter;

    beforeEach(() => {
      adapter = factory.createAdapter();
    });

    it("starts in disconnected state", () => {
      expect(adapter.isConnected()).toBe(false);
    });

    it("transitions to connected on connect()", async () => {
      await adapter.connect();
      expect(adapter.isConnected()).toBe(true);
      await adapter.disconnect();
      expect(adapter.isConnected()).toBe(false);
    });

    it("transitions to disconnected on disconnect()", async () => {
      await adapter.connect();
      expect(adapter.isConnected()).toBe(true);
      await adapter.disconnect();
      expect(adapter.isConnected()).toBe(false);
    });

    it("cannot execute capability while disconnected", async () => {
      expect(adapter.isConnected()).toBe(false);
      const descriptor = adapter.getDescriptor();
      const firstCap = descriptor.capabilities[0];
      if (firstCap) {
        expect(() => adapter.executeCapability(firstCap.name)).toThrow(
          /not connected/i
        );
      }
    });

    it("provides a valid DeviceDescriptor with required fields and capabilities", async () => {
      await adapter.connect();
      const descriptor = adapter.getDescriptor();
      expect(typeof descriptor.id).toBe("string");
      expect(typeof descriptor.name).toBe("string");
      expect(typeof descriptor.protocolVersion).toBe("number");
      expect(Array.isArray(descriptor.capabilities)).toBe(true);
      expect(descriptor.capabilities.length).toBeGreaterThan(0);

      for (const cap of descriptor.capabilities) {
        expect(typeof cap.name).toBe("string");
        expect(typeof cap.description).toBe("string");
        expect(["green", "amber", "red"]).toContain(cap.safety);
        expect(typeof cap.readOnly).toBe("boolean");
      }
    });

    it("handles subscribe and unsubscribe cleanly without listener leaks", async () => {
      await adapter.connect();
      const events: DeviceEvent[] = [];
      const unsubscribe = adapter.subscribe((event) => {
        events.push(event);
      });

      // Trigger event emission via measure_supply_voltage
      await adapter.executeCapability("measure_supply_voltage");
      const eventCountBefore = events.length;
      expect(eventCountBefore).toBeGreaterThan(0);

      // Unsubscribe and verify no more events are received
      unsubscribe();
      await adapter.executeCapability("measure_supply_voltage");
      const eventCountAfter = events.length;
      expect(eventCountAfter).toBe(eventCountBefore);
    });

    it("respects AbortSignal cancellation and safely aborts active actuation", async () => {
      await adapter.connect();
      const controller = new AbortController();
      controller.abort();

      const descriptor = adapter.getDescriptor();
      const stressTestCap = descriptor.capabilities.find(
        (c) => c.name === "run_relay_stress_test"
      );

      if (stressTestCap) {
        const promise = adapter.executeCapability(
          stressTestCap.name,
          { cycles: 5, durationMs: 100 },
          controller.signal
        );
        await expect(promise).rejects.toThrow(/aborted/i);
      }
    });
  });
}
