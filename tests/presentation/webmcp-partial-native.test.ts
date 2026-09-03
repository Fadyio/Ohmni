import { describe, expect, it } from "bun:test";
import { subscribeToModelContextToolChanges } from "@/presentation/hooks/useWebMCPTools";
import type { ModelContext } from "@/infrastructure/webmcp/types";
import { MirroredModelContext } from "@/infrastructure/webmcp/mirrored-model-context";

describe("partial native WebMCP compatibility", () => {
  it("does not require EventTarget methods when native registration is available", () => {
    const nativeLikeContext = {
      registerTool: async () => undefined,
      getTools: async () => [],
      executeTool: async () => "{}",
    } satisfies ModelContext;
    let refreshCount = 0;

    const unsubscribe = subscribeToModelContextToolChanges(
      nativeLikeContext,
      () => refreshCount++,
    );

    expect(refreshCount).toBe(0);
    expect(() => unsubscribe()).not.toThrow();
  });

  it("only removes a listener when the matching removal method exists", () => {
    let subscribed = 0;
    const nativeLikeContext = {
      registerTool: async () => undefined,
      getTools: async () => [],
      executeTool: async () => "{}",
      addEventListener: () => subscribed++,
    } satisfies ModelContext;

    const unsubscribe = subscribeToModelContextToolChanges(
      nativeLikeContext,
      () => undefined,
    );

    expect(subscribed).toBe(1);
    expect(() => unsubscribe()).not.toThrow();
  });

  it("keeps native discovery while providing local execution when native execution is absent", async () => {
    const nativeNames: string[] = [];
    const partialNative = {
      registerTool: async (tool) => { nativeNames.push(tool.name); },
      getTools: async () => [],
      executeTool: undefined as never,
    } satisfies ModelContext;
    const mirrored = new MirroredModelContext(partialNative);
    await mirrored.registerTool({
      name: "read_device_info",
      description: "Read device info",
      execute: async () => ({ chip: "ESP32-S3" }),
    });

    expect(nativeNames).toEqual(["read_device_info"]);
    const tool = (await mirrored.getTools())[0];
    expect(await mirrored.executeTool(tool, {})).toBe(JSON.stringify({ chip: "ESP32-S3" }));
  });
});
