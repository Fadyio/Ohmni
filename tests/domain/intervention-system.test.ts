import { describe, expect, it, beforeEach } from "bun:test";
import { VirtualDeviceAdapter } from "../../src/domain/device/virtual-adapter";
import { InMemoryEvidenceStore } from "../../src/domain/evidence/store";
import { InMemoryHypothesisStore } from "../../src/domain/hypothesis/store";
import {
  InterventionStore,
  DEFAULT_INTERVENTION_POINTS,
  type HumanInterventionRequest,
} from "../../src/domain/intervention";

describe("Human Physical Intervention System & Observation Invariants (Phase 4)", () => {
  let adapter: VirtualDeviceAdapter;
  let evidenceStore: InMemoryEvidenceStore;
  let hypothesisStore: InMemoryHypothesisStore;
  let interventionStore: InterventionStore;

  beforeEach(async () => {
    adapter = new VirtualDeviceAdapter({
      initialRelayPower: "3v3",
      initialSensorAddress: "0x77",
      firmwareTargetAddress: "0x76",
      initialSdaConnected: false,
    });
    await adapter.connect();

    evidenceStore = new InMemoryEvidenceStore();
    hypothesisStore = new InMemoryHypothesisStore(evidenceStore);
    interventionStore = new InterventionStore();
  });

  it("exposes the 3 first-class intervention points with clear options", () => {
    const points = interventionStore.getPoints();
    expect(points.length).toBe(3);

    const pointIds = points.map((p) => p.id);
    expect(pointIds).toContain("relay_power_jumper");
    expect(pointIds).toContain("sensor_address_selector");
    expect(pointIds).toContain("sda_connection");

    const jp1 = interventionStore.getPoint("relay_power_jumper");
    expect(jp1).toBeDefined();
    expect(jp1?.possibleStates.map((s) => s.value)).toEqual(["3v3", "5v"]);

    const sw1 = interventionStore.getPoint("sensor_address_selector");
    expect(sw1).toBeDefined();
    expect(sw1?.possibleStates.map((s) => s.value)).toEqual(["0x76", "0x77"]);

    const j2 = interventionStore.getPoint("sda_connection");
    expect(j2).toBeDefined();
    expect(j2?.possibleStates.map((s) => s.value)).toEqual(["unseated", "connected"]);
  });

  it("handles agent intervention requests and maintains active request state", () => {
    expect(interventionStore.getActiveRequest()).toBeNull();

    const request: HumanInterventionRequest = {
      target: "relay_power_jumper",
      instruction: "Move jumper JP1 from 3.3V to 5V external rail.",
      rationale: "Isolate relay coil inrush current to prevent brownout reset.",
      evidenceIds: ["E-001", "E-002"],
      requestedAt: Date.now(),
    };

    interventionStore.setActiveRequest(request);
    expect(interventionStore.getActiveRequest()).toEqual(request);
  });

  it("applies intervention, mutates DeviceAdapter, appends immutable Human Evidence, and clears request", () => {
    const request: HumanInterventionRequest = {
      target: "relay_power_jumper",
      instruction: "Move JP1 to 5V",
      rationale: "Isolate coil load",
      requestedAt: Date.now(),
    };
    interventionStore.setActiveRequest(request);

    // Initial state check on adapter
    expect(adapter.getInterventionPoint("relay_power_jumper")).toBe("3v3");

    // Apply human intervention
    const { observation, evidence } = interventionStore.applyIntervention(
      "relay_power_jumper",
      "5v",
      {
        adapter,
        evidenceStore,
      }
    );

    // 1. Hardware state updated
    expect(adapter.getInterventionPoint("relay_power_jumper")).toBe("5v");

    // 2. Active request cleared
    expect(interventionStore.getActiveRequest()).toBeNull();

    // 3. Human Observation Record recorded in history
    expect(observation.interventionPointId).toBe("relay_power_jumper");
    expect(observation.previousState).toBe("3v3");
    expect(observation.newState).toBe("5v");
    expect(interventionStore.getHistory()).toHaveLength(1);

    // 4. Immutable Human Evidence created with provenance: "human"
    expect(evidence).toBeDefined();
    expect(evidence?.source).toBe("human");
    expect(evidence?.type).toBe("human_observation");
    expect(evidence?.provenance.origin).toBe("human");
    expect(evidence?.summary).toContain("Relay Power Source (JP1)");
    expect(evidenceStore.count()).toBe(1);

    // 5. Continuation prompt encourages empirical verification, never claiming fix automatically
    const continuation = interventionStore.createContinuationPrompt(observation);
    expect(continuation).toContain("A reported physical intervention is not proof that the fault is fixed.");
    expect(continuation).toContain("verify the repair experimentally");
  });

  it("applies I2C address selector intervention correctly to hardware", async () => {
    // Ensure SDA line is connected so bus can transfer bytes
    adapter.setInterventionPoint("sda_connection", "connected");

    // Before intervention: sensor at 0x77, firmware at 0x76 -> NACK
    const beforeResult = await adapter.executeCapability<{ transactionStatus: string }>("read_sensor_status");
    expect(beforeResult.data.transactionStatus).toBe("NACK");

    // Human toggles address switch to 0x76
    interventionStore.applyIntervention("sensor_address_selector", "0x76", {
      adapter,
      evidenceStore,
    });

    // After intervention: sensor at 0x76 -> ACK
    const afterResult = await adapter.executeCapability<{ transactionStatus: string }>("read_sensor_status");
    expect(afterResult.data.transactionStatus).toBe("ACK");
  });

  it("applies SDA line connection intervention correctly to hardware", async () => {
    // Before intervention: SDA unseated -> scan returns 0 devices
    const beforeResult = await adapter.executeCapability<{ count: number }>("scan_i2c_bus");
    expect(beforeResult.data.count).toBe(0);

    // Human reseats SDA connector header
    interventionStore.applyIntervention("sda_connection", "connected", {
      adapter,
      evidenceStore,
    });

    // After intervention: SDA connected -> scan finds sensor
    const afterResult = await adapter.executeCapability<{ count: number }>("scan_i2c_bus");
    expect(afterResult.data.count).toBe(1);
  });
});
