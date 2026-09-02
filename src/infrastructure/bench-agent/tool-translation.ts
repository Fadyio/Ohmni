import type { GeminiFunctionDeclaration } from "./types";
import type { RegisteredTool } from "@/infrastructure/webmcp/types";

export const MAX_AGENT_TOOLS = 64;
export const MAX_TOOL_DESCRIPTION_CHARACTERS = 2_048;
export const MAX_TOOL_SCHEMA_CHARACTERS = 16_384;

const EMPTY_OBJECT_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {},
  additionalProperties: false,
};

function cloneInputSchema(
  toolName: string,
  inputSchema: unknown
): Record<string, unknown> {
  let schema: unknown =
    inputSchema === undefined ? EMPTY_OBJECT_SCHEMA : inputSchema;
  if (typeof schema === "string") {
    try {
      schema = JSON.parse(schema);
    } catch {
      throw new Error(`Tool '${toolName}' input schema must be an object.`);
    }
  }
  if (schema === null || typeof schema !== "object" || Array.isArray(schema)) {
    throw new Error(`Tool '${toolName}' input schema must be an object.`);
  }
  let serialized: string | undefined;
  try {
    serialized = JSON.stringify(schema);
  } catch {
    throw new Error(`Tool '${toolName}' input schema must be JSON serializable.`);
  }
  if (serialized === undefined) {
    throw new Error(`Tool '${toolName}' input schema must be JSON serializable.`);
  }

  if (serialized.length > MAX_TOOL_SCHEMA_CHARACTERS) {
    throw new Error(
      `Tool '${toolName}' input schema exceeds the ${MAX_TOOL_SCHEMA_CHARACTERS} character limit.`
    );
  }

  let cloned: unknown;
  try {
    cloned = JSON.parse(serialized) as unknown;
  } catch {
    throw new Error(`Tool '${toolName}' input schema must be JSON serializable.`);
  }

  if (cloned === null || typeof cloned !== "object" || Array.isArray(cloned)) {
    throw new Error(`Tool '${toolName}' input schema must be an object.`);
  }

  return cloned as Record<string, unknown>;
}

export function translateRegisteredTools(
  tools: readonly RegisteredTool[]
): readonly GeminiFunctionDeclaration[] {
  if (tools.length > MAX_AGENT_TOOLS) {
    throw new Error(`Tool count exceeds the ${MAX_AGENT_TOOLS} tool limit.`);
  }

  const names = new Set<string>();
  const declarations: GeminiFunctionDeclaration[] = [];

  for (const tool of tools) {
    if (typeof tool.name !== "string" || tool.name.trim() === "") {
      throw new Error("Tool name must be a non-empty string.");
    }
    if (names.has(tool.name)) {
      throw new Error(`Duplicate tool name '${tool.name}'.`);
    }
    names.add(tool.name);

    if (typeof tool.description !== "string") {
      throw new Error(`Tool '${tool.name}' description must be a string.`);
    }
    if (tool.description.length > MAX_TOOL_DESCRIPTION_CHARACTERS) {
      throw new Error(
        `Tool '${tool.name}' description exceeds the ${MAX_TOOL_DESCRIPTION_CHARACTERS} character limit.`
      );
    }

    declarations.push({
      type: "function",
      name: tool.name,
      description: tool.description,
      parameters: cloneInputSchema(tool.name, tool.inputSchema),
    });
  }

  return JSON.parse(JSON.stringify(declarations)) as GeminiFunctionDeclaration[];
}
