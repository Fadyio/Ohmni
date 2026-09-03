/**
 * Domain-level Investigation Tool Ledger.
 * Records every tool invocation and outcome regardless of whether the agent
 * is external WebMCP (ChatGPT, Claude, Codex), built-in Groq, or deterministic demo.
 *
 * Provides a truthful, unified domain record that drives UI timeline,
 * diagnostic state derivation, and auditability.
 */

export type ToolExecutionStatus =
  | "requested"
  | "waiting-approval"
  | "running"
  | "completed"
  | "failed"
  | "denied";

export type ToolExecutionOrigin = "external" | "groq" | "demo" | "user";

export interface ToolLedgerEntry {
  readonly id: string;
  readonly toolName: string;
  readonly input: Record<string, unknown>;
  readonly status: ToolExecutionStatus;
  readonly result?: unknown;
  readonly error?: string;
  readonly timestamp: number;
  readonly durationMs?: number;
  readonly origin: ToolExecutionOrigin;
}

export class InvestigationToolLedger {
  private readonly entries: ToolLedgerEntry[] = [];
  private readonly listeners: Set<() => void> = new Set();

  public getEntries(): readonly ToolLedgerEntry[] {
    return this.entries;
  }

  public getCompletedEntries(): readonly ToolLedgerEntry[] {
    return this.entries.filter((e) => e.status === "completed");
  }

  public getActiveEntry(): ToolLedgerEntry | undefined {
    return this.entries.find(
      (e) => e.status === "requested" || e.status === "waiting-approval" || e.status === "running"
    );
  }

  public hasExecuted(toolName: string): boolean {
    return this.entries.some((e) => e.toolName === toolName && e.status === "completed");
  }

  public getLatestResult(toolName: string): unknown {
    const completed = this.entries.filter((e) => e.toolName === toolName && e.status === "completed");
    return completed.length > 0 ? completed[completed.length - 1].result : undefined;
  }

  public recordStart(
    toolName: string,
    input: Record<string, unknown>,
    origin: ToolExecutionOrigin = "external"
  ): string {
    const id = `tl-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    this.entries.push({
      id,
      toolName,
      input,
      status: "requested",
      timestamp: Date.now(),
      origin,
    });
    this.notifyListeners();
    return id;
  }

  public recordWaitingApproval(id: string): void {
    const idx = this.entries.findIndex((e) => e.id === id);
    if (idx !== -1) {
      this.entries[idx] = { ...this.entries[idx], status: "waiting-approval" };
      this.notifyListeners();
    }
  }

  public recordRunning(id: string): void {
    const idx = this.entries.findIndex((e) => e.id === id);
    if (idx !== -1) {
      this.entries[idx] = { ...this.entries[idx], status: "running" };
      this.notifyListeners();
    }
  }

  public recordCompleted(id: string, result: unknown, durationMs: number): void {
    const idx = this.entries.findIndex((e) => e.id === id);
    if (idx !== -1) {
      this.entries[idx] = { ...this.entries[idx], status: "completed", result, durationMs };
      this.notifyListeners();
    }
  }

  public recordDenied(id: string, result: unknown, durationMs: number): void {
    const idx = this.entries.findIndex((e) => e.id === id);
    if (idx !== -1) {
      this.entries[idx] = { ...this.entries[idx], status: "denied", result, durationMs };
      this.notifyListeners();
    }
  }

  public recordFailed(id: string, error: string, durationMs: number): void {
    const idx = this.entries.findIndex((e) => e.id === id);
    if (idx !== -1) {
      this.entries[idx] = { ...this.entries[idx], status: "failed", error, durationMs };
      this.notifyListeners();
    }
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(): void {
    for (const listener of this.listeners) {
      try {
        listener();
      } catch (err) {
        console.error("[InvestigationToolLedger] Listener error:", err);
      }
    }
  }

  public reset(): void {
    this.entries.length = 0;
    this.notifyListeners();
  }
}
