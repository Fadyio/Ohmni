/**
 * PERMANENT GOLDEN-PATH REGRESSION TEST — MILESTONE 6
 *
 * Agent-Driven Hypothesis Synthesis & Evidence Graph Verification.
 *
 * Verifies:
 * 1. WebMCP diagnostic experiment automatically produces immutable factual evidence.
 * 2. Agent explicitly proposes diagnostic hypothesis (H-001) via WebMCP propose_hypothesis.
 * 3. Agent links factual evidence records via WebMCP link_evidence with explicit relationships.
 * 4. Agent explicitly elevates hypothesis confidence to HIGH via WebMCP update_hypothesis with citations and reason.
 * 5. Factual EvidenceStore records remain completely untouched and immutable.
 * 6. Contradiction & Rejection: Disproven hypotheses (e.g. Memory exhaustion) can be rejected and remain in history.
 * 7. Confirmation Safeguard: Premature confirmation or claiming VERIFIED without a verification experiment is rejected.
 * 8. Zero Hidden-Fault Leakage: Simulator internal state (e.g. JP3, 3v3 relay wiring, 5V fix) is never leaked as root cause or advice.
 */

import { describe, it, expect, beforeEach } from "bun:test";
import { VirtualDeviceAdapter } from "@/domain/device/virtual-adapter";
import { InMemoryModelContext } from "@/infrastructure/webmcp/in-memory-model-context";
import { CapabilityRegistry } from "@/infrastructure/webmcp/capability-registry";
import { DeviceToolRegistrar } from "@/infrastructure/webmcp/device-tool-registrar";
import { TelemetryEventBus } from "@/domain/telemetry/bus";
import { InMemoryExperimentStore } from "@/domain/experiment/store";
import { ExperimentRunner } from "@/domain/experiment/runner";
import { InMemoryEvidenceStore } from "@/domain/evidence/store";
import { InMemoryHypothesisStore } from "@/domain/hypothesis/store";
import { registerEvidenceTools } from "@/infrastructure/webmcp/evidence-tools";
import { registerHypothesisTools } from "@/infrastructure/webmcp/hypothesis-tools";
import type { RegisteredTool } from "@/infrastructure/webmcp/types";

