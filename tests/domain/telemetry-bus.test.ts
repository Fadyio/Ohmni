/**
 * Slice 3B: TelemetryEventBus Unit Tests.
 */

import { describe, it, expect, beforeEach, spyOn } from "bun:test";
import { TelemetryEventBus } from "@/domain/telemetry/bus";
import type { DeviceEvent, VoltageSampleEvent, ResetEvent } from "@/domain/device/events";

describe("Slice 3B: TelemetryEventBus", () => {
  let bus: TelemetryEventBus;

  beforeEach(() => {
    bus = new TelemetryEventBus();
  });

  it("delivers published events to subscribers synchronously with correlation ID", () => {
    const received: Array<{ event: DeviceEvent; expId?: string }> = [];
    bus.subscribe((event, expId) => {
      received.push({ event, expId });
    });

    const sampleEvent: VoltageSampleEvent = {
      type: "voltage_sample",
      timestamp: 1000,
      voltage: 3.3,
      unit: "V",
    };

    bus.publish(sampleEvent, "exp_123");

    expect(received.length).toBe(1);
    expect(received[0].event).toEqual(sampleEvent);
    expect(received[0].expId).toBe("exp_123");
  });

  it("delivers identical ordered events to multiple subscribers", () => {
    const sub1Events: string[] = [];
    const sub2Events: string[] = [];

    bus.subscribe((e) => sub1Events.push(e.type));
    bus.subscribe((e) => sub2Events.push(e.type));

    const e1: VoltageSampleEvent = { type: "voltage_sample", timestamp: 1, voltage: 3.3, unit: "V" };
    const e2: ResetEvent = { type: "reset", timestamp: 2, reason: "BROWNOUT" };

    bus.publish(e1);
    bus.publish(e2);

    expect(sub1Events).toEqual(["voltage_sample", "reset"]);
    expect(sub2Events).toEqual(["voltage_sample", "reset"]);
  });

  it("unsubscribe stops delivery and is idempotent without leaking listeners", () => {
    expect(bus.subscriberCount()).toBe(0);

    const received: DeviceEvent[] = [];
    const unsubscribe = bus.subscribe((e) => received.push(e));

    expect(bus.subscriberCount()).toBe(1);

    const e1: VoltageSampleEvent = { type: "voltage_sample", timestamp: 1, voltage: 3.3, unit: "V" };
    bus.publish(e1);
    expect(received.length).toBe(1);

    // First unsubscribe
    unsubscribe();
    expect(bus.subscriberCount()).toBe(0);

    // Second idempotent unsubscribe call
    unsubscribe();
    expect(bus.subscriberCount()).toBe(0);

    const e2: VoltageSampleEvent = { type: "voltage_sample", timestamp: 2, voltage: 3.2, unit: "V" };
    bus.publish(e2);
    expect(received.length).toBe(1); // No new event received
  });

  it("isolates subscriber errors so one throwing subscriber does not break others", () => {
    const warnSpy = spyOn(console, "warn").mockImplementation(() => {});

    const sub1Events: string[] = [];
    const sub3Events: string[] = [];

    // Sub 1: normal
    bus.subscribe((e) => sub1Events.push(e.type));

    // Sub 2: throws
    bus.subscribe(() => {
      throw new Error("Visualizer crashed!");
    });

    // Sub 3: normal
    bus.subscribe((e) => sub3Events.push(e.type));

    const sample: VoltageSampleEvent = { type: "voltage_sample", timestamp: 1, voltage: 3.3, unit: "V" };

    // Publishing should not throw
    expect(() => bus.publish(sample)).not.toThrow();

    expect(sub1Events).toEqual(["voltage_sample"]);
    expect(sub3Events).toEqual(["voltage_sample"]);

    warnSpy.mockRestore();
  });

  it("handles unsubscription during dispatch cleanly", () => {
    const received: string[] = [];

    let unsubscribe2: () => void = () => {};

    bus.subscribe((e) => {
      received.push(`sub1:${e.type}`);
      // Sub 1 unregisters sub 2 mid-dispatch
      unsubscribe2();
    });

    unsubscribe2 = bus.subscribe((e) => {
      received.push(`sub2:${e.type}`);
    });

    const sample: VoltageSampleEvent = { type: "voltage_sample", timestamp: 1, voltage: 3.3, unit: "V" };
    bus.publish(sample);

    // Sub 2 was removed by sub 1 before its turn, so sub2 should not have received the event
    expect(received).toEqual(["sub1:voltage_sample"]);
    expect(bus.subscriberCount()).toBe(1);
  });
});
