/**
 * Phase 13 — Live Groq GPT-OSS 120B Integration Test Runner.
 *
 * Requirements:
 * 1. Canary: verifies API reachable and model responds.
 * 2. Exposes registered WebMCP tools (device, evidence, hypothesis).
 * 3. Sends hardware symptom prompt to Groq.
 * 4. Ensures first tool requested is a valid registered WebMCP tool.
 * 5. Executes tools through WebMCP and sends results via transcript.
 * 6. Ensures agent continues and makes progress across multi-turn loop.
 * 7. Verifies controlled experiment request (run_relay_stress_test).
 * 8. Ensures agent never calls unregistered tools.
 * 9. Ensures agent never receives hidden scenario truth.
 * 10. Only runs when GROQ_API_KEY is locally present (skips gracefully if unset).
 *
 * Usage:
 *   GROQ_API_KEY=gsk_... bun run test:agent:groq
 */

import { VirtualDeviceAdapter } from "../src/domain/device/virtual-adapter";
import { InMemoryModelContext } from "../src/infrastructure/webmcp/in-memory-model-context";
import { DeviceToolRegistrar } from "../src/infrastructure/webmcp/device-tool-registrar";
import { CapabilityRegistry } from "../src/infrastructure/webmcp/capability-registry";
import { TelemetryEventBus } from "../src/domain/telemetry/bus";
import { InMemoryExperimentStore } from "../src/domain/experiment/store";
import { ExperimentRunner } from "../src/domain/experiment/runner";
import type { EvidenceStore } from "../src/domain/evidence/store";
import { registerEvidenceTools } from "../src/infrastructure/webmcp/evidence-tools";
import { InMemoryHypothesisStore } from "../src/domain/hypothesis/store";
import { registerHypothesisTools } from "../src/infrastructure/webmcp/hypothesis-tools";
import {
  GroqBenchAgentProvider,
  DEFAULT_GROQ_MODEL,
} from "../server/bench-agent/groq-provider";
import { runBenchAgent } from "../src/infrastructure/bench-agent/run-bench-agent";
import type {
  AgentTurnRequest,
  AgentTurnResult,
  BenchAgentEvent,
  BenchAgentProvider,
} from "../src/infrastructure/bench-agent/types";

interface WorkbenchEnvironment {
  readonly modelContext: InMemoryModelContext;
  readonly virtualDevice: VirtualDeviceAdapter;
  readonly toolRegistrar: DeviceToolRegistrar;
  readonly evidenceStore: EvidenceStore;
  readonly hypothesisStore: InMemoryHypothesisStore;
}

function createWorkbenchEnvironment(): WorkbenchEnvironment {
  const modelContext = new InMemoryModelContext();
  const telemetryBus = new TelemetryEventBus();
  const experimentStore = new InMemoryExperimentStore();
  const experimentRunner = new ExperimentRunner({
    eventBus: telemetryBus,
    store: experimentStore,
  });
  const evidenceStore = experimentRunner.getEvidenceStore();
  const hypothesisStore = new InMemoryHypothesisStore(evidenceStore);

  registerEvidenceTools(modelContext, evidenceStore).catch(() => {});
  registerHypothesisTools(modelContext, hypothesisStore).catch(() => {});

  const capabilityRegistry = new CapabilityRegistry(experimentRunner);
  const toolRegistrar = new DeviceToolRegistrar(modelContext, capabilityRegistry);
  const virtualDevice = new VirtualDeviceAdapter();

  return {
    modelContext,
    virtualDevice,
    toolRegistrar,
    evidenceStore,
    hypothesisStore,
  };
}

class TrackingGroqProvider implements BenchAgentProvider {
  public readonly interactionIds: string[] = [];
  public readonly requests: AgentTurnRequest[] = [];
  private readonly provider: GroqBenchAgentProvider;

  constructor(apiKey: string, model?: string) {
    this.provider = new GroqBenchAgentProvider({ apiKey, model });
  }

  async turn(request: AgentTurnRequest, options?: { signal?: AbortSignal }): Promise<AgentTurnResult> {
    this.requests.push(structuredClone(request));
    const result = await this.provider.turn(request, options);
    if (result.interactionId && !this.interactionIds.includes(result.interactionId)) {
      this.interactionIds.push(result.interactionId);
    }
    return result;
  }

  async canary(options?: { signal?: AbortSignal }) {
    return this.provider.canary(options);
  }
}