describe("Milestone 6 Golden Path — Agent-Driven Hypothesis Synthesis & Evidence Graph", () => {
  let modelContext: InMemoryModelContext;
  let telemetryBus: TelemetryEventBus;
  let experimentStore: InMemoryExperimentStore;
  let evidenceStore: InMemoryEvidenceStore;
  let hypothesisStore: InMemoryHypothesisStore;
  let experimentRunner: ExperimentRunner;
  let virtualDevice: VirtualDeviceAdapter;
  let capabilityRegistry: CapabilityRegistry;
  let toolRegistrar: DeviceToolRegistrar;

  beforeEach(async () => {
    modelContext = new InMemoryModelContext();
    telemetryBus = new TelemetryEventBus();
    experimentStore = new InMemoryExperimentStore();
    experimentRunner = new ExperimentRunner({
      eventBus: telemetryBus,
      store: experimentStore,
    });
    evidenceStore = experimentRunner.getEvidenceStore() as InMemoryEvidenceStore;
    hypothesisStore = new InMemoryHypothesisStore(evidenceStore);

    // Register investigation tools
    await registerEvidenceTools(modelContext, evidenceStore);
    await registerHypothesisTools(modelContext, hypothesisStore);

    // Register device capabilities
    virtualDevice = new VirtualDeviceAdapter();
    capabilityRegistry = new CapabilityRegistry(experimentRunner);
    toolRegistrar = new DeviceToolRegistrar(modelContext, capabilityRegistry);

    await virtualDevice.connect();
    await toolRegistrar.registerDevice(virtualDevice);
  });

  it("1. Golden Path: WebMCP synthesis builds an evidence-grounded hypothesis without mutating factual evidence", async () => {
    const tools = await modelContext.getTools();

    // 1. Run relay stress experiment via WebMCP
    const relayTool = tools.find((t: RegisteredTool) => t.name === "run_relay_stress_test");
    expect(relayTool).toBeDefined();

    const experimentResultStr = await modelContext.executeTool(
      relayTool!,
      JSON.stringify({ cycles: 3, delay_ms: 50, record_evidence: true })
    );
    expect(experimentResultStr).toBeDefined();

    // 2. Verify evidence records were auto-generated into EvidenceStore
    const evidenceList = evidenceStore.getAll();
    expect(evidenceList.length).toBeGreaterThanOrEqual(2);

    const resetEvidence = evidenceList.find((e) => e.type === "reset_event");
    const measurementEvidence = evidenceList.find((e) => e.type === "measurement");

    expect(resetEvidence).toBeDefined();
    expect(resetEvidence?.summary).toContain("BROWNOUT");
    expect(measurementEvidence).toBeDefined();
    expect(measurementEvidence?.summary).toContain("2.72");

    const eResetId = resetEvidence!.id;
    const eMeasId = measurementEvidence!.id;

    // Snapshot evidence before agent hypothesis synthesis
    const snapshotReset = JSON.stringify(resetEvidence);
    const snapshotMeas = JSON.stringify(measurementEvidence);

    // 3. Agent proposes hypothesis H-001 via WebMCP
    const proposeTool = tools.find((t: RegisteredTool) => t.name === "propose_hypothesis")!;
    const proposeResultStr = await modelContext.executeTool(
      proposeTool,
      JSON.stringify({
        title: "Relay-induced supply brownout",
        description: "Relay coil actuation draws surge current pulling the 3.3V rail below the 2.80V brownout threshold.",
        confidence: "MEDIUM",
        rationale: "Initial voltage drop observed on power rail during relay switching.",
      })
    );

    const proposeResult = JSON.parse(proposeResultStr);
    expect(proposeResult.hypothesis.id).toBe("H-001");
    expect(proposeResult.hypothesis.title).toBe("Relay-induced supply brownout");
    expect(proposeResult.hypothesis.confidence).toBe("MEDIUM");
    expect(proposeResult.hypothesis.status).toBe("ACTIVE");
    expect(proposeResult.hypothesis.verificationStatus).toBe("NOT_VERIFIED");

    // 4. Agent links supporting evidence E-001 and E-002 via WebMCP
    const linkTool = tools.find((t: RegisteredTool) => t.name === "link_evidence")!;

    await modelContext.executeTool(
      linkTool,
      JSON.stringify({
        hypothesis_id: "H-001",
        evidence_id: eResetId,
        relationship: "STRONGLY_SUPPORTS",
        note: "Device reported BROWNOUT reset reason upon relay actuation.",
      })
    );

    await modelContext.executeTool(
      linkTool,
      JSON.stringify({
        hypothesis_id: "H-001",
        evidence_id: eMeasId,
        relationship: "STRONGLY_SUPPORTS",
        note: "Measured rail voltage dropped to minimum 2.72V.",
      })
    );

    // 5. Agent updates hypothesis confidence to HIGH via WebMCP
    const updateTool = tools.find((t: RegisteredTool) => t.name === "update_hypothesis")!;
    const updateResultStr = await modelContext.executeTool(
      updateTool,
      JSON.stringify({
        hypothesis_id: "H-001",
        confidence: "HIGH",
        evidence_ids: [eResetId, eMeasId],
        reason: "Reset reason is confirmed BROWNOUT and rail falls below the 2.80V brownout threshold during relay actuation.",
      })
    );

    const updateResult = JSON.parse(updateResultStr);
    expect(updateResult.hypothesis.confidence).toBe("HIGH");
    expect(updateResult.hypothesis.supportingEvidenceIds).toContain(eResetId);
    expect(updateResult.hypothesis.supportingEvidenceIds).toContain(eMeasId);
    expect(updateResult.hypothesis.verificationStatus).toBe("NOT_VERIFIED");

    // 6. Query native list_hypotheses and get_hypothesis to ensure full consistency
    const listTool = tools.find((t: RegisteredTool) => t.name === "list_hypotheses")!;
    const listResult = JSON.parse(await modelContext.executeTool(listTool, "{}"));
    expect(listResult.count).toBe(1);
    expect(listResult.hypotheses[0].id).toBe("H-001");
    expect(listResult.hypotheses[0].confidence).toBe("HIGH");

    // 7. CRITICAL: Assert EvidenceStore remains completely unchanged and immutable
    expect(evidenceStore.getAll().length).toBe(evidenceList.length);
    expect(JSON.stringify(evidenceStore.get(eResetId))).toBe(snapshotReset);
    expect(JSON.stringify(evidenceStore.get(eMeasId))).toBe(snapshotMeas);
  });

  it("2. Contradiction & Rejection Regression: Rejected hypotheses remain visible in history", async () => {
    const tools = await modelContext.getTools();

    // 1. Record heap memory evidence
    const heapEvidence = evidenceStore.createAndAdd({
      type: "measurement",
      summary: "Heap memory remained stable at 142.5 kB free throughout the test.",
      source: "experiment",
      data: { freeHeapBytes: 142500, minFreeHeapBytes: 141200 },
      provenance: { origin: "virtual_device", toolName: "read_device_info" },
    });

    // 2. Propose memory exhaustion hypothesis
    const proposeTool = tools.find((t: RegisteredTool) => t.name === "propose_hypothesis")!;
    await modelContext.executeTool(
      proposeTool,
      JSON.stringify({
        title: "Memory exhaustion",
        description: "Microcontroller suffers out of memory fault causing unexpected crash.",
        confidence: "LOW",
      })
    );

    // 3. Link heap evidence as CONTRADICTS
    const linkTool = tools.find((t: RegisteredTool) => t.name === "link_evidence")!;
    await modelContext.executeTool(
      linkTool,
      JSON.stringify({
        hypothesis_id: "H-001",
        evidence_id: heapEvidence.id,
        relationship: "CONTRADICTS",
        note: "Heap memory remained steady with over 140 kB available.",
      })
    );

    // 4. Reject hypothesis via WebMCP
    const rejectTool = tools.find((t: RegisteredTool) => t.name === "reject_hypothesis")!;
    const rejectResultStr = await modelContext.executeTool(
      rejectTool,
      JSON.stringify({
        hypothesis_id: "H-001",
        reason: "Heap was measured and showed zero memory leaks or exhaustion.",
        evidence_ids: [heapEvidence.id],
      })
    );

    const rejectResult = JSON.parse(rejectResultStr);
    expect(rejectResult.hypothesis.status).toBe("REJECTED");
    expect(rejectResult.hypothesis.contradictingEvidenceIds).toContain(heapEvidence.id);

    // 5. Verify rejected hypothesis remains in history
    const listTool = tools.find((t: RegisteredTool) => t.name === "list_hypotheses")!;
    const listAll = JSON.parse(await modelContext.executeTool(listTool, "{}"));
    expect(listAll.count).toBe(1);
    expect(listAll.hypotheses[0].status).toBe("REJECTED");

    const listRejected = JSON.parse(
      await modelContext.executeTool(listTool, JSON.stringify({ status: "REJECTED" }))
    );
    expect(listRejected.count).toBe(1);
    expect(listRejected.hypotheses[0].id).toBe("H-001");
  });

  it("3. Confirmation Safeguard Regression: Cannot set CONFIRMED or VERIFIED without verification experiment", async () => {
    // 1. Propose hypothesis
    const h = hypothesisStore.create({
      title: "Relay-induced supply brownout",
      description: "Relay activation causes brownout.",
      confidence: "MEDIUM",
    });

    // 2. Add evidence and update to VERY_HIGH
    const e = evidenceStore.createAndAdd({
      type: "reset_event",
      summary: "BROWNOUT reset observed.",
      source: "device",
      data: { resetReason: "BROWNOUT" },
      provenance: { origin: "virtual_device" },
    });

    hypothesisStore.updateConfidence({
      hypothesisId: h.id,
      confidence: "VERY_HIGH",
      evidenceIds: [e.id],
      reason: "Definitive evidence of brownout reset.",
    });

    // 3. Attempt confirmation without verification experiment
    expect(() => {
      hypothesisStore.confirm({
        hypothesisId: h.id,
        rationale: "Claiming confirmed diagnosis.",
        evidenceIds: [e.id],
        // No verifiedExperimentId
      });
    }).toThrow(/Cannot confirm hypothesis .* without a completed physical\/virtual verification experiment/);

    const stored = hypothesisStore.get(h.id);
    expect(stored?.verificationStatus).toBe("NOT_VERIFIED");
    expect(stored?.status).toBe("ACTIVE");
  });

  it("4. Zero Hidden-Fault Leakage: Agent-visible tool descriptions and outputs strictly exclude simulator secrets", async () => {
    const tools = await modelContext.getTools();

    // Collect all tool names, descriptions, and input schemas
    const allMetadata = tools.map((t) => ({
      name: t.name,
      description: t.description,
      schema: JSON.stringify(t.inputSchema || {}),
    }));

    const forbiddenPhrases = [
      "bad jumper",
      "wrong relay wiring",
      "root cause: 3v3",
      "recommended 5V fix",
      "move JP3 to 5V",
      "JP3 jumper",
    ];

    for (const tool of allMetadata) {
      const combinedText = `${tool.name} ${tool.description} ${tool.schema}`.toLowerCase();
      for (const phrase of forbiddenPhrases) {
        expect(combinedText).not.toContain(phrase.toLowerCase());
      }
    }

    // Execute diagnostic tool and check output
    const relayTool = tools.find((t) => t.name === "run_relay_stress_test")!;
    const output = await modelContext.executeTool(relayTool, JSON.stringify({ cycles: 1, delay_ms: 10 }));
    const outputLower = output.toLowerCase();

    for (const phrase of forbiddenPhrases) {
      expect(outputLower).not.toContain(phrase.toLowerCase());
    }
  });
});
