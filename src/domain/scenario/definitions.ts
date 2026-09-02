/**
 * Canonical Mystery Fault Scenarios.
 * Master Milestone 8 — Exactly Three High-Quality Blind Scenarios.
 */

import type { ScenarioDefinition, ScenarioId } from "./types";

export const SCENARIO_BROWNOUT: ScenarioDefinition = {
  id: "brownout",
  publicSymptom: "The controller restarts unexpectedly whenever the cooling fan relay turns on.",
  deviceModel: "ESP32-S3 Environmental Controller",
  allowedInterventionPoints: [
    {
      id: "relay_power_jumper",
      label: "Relay Power Source (JP1)",
      description: "Selects whether the relay coil is energized from the shared 3.3V MCU rail or an isolated 5V external rail.",
      allowedStates: ["3v3", "5v"],
      initialState: "3v3",
      targetState: "5v",
    },
  ],
  initialDeviceConfig: {
    initialRelayPower: "3v3",
    nominalVoltage: 3.30,
    brownoutThreshold: 2.80,
    initialSensorAddress: "0x76",
    firmwareTargetAddress: "0x76",
    initialSdaConnected: true,
  },
  groundTruth: {
    id: "brownout",
    title: "Relay Supply Misconfiguration",
    hiddenFaultDescription: "Relay coil is wired to the shared 3.3V MCU rail. Coil inrush current sags voltage to 2.72V, triggering a hardware brownout reset.",
    expectedDiagnosis: "Relay-induced MCU supply rail brownout reset",
    rootCauseCategory: "supply_brownout",
    expectedRootCauseTags: ["relay_power_shared_rail", "supply_brownout", "voltage_sag"],
    targetIntervention: {
      point: "relay_power_jumper",
      value: "5v",
    },
  },
  verificationCriteria: {
    requiredTool: "run_relay_stress_test",
    description: "Re-run relay stress test to verify MCU rail remains stable >= 2.80V without reset.",
    validateResult: (data: Record<string, unknown>) => {
      const resetOccurred = data.resetOccurred === true;
      const minVoltage = typeof data.minVoltage === "number" ? data.minVoltage : 0;
      return !resetOccurred && minVoltage >= 2.80;
    },
  },
};

export const SCENARIO_I2C_ADDRESS: ScenarioDefinition = {
  id: "i2c_address",
  publicSymptom: "The environmental sensor is not reporting telemetry data; transactions return NACK.",
  deviceModel: "ESP32-S3 Environmental Controller",
  allowedInterventionPoints: [
    {
      id: "sensor_address_selector",
      label: "Sensor Address Selector (SW1 / SDO Pin)",
      description: "Hardware jumper/switch configuring sensor I2C address between 0x76 and 0x77.",
      allowedStates: ["0x76", "0x77"],
      initialState: "0x77",
      targetState: "0x76",
    },
  ],
  initialDeviceConfig: {
    initialRelayPower: "5v",
    nominalVoltage: 3.30,
    brownoutThreshold: 2.80,
    initialSensorAddress: "0x77",
    firmwareTargetAddress: "0x76",
    initialSdaConnected: true,
  },
  groundTruth: {
    id: "i2c_address",
    title: "I2C Peripheral Address Mismatch",
    hiddenFaultDescription: "Hardware address selector is strapped to 0x77 (SDO high), while MCU firmware is configured to poll 0x76.",
    expectedDiagnosis: "I2C bus address mismatch (sensor at 0x77, firmware polling 0x76)",
    rootCauseCategory: "i2c_address_mismatch",
    expectedRootCauseTags: ["i2c_address_mismatch", "nack_on_read", "wrong_target_address"],
    targetIntervention: {
      point: "sensor_address_selector",
      value: "0x76",
    },
  },
  verificationCriteria: {
    requiredTool: "read_sensor_status",
    description: "Query sensor status to verify valid telemetry data and ACK transaction status.",
    validateResult: (data: Record<string, unknown>) => {
      return data.transactionStatus === "ACK" && typeof data.temperatureC === "number";
    },
  },
};

export const SCENARIO_SDA_FAULT: ScenarioDefinition = {
  id: "sda_fault",
  publicSymptom: "The environmental sensor intermittently disappears from the I2C bus; bus scan returns 0 devices.",
  deviceModel: "ESP32-S3 Environmental Controller",
  allowedInterventionPoints: [
    {
      id: "sda_connection",
      label: "I2C SDA Connector Header (J2)",
      description: "Physical jumper cable connecting MCU GPIO 8 (SDA) to sensor breakout board.",
      allowedStates: ["unseated", "connected"],
      initialState: "unseated",
      targetState: "connected",
    },
  ],
  initialDeviceConfig: {
    initialRelayPower: "5v",
    nominalVoltage: 3.30,
    brownoutThreshold: 2.80,
    initialSensorAddress: "0x76",
    firmwareTargetAddress: "0x76",
    initialSdaConnected: false,
  },
  groundTruth: {
    id: "sda_fault",
    title: "Physical SDA Line Open Fault",
    hiddenFaultDescription: "SDA data line connector pin is unseated, leaving SDA bus line floating and unpulled.",
    expectedDiagnosis: "Physical I2C bus SDA open contact / floating data line fault",
    rootCauseCategory: "i2c_physical_open",
    expectedRootCauseTags: ["i2c_sda_open", "bus_floating", "physical_wiring_fault"],
    targetIntervention: {
      point: "sda_connection",
      value: "connected",
    },
  },
  verificationCriteria: {
    requiredTool: "scan_i2c_bus",
    description: "Scan I2C bus to verify SDA is active and sensor responds at 0x76.",
    validateResult: (data: Record<string, unknown>) => {
      const addresses = Array.isArray(data.devices) ? data.devices : [];
      return addresses.includes("0x76");
    },
  },
};

export const SCENARIOS: Readonly<Record<ScenarioId, ScenarioDefinition>> = {
  brownout: SCENARIO_BROWNOUT,
  i2c_address: SCENARIO_I2C_ADDRESS,
  sda_fault: SCENARIO_SDA_FAULT,
};

export const ALL_SCENARIO_IDS: readonly ScenarioId[] = ["brownout", "i2c_address", "sda_fault"];
