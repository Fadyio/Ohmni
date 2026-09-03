/**
 * Milestone 14 — Groq Blindness & Zero Ground Truth Leak Test.
 *
 * Verifies that the production Groq request payload before the first turn
 * contains ZERO leaked ground truth, scenario IDs, or spoiler repair instructions.
 */
import { describe, expect, it } from "bun:test";
import { createScenarioSession } from "@/domain/scenario";
import { InMemoryModelContext } from "@/infrastructure/webmcp/in-memory-model-context";
import { DeviceToolRegistrar } from "@/infrastructure/webmcp/device-tool-registrar";
import { CapabilityRegistry } from "@/infrastructure/webmcp/capability-registry";
import { VirtualDeviceAdapter } from "@/domain/device/virtual-adapter";
import { InMemoryEvidenceStore } from "@/domain/evidence/store";
import { registerEvidenceTools } from "@/infrastructure/webmcp/evidence-tools";
import { InMemoryHypothesisStore } from "@/domain/hypothesis/store";
import { registerHypothesisTools } from "@/infrastructure/webmcp/hypothesis-tools";
import { translateRegisteredTools } from "@/infrastructure/bench-agent/tool-translation";
import {
  BENCH_AGENT_SYSTEM_INSTRUCTION,
  buildGroqMessages,
  translateToolsToGroq,
} from "../../server/bench-agent/groq-provider";
import type { AgentTurnRequest } from "@/infrastructure/bench-agent/types";

describe("Milestone 14 — Groq Blindness Invariant", () => {
  const FORBIDDEN_GROQ_STRINGS = [
    "shared 3.3v",
    "shared 3.3",
    "external 5v",
    "jp1",
    "scenario id",
    "scenario_id",
    "expected diagnosis",
    "ground truth",
    "ground_truth",
    "expectedfix",
  ];

  it("ensures everything Groq receives before first turn contains zero ground-truth leaks", async () => {
    // 1. Create realistic blind scenario session
    const session = createScenarioSession({ scenarioId: "brownout" });
    const publicGoal = `${session.publicSymptom} Investigate the root cause using the available WebMCP diagnostic instruments, request physical help when needed, and experimentally verify the repair.`;

    // 2. Set up WebMCP context & registered tools
    const modelContext = new InMemoryModelContext();
    const adapter = new VirtualDeviceAdapter();
    await adapter.connect();

    const registrar = new DeviceToolRegistrar(modelContext, new CapabilityRegistry());
    await registrar.registerDevice(adapter);

    const evidenceStore = new InMemoryEvidenceStore();
    await registerEvidenceTools(modelContext, evidenceStore);

    const hypothesisStore = new InMemoryHypothesisStore();
    await registerHypothesisTools(modelContext, hypothesisStore);

    const registeredTools = await modelContext.getTools();
    const translatedTools = translateRegisteredTools(registeredTools);
    const groqTools = translateToolsToGroq(translatedTools);
    const request: AgentTurnRequest = {
      input: publicGoal,
      tools: translatedTools,
      history: [],
    };
    const groqMessages = buildGroqMessages(BENCH_AGENT_SYSTEM_INSTRUCTION, request);

    // 4. Capture all text that Groq sees
    const fullPayloadSerialized = JSON.stringify({
      messages: groqMessages,
      tools: groqTools,
    }).toLowerCase();

    // 5. Assert zero forbidden leaks
    for (const forbidden of FORBIDDEN_GROQ_STRINGS) {
      const found = fullPayloadSerialized.includes(forbidden.toLowerCase());
      if (found) {
        throw new Error(`Blindness violation: payload sent to Groq contains forbidden spoiler: "${forbidden}"`);
      }
      expect(found).toBe(false);
    }
    // 6. Assert public goal is genuinely present and factual
    expect(fullPayloadSerialized).toContain("restarts unexpectedly");
  });
});
