import React from "react";

const DIAGNOSTIC_CODE = "OHMNI-WEBMCP-INIT-01";

export function AppInitializationFailure(): React.ReactElement {
  const reload = (): void => window.location.reload();
  const openWalkthrough = (): void => {
    const url = new URL(window.location.href);
    url.searchParams.set("agent", "demo");
    url.searchParams.set("scenario", "brownout");
    window.location.assign(url.toString());
  };

  return (
    <main
      role="alert"
      data-testid="app-initialization-failure"
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: "2rem",
        background: "#F5F6F8",
        color: "#12151A",
        boxSizing: "border-box",
      }}
    >
      <section style={{ width: "min(100%, 36rem)" }}>
        <img src="/brand/ohmni-logo.svg" alt="OHMNI" style={{ height: 28 }} />
        <h1 style={{ margin: "2rem 0 0.75rem", fontSize: "1.75rem" }}>
          Ohmni could not initialize the browser tool interface.
        </h1>
        <p style={{ color: "#525866", lineHeight: 1.6 }}>
          Reload to retry native WebMCP initialization, or open the deterministic walkthrough.
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", marginTop: "1.5rem" }}>
          <button type="button" className="btn-primary" onClick={reload}>Reload Ohmni</button>
          <button type="button" className="btn-secondary" onClick={openWalkthrough}>
            Deterministic walkthrough
          </button>
        </div>
        <p className="font-mono" style={{ marginTop: "1.5rem", color: "#6B7280", fontSize: "0.75rem" }}>
          Diagnostic: {DIAGNOSTIC_CODE}
        </p>
      </section>
    </main>
  );
}

interface State {
  readonly failed: boolean;
}

export class AppErrorBoundary extends React.Component<React.PropsWithChildren, State> {
  public state: State = { failed: false };

  public static getDerivedStateFromError(): State {
    return { failed: true };
  }

  public componentDidCatch(error: Error): void {
    console.error(`[Ohmni:${DIAGNOSTIC_CODE}] Application initialization failed`, error);
  }

  public render(): React.ReactNode {
    return this.state.failed ? <AppInitializationFailure /> : this.props.children;
  }
}
