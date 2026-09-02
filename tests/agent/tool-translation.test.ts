import { describe, expect, it } from "bun:test";
import { translateRegisteredTools } from "@/infrastructure/bench-agent/tool-translation";
import type { RegisteredTool } from "@/infrastructure/webmcp/types";

const EMPTY_OBJECT_SCHEMA = {
  type: "object",
  properties: {},
  additionalProperties: false,
} as const;

function registeredTool(
  name: string,
  overrides: Partial<RegisteredTool> = {}
): RegisteredTool {
  return {
    name,
    description: `Description for ${name}`,
    inputSchema: EMPTY_OBJECT_SCHEMA,
    ...overrides,
  };
}

function expectNoHiddenKeys(value: unknown): void {
  if (value === null || typeof value !== "object") return;

  if (Array.isArray(value)) {
    for (const element of value) {
      expectNoHiddenKeys(element);
    }
    return;
  }

  for (const key of Reflect.ownKeys(value)) {
    expect(typeof key).toBe("string");
    expect(Object.prototype.propertyIsEnumerable.call(value, key)).toBe(true);
    expect(["title", "annotations", "execute", "hiddenObject", "faultState"]).not.toContain(
      key
    );

    expectNoHiddenKeys(Reflect.get(value, key));
  }
}

describe("translateRegisteredTools", () => {
  it("translates only serializable run_relay_stress_test metadata", () => {
    const hiddenFault = Symbol("hidden-fault");
    const inputSchema: Record<string, unknown> = {
      type: "object",
      properties: {
        cycles: { type: "integer", minimum: 1, maximum: 100 },
        duration_ms: { type: "integer", minimum: 1, maximum: 5_000 },
      },
      required: ["cycles", "duration_ms"],
      additionalProperties: false,
    };
    Object.defineProperty(inputSchema, "faultState", {
      enumerable: false,
      value: { brownoutLatched: true },
    });
    Object.defineProperty(inputSchema, hiddenFault, {
      enumerable: false,
      value: "must not cross the translation boundary",
    });

    const execute = async () => ({ faultReproduced: true });
    const tool = {
      name: "run_relay_stress_test",
      title: "Run relay stress test",
      description: "Cycle the relay under load to reproduce an intermittent brownout.",
      inputSchema,
      annotations: {
        readOnlyHint: false,
        untrustedContentHint: false,
      },
      execute,
    } satisfies RegisteredTool & { execute: typeof execute };
    Object.defineProperty(tool, "hiddenObject", {
      enumerable: false,
      value: { faultState: { brownoutLatched: true } },
    });

    const declarations = translateRegisteredTools([tool]);

    expect(declarations).toEqual([
      {
        type: "function",
        name: "run_relay_stress_test",
        description: "Cycle the relay under load to reproduce an intermittent brownout.",
        parameters: {
          type: "object",
          properties: {
            cycles: { type: "integer", minimum: 1, maximum: 100 },
            duration_ms: { type: "integer", minimum: 1, maximum: 5_000 },
          },
          required: ["cycles", "duration_ms"],
          additionalProperties: false,
        },
      },
    ]);
    expect(Reflect.ownKeys(declarations[0])).toEqual([
      "type",
      "name",
      "description",
      "parameters",
    ]);
    expectNoHiddenKeys(declarations);
  });

  it("rejects duplicate tool names", () => {
    expect(() =>
      translateRegisteredTools([
        registeredTool("read_system_health"),
        registeredTool("read_system_health"),
      ])
    ).toThrow(/duplicate.*name/i);
  });

  it("rejects more than 64 tools", () => {
    const tools = Array.from({ length: 65 }, (_, index) =>
      registeredTool(`tool_${index}`)
    );

    expect(() => translateRegisteredTools(tools)).toThrow(/64|tool.*count|too many/i);
  });

  it("rejects descriptions longer than 2,048 characters", () => {
    const tool = registeredTool("oversized_description", {
      description: "d".repeat(2_049),
    });

    expect(() => translateRegisteredTools([tool])).toThrow(
      /description.*(?:2,?048|2048|long|limit)/i
    );
  });

  it("rejects schemas whose JSON serialization exceeds 16,384 characters", () => {
    const inputSchema = {
      type: "object",
      description: "s".repeat(16_385),
      properties: {},
    };
    expect(JSON.stringify(inputSchema).length).toBeGreaterThan(16_384);

    expect(() =>
      translateRegisteredTools([
        registeredTool("oversized_schema", { inputSchema }),
      ])
    ).toThrow(/schema.*(?:16,?384|16384|large|limit)/i);
  });

  it("rejects malformed non-object input schemas", () => {
    const malformedSchemas = [null, "object", 7, false, []] as const;

    for (const inputSchema of malformedSchemas) {
      const malformedTool = {
        ...registeredTool("malformed_schema"),
        inputSchema,
      } as unknown as RegisteredTool;

      expect(() => translateRegisteredTools([malformedTool])).toThrow(
        /input.?schema.*object/i
      );
    }
  });
});
