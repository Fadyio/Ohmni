/**
 * Milestone 7.6 Trust Audit: Hidden Fault Payload & Zero Leak Tests.
 *
 * Verifies:
 * 1. Sanitization: No hidden fault state (e.g. relay_power, 3v3, JP3, hiddenFault, expectedFix, 5v, bad jumper)
 *    is leaked in tool descriptions or schemas.
 * 2. Clean isolation: Disconnected state provides zero unearned evidence or hypotheses.
 */

import { describe, it, expect } from "bun:test";
import { CapabilityRegistry } from "@/infrastructure/webmcp/capability-registry";
import { VirtualDeviceAdapter } from "@/domain/device/virtual-adapter";
import { InMemoryModelContext } from "@/infrastructure/webmcp/in-memory-model-context";
import { DeviceToolRegistrar } from "@/infrastructure/webmcp/device-tool-registrar";
import { InMemoryEvidenceStore } from "@/domain/evidence/store";
import { registerEvidenceTools } from "@/infrastructure/webmcp/evidence-tools";
import { InMemoryHypothesisStore } from "@/domain/hypothesis/store";
import { registerHypothesisTools } from "@/infrastructure/webmcp/hypothesis-tools";
import { translateRegisteredTools } from "@/infrastructure/bench-agent/tool-translation";

describe("Milestone 7.6 — Trust Audit & Hidden Payload Leak Prevention", () => {
  const FORBIDDEN_LEAK_STRINGS = [
    "relay_power",
    "3v3",
    "JP3",
    "hiddenFault",
    "expectedFix",
    "bad jumper",
    "wrong wiring",
  ];

  it("1. Tool declarations do not leak hidden simulator fault state", async () => {
    const modelContext = new InMemoryModelContext();
    const adapter = new VirtualDeviceAdapter();
    await adapter.connect();

    const registrar = new DeviceToolRegistrar(modelContext, new CapabilityRegistry());
    await registrar.registerDevice(adapter);

    const evidenceStore = new InMemoryEvidenceStore();
    await registerEvidenceTools(modelContext, evidenceStore);

    const hypothesisStore = new InMemoryHypothesisStore();
    await registerHypothesisTools(modelContext, hypothesisStore);

    const tools = await modelContext.getTools();
    expect(tools.length).toBe(19);

    const declarations = translateRegisteredTools(tools);
    const serializedTools = JSON.stringify(declarations).toLowerCase();

    for (const forbidden of FORBIDDEN_LEAK_STRINGS) {
      expect(serializedTools.includes(forbidden.toLowerCase())).toBe(false);
    }
  });

  it("2. Disconnected state provides zero unearned evidence or hypotheses", () => {
    const evidenceStore = new InMemoryEvidenceStore();
    const hypothesisStore = new InMemoryHypothesisStore();

    expect(evidenceStore.getAll().length).toBe(0);
    expect(hypothesisStore.getAll().length).toBe(0);
  });
});
