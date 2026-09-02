/**
 * PERMANENT GOLDEN-PATH REGRESSION TEST — MILESTONE 5
 *
 * Immutable Evidence Ledger & WebMCP Evidence Verification.
 *
 * Verifies:
 * 1. WebMCP experiment execution automatically produces immutable factual evidence.
 * 2. Facts include exact measurements and events (BROWNOUT, 2.72V, 0.59V drop, cycle 1 reset).
 * 3. Facts strictly exclude causal interpretation, hypotheses, or repair advice.
 * 4. Evidence is discoverable and inspectable through WebMCP (list_evidence, get_evidence).
 * 5. Evidence is completely immutable (deep freeze, no mutation tools on WebMCP).
 * 6. Provenance distinctions (device vs human) are strictly preserved.
 * 7. Aborted experiments preserve partial factual records with explicit status.
 */

import { describe, it, expect, beforeEach } from "bun:test";
import { VirtualDeviceAdapter } from "@/domain/device/virtual-adapter";
import { InMemoryModelContext } from "@/infrastructure/webmcp/in-memory-model-context";
import { CapabilityRegistry } from "@/infrastructure/webmcp/capability-registry";
import { DeviceToolRegistrar } from "@/infrastructure/webmcp/device-tool-registrar";
import { TelemetryEventBus } from "@/domain/telemetry/bus";
import { InMemoryExperimentStore } from "@/domain/experiment/store";
import { ExperimentRunner } from "@/domain/experiment/runner";
import { InMemoryEvidenceStore, createHumanObservation } from "@/domain/evidence/store";
import { registerEvidenceTools } from "@/infrastructure/webmcp/evidence-tools";
import type { RegisteredTool } from "@/infrastructure/webmcp/types";