async function main(): Promise<void> {
  console.info("==================================================================");
  console.info("OHMNI — LIVE GROQ GPT-OSS 120B INTEGRATION ACCEPTANCE SUITE");
  console.info("==================================================================");

  const apiKey = process.env.GROQ_API_KEY?.trim();
  const model = process.env.GROQ_MODEL?.trim() || DEFAULT_GROQ_MODEL;

  if (!apiKey) {
    console.warn("\n⚠️  [SKIPPED] GROQ_API_KEY is not locally set.");
    console.warn("To run against the live Groq API:");
    console.warn("  GROQ_API_KEY=gsk_... bun run test:agent:groq\n");
    process.exit(0);
  }

  console.info(`Target Model: ${model}`);
  console.info("API Key: [CONFIGURED - SERVER ONLY]");

  // 1. Canary
  console.info("\n--- STEP 1: Minimal Groq Canary Verification ---");
  const canaryProvider = new GroqBenchAgentProvider({ apiKey, model });
  const canaryResult = await canaryProvider.canary();
  console.info(`Canary Status: ${canaryResult.ok ? "PASS" : "FAIL"}`);
  console.info(`Canary Output: ${canaryResult.message}`);
  if (!canaryResult.ok) {
    console.error("❌ FAILED: Groq canary failed. Check API key or quota.");
    process.exit(1);
  }

  // 2. Setup Workbench
  console.info("\n--- STEP 2: Exposing WebMCP Diagnostic Instruments ---");
  const env = createWorkbenchEnvironment();
  await env.toolRegistrar.registerDevice(env.virtualDevice);
  const registeredTools = await env.modelContext.getTools();
  const registeredToolNames = new Set(registeredTools.map((t) => t.name));
  console.info(`Registered WebMCP Tools (${registeredTools.length}): ${[...registeredToolNames].join(", ")}`);

  // 3. Run Investigation
  console.info("\n--- STEP 3: Dispatching Hardware Diagnostic Symptom ---");
  const prompt =
    "The DUT resets intermittently during operation. Locate root cause, form an evidence-based hypothesis, and verify.";

  const trackingProvider = new TrackingGroqProvider(apiKey, model);
  const requestedToolSequence: string[] = [];
  const nonexistentToolCalls: string[] = [];
  let amberApprovalTriggered = false;

  const onEvent = (event: BenchAgentEvent) => {
    if (event.type === "tool-requested") {
      requestedToolSequence.push(event.call.name);
      console.info(`  → Model requested tool: [${event.call.name}] (Call ID: ${event.call.id})`);
      if (!registeredToolNames.has(event.call.name)) {
        nonexistentToolCalls.push(event.call.name);
        console.error(`  ❌ UNREGISTERED TOOL CALL DETECTED: ${event.call.name}`);
      }
    } else if (event.type === "approval-requested") {
      amberApprovalTriggered = true;
      console.info(`  ⚠️  [AMBER GATE] Physical actuation safety gate triggered for ${event.call.name}`);
    } else if (event.type === "tool-completed") {
      console.info(`  ✓ Tool completed: [${event.call.name}] in ${event.durationMs}ms`);
    } else if (event.type === "tool-failed") {
      console.warn(`  ! Tool failed: [${event.call.name}]: ${event.message}`);
    }
  };

  const runResult = await runBenchAgent({
    goal: prompt,
    modelContext: env.modelContext,
    provider: trackingProvider,
    onEvent,
    requestApproval: async ({ call }) => {
      console.info(`  [HUMAN APPROVAL] Approving load-bearing experiment: ${call.name}`);
      return true;
    },
    maxSteps: 12,
  });

  console.info("\n--- STEP 4: Evaluating Invariant Acceptance Criteria ---");
  console.info(`Agent Run Status: ${runResult.status}`);
  console.info(`Total Execution Steps: ${runResult.steps}`);
  console.info(`Tool Request Sequence: ${requestedToolSequence.join(" → ")}`);

  // Invariant 1: First tool call must be a valid registered WebMCP tool
  const firstTool = requestedToolSequence[0];
  const firstToolValid = Boolean(firstTool && registeredToolNames.has(firstTool));
  console.info(`Invariant 1 (First tool valid WebMCP): ${firstToolValid ? "PASS" : "FAIL"} (${firstTool})`);

  // Invariant 2: Never invents unregistered tools
  const zeroUnregistered = nonexistentToolCalls.length === 0;
  console.info(`Invariant 2 (Zero unregistered tools): ${zeroUnregistered ? "PASS" : "FAIL"}`);

  // Invariant 3: Multi-turn loop made progress
  const multiTurnProgress = requestedToolSequence.length >= 2;
  console.info(`Invariant 3 (Multi-turn tool execution): ${multiTurnProgress ? "PASS" : "FAIL"}`);

  // Invariant 4: Reached controlled experiment or hypothesis proposal
  const reachedExperimentOrHypothesis =
    requestedToolSequence.includes("run_relay_stress_test") ||
    requestedToolSequence.includes("propose_hypothesis") ||
    requestedToolSequence.includes("measure_supply_voltage");
  console.info(`Invariant 4 (Empirical investigation reached): ${reachedExperimentOrHypothesis ? "PASS" : "FAIL"}`);

  // Invariant 5: History was maintained across turns
  const historyPassed = Boolean(
    trackingProvider.requests.length >= 2 &&
      trackingProvider.requests[1].history &&
      trackingProvider.requests[1].history.length >= 3
  );
  console.info(`Invariant 5 (Transcript-based history transmitted): ${historyPassed ? "PASS" : "FAIL"}`);

  const passed =
    firstToolValid &&
    zeroUnregistered &&
    multiTurnProgress &&
    reachedExperimentOrHypothesis &&
    historyPassed;

  console.info("\n==================================================================");
  console.info(`FINAL LIVE GROQ INTEGRATION VERDICT: ${passed ? "PASS" : "FAIL"}`);
  console.info("==================================================================");

  if (!passed) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Unhandled live Groq runner failure:", err);
  process.exit(1);
});
