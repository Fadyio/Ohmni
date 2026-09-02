import { describe, expect, it } from "bun:test";
import { VirtualDeviceAdapter } from "../../src/domain/device/virtual-adapter";
import { CapabilityRegistry } from "../../src/infrastructure/webmcp/capability-registry";
import { InMemoryModelContext } from "../../src/infrastructure/webmcp/in-memory-model-context";
import { DeviceToolRegistrar } from "../../src/infrastructure/webmcp/device-tool-registrar";
import { createHypothesisTools } from "../../src/infrastructure/webmcp/hypothesis-tools";
import { createEvidenceTools } from "../../src/infrastructure/webmcp/evidence-tools";
import { InMemoryHypothesisStore } from "../../src/domain/hypothesis";
import { InMemoryEvidenceStore } from "../../src/domain/evidence/store";
import { SCENARIOS, startMysteryScenario, createScenarioSession } from "../../src/domain/scenario";

describe("Hidden-State Firewall Security Audit (Phase 2 & Non-Negotiable Principle 2)", () => {
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

    // Assert that none of the hidden ground truth secrets leak in any tool schema or description
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

  it("seals scenario ground truth and refuses to expose it before verification", () => {
    for (const scenarioId of ["brownout", "i2c_address", "sda_fault"] as const) {
      const session = createScenarioSession({ scenarioId });

      expect(session.isSealed).toBe(true);
      expect(session.isVerified).toBe(false);

      // Attempting to reveal before verification must throw
      expect(() => session.revealGroundTruth()).toThrow(
        /Cannot reveal sealed scenario ground truth before verification/
      );

      // Symptom is public, but ground truth remains sealed
      expect(session.publicSymptom).toBeDefined();
      expect(typeof session.publicSymptom).toBe("string");
      expect(session.publicSymptom.length).toBeGreaterThan(10);

      // Verification unlocks sealed truth
      session.markVerified();
      expect(session.isVerified).toBe(true);
      const revealed = session.revealGroundTruth();
      expect(revealed.id).toBe(scenarioId);
      expect(session.isSealed).toBe(false);
    }
  });

  it("ensures deterministic seed selection produces identical scenario runs", () => {
    const session1 = createScenarioSession({ seed: 42 });
    const session2 = createScenarioSession({ seed: 42 });
    const session3 = createScenarioSession({ seed: 99 });

    expect(session1.scenarioId).toBe(session2.scenarioId);
    // Different seed should have valid scenario
    expect(["brownout", "i2c_address", "sda_fault"]).toContain(session3.scenarioId);
  });
});
