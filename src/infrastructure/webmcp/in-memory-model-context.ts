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
import type { WebMCPExecutionCoordinator } from "./execution-coordinator";

interface StoredToolEntry {
  readonly tool: ModelContextTool;
  readonly registeredTool: RegisteredTool;
}

function isToolInput(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export class InMemoryModelContext extends EventTarget implements ModelContext {
  private readonly tools: Map<string, StoredToolEntry> = new Map();

  constructor(private readonly coordinator?: WebMCPExecutionCoordinator) {
    super();
  }
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

    const effectiveTool = this.coordinator ? this.coordinator.wrapTool(tool) : tool;

    const registeredTool: RegisteredTool = {
      name: effectiveTool.name,
      title: effectiveTool.title,
      description: effectiveTool.description,
      inputSchema: effectiveTool.inputSchema,
      annotations: effectiveTool.annotations,
    };

    this.tools.set(effectiveTool.name, { tool: effectiveTool, registeredTool });
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

    if (!this.coordinator && options?.signal?.aborted) {
      throw new DOMException(`Tool execution aborted for '${toolName}'`, "AbortError");
    }

    let parsedInput: Record<string, unknown> = {};
    if (typeof input === "string") {
      const trimmed = input.trim();
      if (trimmed !== "") {
        let parsed: unknown;
        try {
          parsed = JSON.parse(trimmed);
        } catch {
          throw new Error(`Invalid JSON input string for tool '${toolName}': ${trimmed}`);
        }
        if (!isToolInput(parsed)) {
          throw new Error(`Tool input for '${toolName}' must be a JSON object`);
        }
        parsedInput = parsed;
      }
    } else {
      parsedInput = input;
    }

    const rawResult = this.coordinator
      ? await this.coordinator.executeTool(entry.tool, parsedInput, options)
      : await entry.tool.execute(parsedInput, { signal: options?.signal });

    if (typeof rawResult === "string") {
      return rawResult;
    }

    return JSON.stringify(rawResult) ?? "null";
  }
}
