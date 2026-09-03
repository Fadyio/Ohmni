import React from "react";
import { describe, expect, it } from "bun:test";
import { renderToString } from "react-dom/server";
import { AppInitializationFailure } from "@/presentation/components/errors/AppErrorBoundary";

describe("application initialization recovery", () => {
  it("renders recovery actions and a diagnostic instead of a blank screen", () => {
    const html = renderToString(<AppInitializationFailure />);

    expect(html).toContain("Ohmni could not initialize the browser tool interface.");
    expect(html).toContain("Reload Ohmni");
    expect(html).toContain("Deterministic walkthrough");
    expect(html).toContain("OHMNI-WEBMCP-INIT-01");
  });
});
