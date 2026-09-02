/**
 * TypeScript definitions for the WebMCP (Web Model Context Protocol) specification.
 * Corresponds to document.modelContext.
 */

export interface ToolAnnotations {
  readonly readOnlyHint?: boolean;
  readonly untrustedContentHint?: boolean;
}

export interface ModelContextTool {
  readonly name: string;
  readonly title?: string;
  readonly description: string;
  readonly inputSchema?: Record<string, unknown>;
  readonly annotations?: ToolAnnotations;
  execute(
    input: Record<string, unknown>,
    options?: { signal?: AbortSignal }
  ): Promise<unknown>;
}

export interface RegisteredTool {
  readonly name: string;
  readonly title?: string;
  readonly description: string;
  readonly inputSchema?: Record<string, unknown>;
  readonly annotations?: ToolAnnotations;
}

export interface ModelContextRegisterToolOptions {
  readonly signal?: AbortSignal;
}

export interface ModelContextExecuteToolOptions {
  readonly signal?: AbortSignal;
}

export interface ModelContext extends EventTarget {
  registerTool(
    tool: ModelContextTool,
    options?: ModelContextRegisterToolOptions
  ): Promise<void>;

  getTools(): Promise<readonly RegisteredTool[]>;

  executeTool(
    tool: RegisteredTool,
    input?: string | Record<string, unknown>,
    options?: ModelContextExecuteToolOptions
  ): Promise<string>;
}

declare global {
  interface Document {
    readonly modelContext?: ModelContext;
  }
}
