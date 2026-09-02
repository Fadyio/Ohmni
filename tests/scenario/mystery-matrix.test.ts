import { describe, expect, it, beforeEach } from "bun:test";
import { VirtualDeviceAdapter } from "../../src/domain/device/virtual-adapter";
import { CapabilityRegistry } from "../../src/infrastructure/webmcp/capability-registry";
import { InMemoryModelContext } from "../../src/infrastructure/webmcp/in-memory-model-context";
import { DeviceToolRegistrar } from "../../src/infrastructure/webmcp/device-tool-registrar";
import { ExperimentRunner } from "../../src/domain/experiment/runner";
import { InMemoryExperimentStore } from "../../src/domain/experiment/store";
import { TelemetryEventBus } from "../../src/domain/telemetry/bus";
import { registerEvidenceTools } from "../../src/infrastructure/webmcp/evidence-tools";
import { registerHypothesisTools } from "../../src/infrastructure/webmcp/hypothesis-tools";
import { InMemoryHypothesisStore } from "../../src/domain/hypothesis/store";
import {
  createScenarioSession,
  matchDiagnosis,
  SCENARIOS,
} from "../../src/domain/scenario";
import { createHumanObservation } from "../../src/domain/evidence/store";

describe("Phase 13 — Mystery Fault Test Matrix (Deterministic Test Agent)", () => {
  let modelContext: InMemoryModelContext;
  let eventBus: TelemetryEventBus;
  let experimentStore: InMemoryExperimentStore;
  let runner: ExperimentRunner;
  let hypothesisStore: InMemoryHypothesisStore;

  beforeEach(() => {
    eventBus = new TelemetryEventBus();
    experimentStore = new InMemoryExperimentStore();
    runner = new ExperimentRunner({ eventBus, store: experimentStore });
    const evidenceStore = runner.getEvidenceStore();
    hypothesisStore = new InMemoryHypothesisStore(evidenceStore);
    modelContext = new InMemoryModelContext();
  });
  // Helper to execute a tool via WebMCP document.modelContext
  async function callTool(name: string, args: Record<string, unknown> = {}): Promise<Record<string, unknown>> {
    const tools = await modelContext.getTools();
    const tool = tools.find((t) => t.name === name);
    if (!tool) {
      throw new Error(`Tool not found: ${name}`);
    }
    const resultStr = await modelContext.executeTool(tool, args);
    try {
      return JSON.parse(resultStr);
    } catch {
      return { raw: resultStr };
    }
  }
  it("Scenario A: Relay Supply Brownout — Full Blind Investigation & Verification Loop", async () => {
    const session = createScenarioSession({ scenarioId: "brownout" });
    const adapter = new VirtualDeviceAdapter(session.getInitialDeviceConfig());
    await adapter.connect();

    const registry = new CapabilityRegistry(runner);
    const registrar = new DeviceToolRegistrar(modelContext, registry);
    await registrar.registerDevice(adapter);

    const evidenceStore = runner.getEvidenceStore();
    await registerEvidenceTools(modelContext, evidenceStore);
    await registerHypothesisTools(modelContext, hypothesisStore);

    // 1. Initial State: Sealed Ground Truth
    expect(session.isSealed).toBe(true);
    expect(session.isVerified).toBe(false);
    expect(() => session.revealGroundTruth()).toThrow();

    // 2. Observable Investigation: Read Reset History & Measure Voltage
    const resetHistory = await callTool("read_reset_history");
    expect(resetHistory.resets).toBeDefined();
    expect(resetHistory.count).toBeGreaterThan(0);

    const voltageIdle = await callTool("measure_supply_voltage", { samples: 5 });
    expect(voltageIdle.voltage).toBeGreaterThan(3.2);

    // 3. Controlled Physical Stress Test (Reproduce Brownout)
    const stress1 = await callTool("run_relay_stress_test", { cycles: 3, durationMs: 50 });
    expect(stress1.faultReproduced).toBe(true);
    expect(stress1.resetOccurred).toBe(true);
    expect(stress1.resetReason).toBe("BROWNOUT");
    expect(stress1.minVoltage).toBeLessThan(2.80);

    // 4. Propose Hypothesis
    const hyp = await callTool("propose_hypothesis", {
      title: "Relay-induced MCU supply brownout due to shared 3.3V rail",
      description: "Actuating the fan relay pulls excessive inrush current on the shared 3.3V rail, dropping MCU voltage below 2.80V and causing brownout resets.",
      confidence: "MEDIUM",
    });
    expect((hyp.hypothesis as { id: string }).id).toBeDefined();

    // 5. Request Human Intervention
    const interventionPoint = session.allowedInterventionPoints.find((p) => p.id === "relay_power_jumper");
    expect(interventionPoint).toBeDefined();
    expect(interventionPoint?.targetState).toBe("5v");

    // Human performs physical intervention
    adapter.setInterventionPoint("relay_power_jumper", "5v");

    // Record human observation
    evidenceStore.addHumanObservation({
      summary: "Human technician moved relay supply jumper JP1 from shared 3.3V to external 5V auxiliary rail.",
      interventionPointId: "relay_power_jumper",
      data: { position: "5v" },
    });

    // 6. Post-Intervention Experimental Retest (Verification)
    const stress2 = await callTool("run_relay_stress_test", { cycles: 3, durationMs: 50 });
    expect(stress2.faultReproduced).toBe(false);
    expect(stress2.resetOccurred).toBe(false);
    expect(stress2.minVoltage).toBeGreaterThanOrEqual(2.80);

    // 7. Verify Criteria and Unlock Ground Truth
    const criteria = session.getVerificationCriteria();
    const passes = criteria.validateResult(stress2);
    expect(passes).toBe(true);

    session.markVerified();
    expect(session.isVerified).toBe(true);

    // 8. Final Reveal & Semantic Diagnosis Match
    const revealed = session.revealGroundTruth();
    expect(revealed.id).toBe("brownout");
    expect(revealed.rootCauseCategory).toBe("supply_brownout");

    const match = matchDiagnosis(
      revealed,
      "Relay-induced MCU supply brownout due to shared 3.3V rail",
      "Actuating relay drops rail below brownout threshold",
      "supply_brownout"
    );
    expect(match.isMatch).toBe(true);
    expect(match.score).toBeGreaterThan(0.5);
  });

  it("Scenario B: I2C Address Mismatch — Full Blind Investigation & Verification Loop", async () => {
    const session = createScenarioSession({ scenarioId: "i2c_address" });
    const adapter = new VirtualDeviceAdapter(session.getInitialDeviceConfig());
    await adapter.connect();

    const registry = new CapabilityRegistry(runner);
    const registrar = new DeviceToolRegistrar(modelContext, registry);
    await registrar.registerDevice(adapter);

    const evidenceStore = runner.getEvidenceStore();
    await registerEvidenceTools(modelContext, evidenceStore);
    await registerHypothesisTools(modelContext, hypothesisStore);

    // 1. Initial State: Sealed Ground Truth
    expect(session.isSealed).toBe(true);

    // 2. Observable Investigation: Read Sensor Status & Bus Scan
    const sensorStatus1 = await callTool("read_sensor_status");
    expect(sensorStatus1.transactionStatus).toBe("NACK");
    expect(sensorStatus1.configuredTargetAddress).toBe("0x76");

    const busScan1 = await callTool("scan_i2c_bus");
    expect(busScan1.devices).toEqual(["0x77"]);
    expect(busScan1.count).toBe(1);

    // 3. Propose Hypothesis
    const hyp = await callTool("propose_hypothesis", {
      title: "I2C target address mismatch: Sensor configured at 0x77 while firmware polls 0x76",
      description: "The hardware bus scan demonstrates an active device acknowledging at 0x77, but the firmware status registers reveal transactions are targeting 0x76, returning NACK.",
      confidence: "MEDIUM",
    });
    expect((hyp.hypothesis as { id: string }).id).toBeDefined();

    // 4. Request Human Intervention
    const interventionPoint = session.allowedInterventionPoints.find((p) => p.id === "sensor_address_selector");
    expect(interventionPoint).toBeDefined();
    expect(interventionPoint?.targetState).toBe("0x76");

    // Human changes address selector switch to 0x76
    adapter.setInterventionPoint("sensor_address_selector", "0x76");

    // Record human observation
    evidenceStore.addHumanObservation({
      summary: "Human technician switched sensor DIP address selector from 0x77 to 0x76.",
      interventionPointId: "sensor_address_selector",
      data: { address: "0x76" },
    });

    // 5. Post-Intervention Retest
    const sensorStatus2 = await callTool("read_sensor_status");
    expect(sensorStatus2.transactionStatus).toBe("ACK");
    expect(sensorStatus2.temperatureC).toBe(24.2);
    expect(sensorStatus2.humidityPct).toBe(48.5);

    const busScan2 = await callTool("scan_i2c_bus");
    expect(busScan2.devices).toEqual(["0x76"]);

    // 6. Verify Criteria and Unlock Ground Truth
    const criteria = session.getVerificationCriteria();
    const passes = criteria.validateResult(sensorStatus2);
    expect(passes).toBe(true);

    session.markVerified();
    const revealed = session.revealGroundTruth();
    expect(revealed.id).toBe("i2c_address");

    const match = matchDiagnosis(
      revealed,
      "I2C target address mismatch: Sensor configured at 0x77 while firmware polls 0x76",
      "Address mismatch causes NACK",
      "i2c_address_mismatch"
    );
    expect(match.isMatch).toBe(true);
  });

  it("Scenario C: Physical SDA Connection Fault — Full Blind Investigation & Verification Loop", async () => {
    const session = createScenarioSession({ scenarioId: "sda_fault" });
    const adapter = new VirtualDeviceAdapter(session.getInitialDeviceConfig());
    await adapter.connect();

    const registry = new CapabilityRegistry(runner);
    const registrar = new DeviceToolRegistrar(modelContext, registry);
    await registrar.registerDevice(adapter);

    const evidenceStore = runner.getEvidenceStore();
    await registerEvidenceTools(modelContext, evidenceStore);
    await registerHypothesisTools(modelContext, hypothesisStore);

    // 1. Initial State: Sealed Ground Truth
    expect(session.isSealed).toBe(true);

    // 2. Observable Investigation: Bus Scan, Line State, Sensor Status
    const busScan1 = await callTool("scan_i2c_bus");
    expect(busScan1.count).toBe(0);
    expect(busScan1.busStatus).toBe("NO_RESPONSE");

    const lineState1 = await callTool("read_i2c_line_state");
    expect(lineState1.scl).toBe("HIGH");
    expect(lineState1.sda).toBe("FLOATING");

    const sensorStatus1 = await callTool("read_sensor_status");
    expect(sensorStatus1.transactionStatus).toBe("BUS_ERROR");

    // 3. Propose Hypothesis
    const hyp = await callTool("propose_hypothesis", {
      title: "Physical SDA data line open contact fault",
      description: "I2C line state analysis indicates SDA is floating while SCL is pulled high. Zero devices respond on bus scan, pointing to physical disconnection.",
      confidence: "MEDIUM",
    });
    expect((hyp.hypothesis as { id: string }).id).toBeDefined();

    // 4. Request Human Intervention
    const interventionPoint = session.allowedInterventionPoints.find((p) => p.id === "sda_connection");
    expect(interventionPoint).toBeDefined();
    expect(interventionPoint?.targetState).toBe("connected");

    // Human reseats SDA connector
    adapter.setInterventionPoint("sda_connection", "connected");

    evidenceStore.addHumanObservation({
      summary: "Human technician reseated the physical SDA connector wire onto pin 21.",
      interventionPointId: "sda_connection",
      data: { status: "connected" },
    });

    // 5. Post-Intervention Retest
    const lineState2 = await callTool("read_i2c_line_state");
    expect(lineState2.scl).toBe("HIGH");
    expect(lineState2.sda).toBe("HIGH");

    const busScan2 = await callTool("scan_i2c_bus");
    expect(busScan2.count).toBe(1);
    expect(busScan2.devices).toEqual(["0x76"]);

    const sensorStatus2 = await callTool("read_sensor_status");
    expect(sensorStatus2.transactionStatus).toBe("ACK");

    // 6. Verify Criteria and Unlock Ground Truth
    const criteria = session.getVerificationCriteria();
    const passes = criteria.validateResult(busScan2);
    expect(passes).toBe(true);

    session.markVerified();
    const revealed = session.revealGroundTruth();
    expect(revealed.id).toBe("sda_fault");

    const match = matchDiagnosis(
      revealed,
      "Physical SDA data line open contact fault",
      "SDA disconnection prevented communication",
      revealed.rootCauseCategory
    );
    expect(match.isMatch).toBe(true);
  });
});