describe("Milestone 5 Golden Path — Immutable Evidence Ledger", () => {
  let modelContext: InMemoryModelContext;
  let telemetryBus: TelemetryEventBus;
  let experimentStore: InMemoryExperimentStore;
  let evidenceStore: InMemoryEvidenceStore;
  let experimentRunner: ExperimentRunner;
  let virtualDevice: VirtualDeviceAdapter;
  let capabilityRegistry: CapabilityRegistry;
  let toolRegistrar: DeviceToolRegistrar;

  beforeEach(async () => {
    modelContext = new InMemoryModelContext();
    telemetryBus = new TelemetryEventBus();
    experimentStore = new InMemoryExperimentStore();
    evidenceStore = new InMemoryEvidenceStore();

    experimentRunner = new ExperimentRunner({
      eventBus: telemetryBus,
      store: experimentStore,
      evidenceStore: evidenceStore,
    });

    virtualDevice = new VirtualDeviceAdapter();
    capabilityRegistry = new CapabilityRegistry(experimentRunner);
    toolRegistrar = new DeviceToolRegistrar(modelContext, capabilityRegistry);

    // Register evidence inspection tools
    await registerEvidenceTools(modelContext, evidenceStore);
  });

  it("1. WebMCP experiment automatically produces immutable factual evidence without manual logging", async () => {
    await virtualDevice.connect();
    await toolRegistrar.registerDevice(virtualDevice);

    const tools = await modelContext.getTools();
    const stressTool = tools.find((t) => t.name === "run_relay_stress_test")!;
    expect(stressTool).toBeDefined();

    // Execute relay stress test via WebMCP modelContext
    const summaryRaw = await modelContext.executeTool(stressTool, {
      cycles: 3,
      duration_ms: 50,
    });
    const summary = JSON.parse(summaryRaw);
    const experimentId = summary.experiment_id;
    expect(experimentId).toBeDefined();
    expect(experimentId.startsWith("exp_")).toBe(true);

    // Query EvidenceStore directly
    const storedEvidence = evidenceStore.getByExperiment(experimentId);
    expect(storedEvidence.length).toBeGreaterThanOrEqual(4);

    // Assert specific factual observations
    const resetFact = storedEvidence.find((e) => e.type === "reset_event");
    expect(resetFact).toBeDefined();
    expect(resetFact?.summary).toContain("BROWNOUT");

    const minVFact = storedEvidence.find(
      (e) => e.type === "measurement" && e.summary.includes("Minimum MCU supply")
    );
    expect(minVFact).toBeDefined();
    expect(minVFact?.summary).toContain("2.72 V");

    const dropFact = storedEvidence.find(
      (e) => e.type === "measurement" && e.summary.includes("Supply drop")
    );
    expect(dropFact).toBeDefined();
    expect(dropFact?.summary).toContain("0.59 V");

    const cycleFact = storedEvidence.find((e) => e.type === "test_result");
    expect(cycleFact).toBeDefined();
    expect(cycleFact?.summary).toContain("cycle 1");
    expect(cycleFact?.summary).toContain("3");

    // Strict invariant: NO causal interpretations or diagnostic conclusions
    const forbiddenInterpretations = [
      "caused",
      "bad jumper",
      "wrong wiring",
      "move jumper",
      "power instability",
      "root cause",
      "fix",
      "hypothesis",
      "confidence",
      "conclusion",
    ];

    for (const record of storedEvidence) {
      const lower = record.summary.toLowerCase();
      for (const phrase of forbiddenInterpretations) {
        expect(lower).not.toContain(phrase);
      }
    }

    // Query evidence through WebMCP list_evidence
    const listEvidenceTool = tools.find((t) => t.name === "list_evidence")!;
    expect(listEvidenceTool).toBeDefined();

    const mcpListRaw = await modelContext.executeTool(listEvidenceTool, {
      experiment_id: experimentId,
    });
    const mcpList = JSON.parse(mcpListRaw);
    expect(mcpList.length).toBe(storedEvidence.length);
    expect(mcpList.map((e: { id: string }) => e.id)).toEqual(storedEvidence.map((e) => e.id));

    // Query individual evidence record through WebMCP get_evidence
    const getEvidenceTool = tools.find((t) => t.name === "get_evidence")!;
    expect(getEvidenceTool).toBeDefined();

    const firstEvidenceId = storedEvidence[0].id;
    const mcpGetRaw = await modelContext.executeTool(getEvidenceTool, {
      evidence_id: firstEvidenceId,
    });
    const mcpRecord = JSON.parse(mcpGetRaw);
    expect(mcpRecord.id).toBe(firstEvidenceId);
    expect(mcpRecord.summary).toBe(storedEvidence[0].summary);
  });

  it("2. Immutability Regression: Canonical records cannot be mutated and no WebMCP mutation tools exist", async () => {
    await virtualDevice.connect();
    await toolRegistrar.registerDevice(virtualDevice);

    const record = evidenceStore.createAndAdd({
      type: "measurement",
      summary: "Canonical supply voltage: 3.31 V",
      source: "device",
      data: { v: 3.31, nested: { status: "valid" } },
      provenance: { origin: "virtual_device" },
    });

    // 1. Runtime mutation fails due to deep freeze
    expect(() => {
      // @ts-expect-error
      record.summary = "Hacked summary";
    }).toThrow();

    expect(() => {
      (record.data as any).nested.status = "corrupted";
    }).toThrow();
    // 2. Store get returns untouched canonical record
    const retrieved = evidenceStore.get(record.id)!;
    expect(retrieved.summary).toBe("Canonical supply voltage: 3.31 V");
    expect((retrieved.data as { nested: { status: string } }).nested.status).toBe("valid");

    // 3. Duplicate ID insertion throws error
    expect(() => {
      evidenceStore.add({
        id: record.id,
        type: "measurement",
        summary: "Attempted overwrite",
        createdAt: Date.now(),
        source: "device",
        data: {},
        provenance: { origin: "virtual_device" },
      });
    }).toThrow(/already exists/i);

    // 4. WebMCP surface contains ZERO creation/mutation tools
    const tools = await modelContext.getTools();
    const toolNames = tools.map((t) => t.name);

    expect(toolNames).not.toContain("create_evidence");
    expect(toolNames).not.toContain("edit_evidence");
    expect(toolNames).not.toContain("update_evidence");
    expect(toolNames).not.toContain("delete_evidence");
    expect(toolNames).not.toContain("log_evidence");
  });

  it("3. Provenance Regression: Strict distinction between device instrument facts and human observations", async () => {
    // 1. Record device evidence
    const deviceRecord = evidenceStore.createAndAdd({
      type: "measurement",
      summary: "Minimum supply: 2.72 V",
      source: "device",
      data: { voltage_v: 2.72 },
      provenance: {
        origin: "virtual_device",
        capability: "run_relay_stress_test",
      },
    });

    // 2. Record human observation
    const humanRecord = evidenceStore.addHumanObservation({
      summary: "Relay VCC connected to 3.3V jumper pin",
      data: { jumper: "3V3" },
      notes: "Verified visually on bench board",
    });

    expect(deviceRecord.source).toBe("device");
    expect(deviceRecord.provenance.origin).toBe("virtual_device");

    expect(humanRecord.source).toBe("human");
    expect(humanRecord.provenance.origin).toBe("human");
    expect(humanRecord.type).toBe("human_observation");

    // Query via list_evidence WebMCP
    const tools = await modelContext.getTools();
    const listTool = tools.find((t) => t.name === "list_evidence")!;

    const resultRaw = await modelContext.executeTool(listTool);
    const result = JSON.parse(resultRaw);

    const devResult = result.find((e: { id: string }) => e.id === deviceRecord.id);
    const humanResult = result.find((e: { id: string }) => e.id === humanRecord.id);

    expect(devResult.source).toBe("device");
    expect(devResult.provenance.origin).toBe("virtual_device");

    expect(humanResult.source).toBe("human");
    expect(humanResult.provenance.origin).toBe("human");
  });

  it("4. Abort Regression: Aborted experiment retains partial records without claiming test success", async () => {
    await virtualDevice.connect();
    await toolRegistrar.registerDevice(virtualDevice);

    // Set jumper to 5V to allow longer execution for abort test
    virtualDevice.setInterventionPoint("relay_power_jumper", "5v");

    const controller = new AbortController();
    setTimeout(() => controller.abort(), 20);

    const tools = await modelContext.getTools();
    const stressTool = tools.find((t) => t.name === "run_relay_stress_test")!;

    // Executing tool with abort signal
    const promise = modelContext.executeTool(
      stressTool,
      { cycles: 10, duration_ms: 100 },
      { signal: controller.signal }
    );

    await expect(promise).rejects.toThrow(/aborted/i);

    // Check ExperimentRecord in ExperimentStore
    const latestExp = experimentStore.latest();
    expect(latestExp).toBeDefined();
    expect(latestExp?.metadata.status).toBe("aborted");

    // Check partial evidence in EvidenceStore
    const expEvidence = evidenceStore.getByExperiment(latestExp?.metadata.id ?? "");
    expect(expEvidence.length).toBeGreaterThan(0);

    const abortFact = expEvidence.find((e) => e.summary.toLowerCase().includes("aborted"));
    expect(abortFact).toBeDefined();
    expect(abortFact?.provenance.experimentStatus).toBe("aborted");

    // Assert NO claim that test completed successfully
    for (const record of expEvidence) {
      expect(record.summary.toLowerCase()).not.toContain("completed without resets");
      expect(record.summary.toLowerCase()).not.toContain("10 of 10");
    }
  });
});
