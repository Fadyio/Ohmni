import { InMemoryModelContext } from "./in-memory-model-context";
import type {
  ModelContext,
  ModelContextExecuteToolOptions,
  ModelContextRegisterToolOptions,
  ModelContextTool,
  RegisteredTool,
} from "./types";

/**
 * Keeps the browser's native registration surface authoritative for external
 * discovery while providing the page agent with a stable execution mirror.
 * The native object is never replaced or patched.
 */
export class MirroredModelContext implements ModelContext {
  private readonly local = new InMemoryModelContext();

  public constructor(private readonly nativeContext: ModelContext) {}

  public async registerTool(
    tool: ModelContextTool,
    options?: ModelContextRegisterToolOptions,
  ): Promise<void> {
    await this.nativeContext.registerTool(tool, options);
    await this.local.registerTool(tool, options);
  }

  public getTools(): Promise<readonly RegisteredTool[]> {
    return this.local.getTools();
  }

  public executeTool(
    tool: RegisteredTool | string,
    input?: string | Record<string, unknown>,
    options?: ModelContextExecuteToolOptions,
  ): Promise<unknown> {
    return this.local.executeTool(tool, input, options);
  }

  public addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions,
  ): void {
    this.local.addEventListener(type, listener, options);
  }

  public removeEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | EventListenerOptions,
  ): void {
    this.local.removeEventListener(type, listener, options);
  }
}
