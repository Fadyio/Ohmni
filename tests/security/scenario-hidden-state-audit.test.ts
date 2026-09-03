/**
 * Hidden-State Firewall Security Audit.
 * Phase 7 — Comprehensive Agent-Visible Context Audit across Prompts, Schemas & Tool Results.
 *
 * Enforces:
 * 1. ZERO leakage of hidden ground truth in system instructions or initial prompts.
 * 2. ZERO leakage of hidden ground truth in WebMCP tool names, descriptions, or parameters.
 * 3. ZERO leakage of hidden scenario state in pre-investigation tool results (e.g. read_device_info).
 * 4. Specific brownout firewall: No pre-experiment exposure of relayPowerSource, "shared 3.3V",
 *    target 5V repair, or expected diagnosis.
 */

import { describe, expect, it } from "bun:test";
import { VirtualDeviceAdapter } from "@/domain/device/virtual-adapter";
import { CapabilityRegistry } from "@/infrastructure/webmcp/capability-registry";
import { InMemoryModelContext } from "@/infrastructure/webmcp/in-memory-model-context";
import { DeviceToolRegistrar } from "@/infrastructure/webmcp/device-tool-registrar";
import { createHypothesisTools } from "@/infrastructure/webmcp/hypothesis-tools";
import { createEvidenceTools } from "@/infrastructure/webmcp/evidence-tools";
import { InMemoryHypothesisStore } from "@/domain/hypothesis";
import { InMemoryEvidenceStore } from "@/domain/evidence/store";
import {
  SCENARIOS,
  createScenarioSession,
  type ScenarioId,
} from "@/domain/scenario";

export interface AgentVisibleContext {
  readonly initialPrompt: string;
  readonly toolDeclarations: string;
  readonly toolSchemas: string;
  readonly preInvestigationToolResults: Record<string, unknown>;
  readonly serializedEvidence: string;
  readonly humanObservations: string;
  readonly allVisibleText: string;
}

export async function captureAgentVisibleContext(scenarioId: ScenarioId): Promise<AgentVisibleContext> {
  const session = createScenarioSession({ scenarioId });
  const adapter = new VirtualDeviceAdapter(session.getInitialDeviceConfig());
  await adapter.connect();

  const modelContext = new InMemoryModelContext();
  const capabilityRegistry = new CapabilityRegistry();
  const registrar = new DeviceToolRegistrar(modelContext, capabilityRegistry);
  await registrar.registerDevice(adapter);

  const evidenceStore = new InMemoryEvidenceStore();
  const hypothesisStore = new InMemoryHypothesisStore(evidenceStore);

  for (const tool of createHypothesisTools(hypothesisStore)) {
    await modelContext.registerTool(tool);
  }
  for (const tool of createEvidenceTools(evidenceStore)) {
    await modelContext.registerTool(tool);
  }

  const initialPrompt = `${session.publicSymptom} Investigate the root cause using the available WebMCP diagnostic instruments, request physical help when needed, and experimentally verify the repair.`;

  const registeredTools = await modelContext.getTools();
  const toolDeclarations = JSON.stringify(registeredTools.map((t) => ({ name: t.name, description: t.description })));
  const toolSchemas = JSON.stringify(registeredTools.map((t) => ({ name: t.name, inputSchema: t.inputSchema })));

  // Execute ALL pre-investigation observational tools
  const preInvestigationToolResults: Record<string, unknown> = {};
  const observableTools = [
    "read_device_info",
    "read_system_health",
    "read_reset_history",
    "measure_supply_voltage",
    "scan_i2c_bus",
    "read_sensor_status",
    "list_evidence",
  ];

  for (const toolName of observableTools) {
    const tool = registeredTools.find((t) => t.name === toolName);
    if (tool) {
      try {
        const resultStr = await modelContext.executeTool(tool, {});
        preInvestigationToolResults[toolName] = JSON.parse(resultStr);
      } catch {
        // Expected if tool requires specific arguments
      }
    }
  }

  const serializedEvidence = JSON.stringify(evidenceStore.getAll());
  const humanObservations = JSON.stringify(evidenceStore.getAll().filter((e) => e.source === "human"));

  const allVisibleText = [
    initialPrompt,
    toolDeclarations,
    toolSchemas,
    JSON.stringify(preInvestigationToolResults),
    serializedEvidence,
    humanObservations,
  ].join("\n");

  return {
    initialPrompt,
    toolDeclarations,
    toolSchemas,
    preInvestigationToolResults,
    serializedEvidence,
    humanObservations,
    allVisibleText,
  };
}

