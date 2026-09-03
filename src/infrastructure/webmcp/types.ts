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
  readonly preApproved?: boolean;
  readonly origin?: "external" | "groq" | "demo" | "user";
}

export interface ModelContext {
  registerTool(
    tool: ModelContextTool,
    options?: ModelContextRegisterToolOptions
  ): Promise<void>;

  getTools(): Promise<readonly RegisteredTool[]>;

  executeTool(
    tool: RegisteredTool | string,
    input?: string | Record<string, unknown>,
    options?: ModelContextExecuteToolOptions
  ): Promise<unknown>;

  /** Optional lifecycle surface. Native WebMCP implementations may omit either method. */
  addEventListener?(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions,
  ): void;

  removeEventListener?(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | EventListenerOptions,
  ): void;
}

declare global {
  interface Document {
    readonly modelContext?: ModelContext;
  }
}
