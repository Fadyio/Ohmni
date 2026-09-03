/**
 * Tool Safety Approval Gate.
 * Enforces human-in-the-loop authorization for Amber (physical actuation) tools
 * regardless of whether the calling agent is an external WebMCP agent (ChatGPT, Codex),
 * the built-in Groq agent, or a deterministic walkthrough.
 *
 * Invariants:
 * 1. Tool promise MUST NOT resolve until human operator explicitly approves or denies.
 * 2. Hardware actuation MUST NOT occur while approval is pending.
 * 3. Denial safely resolves or rejects without side effects on physical state.
 * 4. Cancellation/abort cleans up pending state immediately.
 */

export interface ToolApprovalRequest {
  readonly id: string;
  readonly toolName: string;
  readonly toolTitle?: string;
  readonly input: Record<string, unknown>;
  readonly why: string;
  readonly whatWillHappen: string;
  readonly safetyLimits: string;
  readonly timestamp: number;
}

export interface ToolApprovalDecision {
  readonly approved: boolean;
  readonly reason?: string;
}

export class ToolApprovalGate {
  private pendingRequest: ToolApprovalRequest | null = null;
  private pendingResolver: ((decision: ToolApprovalDecision) => void) | null = null;
  private pendingRejecter: ((reason?: unknown) => void) | null = null;
  private pendingAbortCleanup: (() => void) | null = null;
  private readonly listeners: Set<(pending: ToolApprovalRequest | null) => void> = new Set();

  public hasPendingApproval(): boolean {
    return this.pendingRequest !== null;
  }

  public getPendingApproval(): ToolApprovalRequest | null {
    return this.pendingRequest;
  }

  /**
   * Requests human operator authorization for a tool invocation.
   * Returns a promise that only settles when approve() or deny() is called,
   * or when the AbortSignal signals cancellation.
   */
  public async requestApproval(
    details: Omit<ToolApprovalRequest, "id" | "timestamp">,
    signal?: AbortSignal
  ): Promise<ToolApprovalDecision> {
    if (signal?.aborted) {
      throw new DOMException("Operation aborted by caller", "AbortError");
    }

    this.settlePending({
      approved: false,
      reason: "Superseded by new approval request",
    });

    const request: ToolApprovalRequest = {
      ...details,
      id: `approval-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: Date.now(),
    };

    return new Promise<ToolApprovalDecision>((resolve, reject) => {
      this.pendingRequest = request;
      this.pendingResolver = resolve;
      this.pendingRejecter = reject;
      if (signal) {
        const onAbort = () => {
          if (this.pendingRequest?.id !== request.id) return;

          const rejecter = this.pendingRejecter;
          this.clearPending();
          rejecter?.(new DOMException("Operation aborted by caller", "AbortError"));
        };
        signal.addEventListener("abort", onAbort, { once: true });
        this.pendingAbortCleanup = () => {
          signal.removeEventListener("abort", onAbort);
        };
      }

      this.notifyListeners();
    });
  }

  public approve(requestId?: string): boolean {
    if (!this.pendingRequest || !this.pendingResolver) return false;
    if (requestId && this.pendingRequest.id !== requestId) return false;

    this.settlePending({ approved: true });
    return true;
  }

  public deny(requestId?: string, reason: string = "Operator denied authorization"): boolean {
    if (!this.pendingRequest || !this.pendingResolver) return false;
    if (requestId && this.pendingRequest.id !== requestId) return false;

    this.settlePending({ approved: false, reason });
    return true;
  }

  public subscribe(listener: (pending: ToolApprovalRequest | null) => void): () => void {
    this.listeners.add(listener);
    listener(this.pendingRequest);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private settlePending(decision: ToolApprovalDecision): void {
    const resolver = this.pendingResolver;
    if (!resolver) return;

    this.clearPending();
    resolver(decision);
  }

  private clearPending(): void {
    this.pendingAbortCleanup?.();
    this.pendingAbortCleanup = null;
    this.pendingRequest = null;
    this.pendingResolver = null;
    this.pendingRejecter = null;
    this.notifyListeners();
  }

  private notifyListeners(): void {
    for (const listener of this.listeners) {
      try {
        listener(this.pendingRequest);
      } catch (err) {
        console.error("[ToolApprovalGate] Listener error:", err);
      }
    }
  }

  public reset(): void {
    this.settlePending({ approved: false, reason: "Session reset" });
  }
}
