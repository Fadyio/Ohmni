/**
 * Spec-compliant in-memory test double of ModelContext.
 * Models registration, tool discovery, execution, signal lifecycle,
 * and toolchange event dispatching.
 */

import type {
  ModelContext,
  ModelContextTool,
  RegisteredTool,
  ModelContextRegisterToolOptions,
  ModelContextExecuteToolOptions,
} from "./types";

interface StoredToolEntry {
  readonly tool: ModelContextTool;
  readonly registeredTool: RegisteredTool;
}

export class InMemoryModelContext extends EventTarget implements ModelContext {
  private readonly tools: Map<string, StoredToolEntry> = new Map();

  public async registerTool(
    tool: ModelContextTool,
    options?: ModelContextRegisterToolOptions
  ): Promise<void> {
    if (!tool.name || tool.name.trim() === "") {
      throw new Error("Tool name cannot be empty");
    }

    if (!tool.description || tool.description.trim() === "") {
      throw new Error(`Tool description cannot be empty for '${tool.name}'`);
    }

    if (this.tools.has(tool.name)) {
      throw new Error(`Duplicate tool registration: '${tool.name}' is already registered`);
    }

    if (options?.signal?.aborted) {
      throw new Error(`Registration aborted for tool '${tool.name}'`);
    }

    const registeredTool: RegisteredTool = {
      name: tool.name,
      title: tool.title,
      description: tool.description,
      inputSchema: tool.inputSchema,
      annotations: tool.annotations,
    };

    this.tools.set(tool.name, { tool, registeredTool });
    this.dispatchEvent(new Event("toolchange"));

    if (options?.signal) {
      const signal = options.signal;
      const onAbort = () => {
        if (this.tools.has(tool.name)) {
          this.tools.delete(tool.name);
          this.dispatchEvent(new Event("toolchange"));
        }
        signal.removeEventListener("abort", onAbort);
      };
      signal.addEventListener("abort", onAbort);
    }
  }

  public async getTools(): Promise<readonly RegisteredTool[]> {
    return Array.from(this.tools.values()).map((entry) => entry.registeredTool);
  }

  public async executeTool(
    tool: RegisteredTool | string,
    input: string | Record<string, unknown> = {},
    options?: ModelContextExecuteToolOptions
  ): Promise<string> {
    const toolName = typeof tool === "string" ? tool : tool?.name;
    const entry = this.tools.get(toolName);
    if (!entry) {
      throw new Error(`Tool not found or unregistered: '${toolName}'`);
    }

    if (options?.signal?.aborted) {
      throw new Error(`Tool execution aborted for '${toolName}'`);
    }

    let parsedInput: Record<string, unknown> = {};
    if (typeof input === "string") {
      const trimmed = input.trim();
      if (trimmed !== "") {
        try {
          parsedInput = JSON.parse(trimmed);
        } catch {
          throw new Error(`Invalid JSON input string for tool '${toolName}': ${trimmed}`);
        }
      }
    } else if (input && typeof input === "object") {
      parsedInput = input;
    }

    const rawResult = await entry.tool.execute(parsedInput, { signal: options?.signal });

    if (typeof rawResult === "string") {
      return rawResult;
    }

    return JSON.stringify(rawResult);
  }
}