describe("Phase 7 — Expanded Hidden-State Firewall Audit", () => {
  it("never leaks hidden scenario truth in tool declarations, names, or descriptions", async () => {
    const adapter = new VirtualDeviceAdapter();
    await adapter.connect();

    const modelContext = new InMemoryModelContext();
    const capabilityRegistry = new CapabilityRegistry();
    const registrar = new DeviceToolRegistrar(modelContext, capabilityRegistry);
    await registrar.registerDevice(adapter);

    const evidenceStore = new InMemoryEvidenceStore();
    const hypothesisStore = new InMemoryHypothesisStore(evidenceStore);

    for (const tool of createHypothesisTools(hypothesisStore)) {
      await modelContext.registerTool(tool);
    }
    for (const tool of createEvidenceTools(evidenceStore)) {
      await modelContext.registerTool(tool);
    }

    const registeredTools = await modelContext.getTools();
    const serializedTools = JSON.stringify(registeredTools);

    for (const scenario of Object.values(SCENARIOS)) {
      const gt = scenario.groundTruth;
      expect(serializedTools).not.toContain(gt.title);
      expect(serializedTools).not.toContain(gt.hiddenFaultDescription);
      expect(serializedTools).not.toContain(gt.expectedDiagnosis);
      expect(serializedTools).not.toContain("0x77 (SDO high)");
      expect(serializedTools).not.toContain("SDA data line connector pin is unseated");
      expect(serializedTools).not.toContain("diagnose_i2c_problem");
      expect(serializedTools).not.toContain("get_correct_address");
      expect(serializedTools).not.toContain("is_brownout_present");
    }
  });

  it("strictly audits captured agent-visible context for brownout scenario", async () => {
    const context = await captureAgentVisibleContext("brownout");
    const gt = SCENARIOS.brownout.groundTruth;

    // Specifically prohibited pre-experiment exposure for brownout:
    expect(context.allVisibleText).not.toContain("relayPowerSource");
    expect(context.allVisibleText.toLowerCase()).not.toContain("shared 3.3v");
    expect(context.allVisibleText).not.toContain(gt.title);
    expect(context.allVisibleText).not.toContain(gt.hiddenFaultDescription);
    expect(context.allVisibleText).not.toContain(gt.expectedDiagnosis);
    expect(context.allVisibleText).not.toContain("targetIntervention");

    // read_device_info must NOT leak relay power rail
    const devInfo = context.preInvestigationToolResults.read_device_info as Record<string, unknown> | undefined;
    expect(devInfo).toBeDefined();
    expect((devInfo as any)?.relayPowerSource).toBeUndefined();
  });

  it("strictly audits captured agent-visible context across all 3 scenarios", async () => {
    for (const scenarioId of ["brownout", "i2c_address", "sda_fault"] as const) {
      const context = await captureAgentVisibleContext(scenarioId);
      const gt = SCENARIOS[scenarioId].groundTruth;

      expect(context.allVisibleText).not.toContain(gt.title);
      expect(context.allVisibleText).not.toContain(gt.hiddenFaultDescription);
      expect(context.allVisibleText).not.toContain(gt.expectedDiagnosis);
      expect(context.allVisibleText).not.toContain("targetIntervention");
    }
  });

  it("seals scenario ground truth and refuses to expose it before verification", () => {
    for (const scenarioId of ["brownout", "i2c_address", "sda_fault"] as const) {
      const session = createScenarioSession({ scenarioId });

      expect(session.isSealed).toBe(true);
      expect(session.isVerified).toBe(false);

      // Attempting to reveal before verification without allowIncomplete must throw
      expect(() => session.revealGroundTruth()).toThrow(
        /Cannot reveal sealed scenario ground truth before verification/
      );

      // Revealing with allowIncomplete: true succeeds
      const incompleteGt = session.revealGroundTruth({ allowIncomplete: true });
      expect(incompleteGt.id).toBe(scenarioId);

      // Symptom is public, but ground truth remained sealed
      expect(session.publicSymptom).toBeDefined();
      expect(typeof session.publicSymptom).toBe("string");
      expect(session.publicSymptom.length).toBeGreaterThan(10);
    }
  });

  it("ensures deterministic seed selection produces enabled scenario", () => {
    const session1 = createScenarioSession({ seed: 42 });
    const session2 = createScenarioSession({ seed: 42 });
    const session3 = createScenarioSession({ seed: 99 });

    expect(session1.scenarioId).toBe(session2.scenarioId);
    // Enabled scenario is brownout
    expect(["brownout", "i2c_address", "sda_fault"]).toContain(session3.scenarioId);
  });
});
