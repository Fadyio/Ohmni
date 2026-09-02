import { describe, expect, it } from "bun:test";
import { InMemoryModelContext } from "../../src/infrastructure/webmcp/in-memory-model-context";
import { InMemoryEvidenceStore, createHumanObservation } from "../../src/domain/evidence/store";
import {
  createEvidenceTools,
  registerEvidenceTools,
} from "../../src/infrastructure/webmcp/evidence-tools";

describe("WebMCP Evidence Tools (Slice 5G)", () => {
  it("creates list_evidence and get_evidence tools with readOnlyHint annotations", () => {
    const store = new InMemoryEvidenceStore();
    const tools = createEvidenceTools(store);

    expect(tools.length).toBe(2);
    const names = tools.map((t) => t.name);
    expect(names).toContain("list_evidence");
    expect(names).toContain("get_evidence");

    for (const tool of tools) {
      expect(tool.annotations?.readOnlyHint).toBe(true);
    }
  });

  it("prohibits creation/mutation/deletion tools from WebMCP surface", () => {
    const store = new InMemoryEvidenceStore();
    const tools = createEvidenceTools(store);
    const names = tools.map((t) => t.name);

    expect(names).not.toContain("create_evidence");
    expect(names).not.toContain("edit_evidence");
    expect(names).not.toContain("delete_evidence");
    expect(names).not.toContain("update_evidence");
  });

  it("list_evidence retrieves all recorded evidence and supports experiment filtering", async () => {
    const store = new InMemoryEvidenceStore();
    const modelContext = new InMemoryModelContext();

    store.add({
      id: "E-001",
      type: "reset_event",
      summary: "Reset reason: BROWNOUT",
      createdAt: 1000,
      experimentId: "exp_1",
      source: "experiment",
      data: { reason: "BROWNOUT" },
      provenance: { origin: "virtual_device", experimentId: "exp_1" },
    });

    store.add({
      id: "E-002",
      type: "measurement",
      summary: "Minimum supply: 2.72 V",
      createdAt: 1010,
      experimentId: "exp_1",
      source: "device",
      data: { min_v: 2.72 },
      provenance: { origin: "virtual_device", experimentId: "exp_1" },
    });

    store.add(
      createHumanObservation({
        id: "E-003",
        summary: "Jumper set to 3V3",
      })
    );

    await registerEvidenceTools(modelContext, store);

    const registered = await modelContext.getTools();
    const listTool = registered.find((t) => t.name === "list_evidence");
    expect(listTool).toBeDefined();

    // 1. Execute list_evidence without filters -> returns all 3
    const allResultRaw = await modelContext.executeTool(listTool!);
    const allResult = JSON.parse(allResultRaw);
    expect(Array.isArray(allResult)).toBe(true);
    expect(allResult.length).toBe(3);
    expect(allResult.map((e: { id: string }) => e.id)).toEqual(["E-001", "E-002", "E-003"]);

    // 2. Execute list_evidence with experiment_id filter -> returns 2
    const exp1ResultRaw = await modelContext.executeTool(listTool!, {
      experiment_id: "exp_1",
    });
    const exp1Result = JSON.parse(exp1ResultRaw);
    expect(exp1Result.length).toBe(2);
    expect(exp1Result.map((e: { id: string }) => e.id)).toEqual(["E-001", "E-002"]);
  });

  it("get_evidence retrieves a single record by E-xxx ID", async () => {
    const store = new InMemoryEvidenceStore();
    const modelContext = new InMemoryModelContext();

    store.add({
      id: "E-001",
      type: "measurement",
      summary: "Supply drop: 0.59 V",
      createdAt: 1000,
      experimentId: "exp_1",
      source: "device",
      data: { drop_v: 0.59 },
      provenance: { origin: "virtual_device", experimentId: "exp_1" },
    });

    await registerEvidenceTools(modelContext, store);

    const registered = await modelContext.getTools();
    const getTool = registered.find((t) => t.name === "get_evidence");
    expect(getTool).toBeDefined();

    const resultRaw = await modelContext.executeTool(getTool!, {
      evidence_id: "E-001",
    });
    const result = JSON.parse(resultRaw);
    expect(result.id).toBe("E-001");
    expect(result.summary).toBe("Supply drop: 0.59 V");
    expect(result.data.drop_v).toBe(0.59);
  });

  it("get_evidence throws when evidence_id does not exist", async () => {
    const store = new InMemoryEvidenceStore();
    const modelContext = new InMemoryModelContext();
    await registerEvidenceTools(modelContext, store);

    const registered = await modelContext.getTools();
    const getTool = registered.find((t) => t.name === "get_evidence")!;

    await expect(
      modelContext.executeTool(getTool, { evidence_id: "E-999" })
    ).rejects.toThrow(/not found/i);
  });
});
