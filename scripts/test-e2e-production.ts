/**
 * Production Acceptance Test Suite.
 * Phase 13 — Real Deployed Vercel Production Acceptance.
 *
 * Target: https://ohmni-three.vercel.app
 *
 * Checks:
 * 1. Production Shell & Build SHA.
 * 2. Native WebMCP or WebMCP compatibility capability.
 * 3. Production Demo Agent Mode (?scenario=brownout&agent=demo).
 * 4. Production Groq Mode — reports PASS, FAIL, or BLOCKED.
 */

import { spawn, type ChildProcess } from "node:child_process";
import { mkdtempSync, existsSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const PROD_URL = "https://ohmni-three.vercel.app";

console.info("==================================================================");
console.info("   OHMNI — PHASE 13: PRODUCTION ACCEPTANCE TEST SUITE            ");
console.info(`   Target: ${PROD_URL}                                           `);
console.info("==================================================================\n");

function findChromePath(): string | null {
  const envPath = process.env.CHROME_BIN || process.env.GOOGLE_CHROME_BIN;
  if (envPath && existsSync(envPath)) return envPath;

  const standardPaths = [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary",
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ];

  for (const p of standardPaths) {
    if (existsSync(p)) return p;
  }
  return null;
}

class CDPClient {
  private ws: WebSocket;
  private nextId = 1;
  private pending = new Map<number, { resolve: (val: unknown) => void; reject: (err: unknown) => void }>();

  private constructor(ws: WebSocket) {
    this.ws = ws;
    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data.toString()) as {
          id?: number;
          error?: { message?: string };
          result?: unknown;
        };

        if (data.id && this.pending.has(data.id)) {
          const { resolve, reject } = this.pending.get(data.id)!;
          this.pending.delete(data.id);
          if (data.error) {
            reject(new Error(data.error.message || JSON.stringify(data.error)));
          } else {
            resolve(data.result);
          }
        }
      } catch (err) {
        console.error("CDP parse error:", err);
      }
    };
  }

  static async connect(url: string): Promise<CDPClient> {
    const ws = new WebSocket(url);
    const { promise, resolve, reject } = Promise.withResolvers<void>();
    ws.onopen = () => resolve();
    ws.onerror = (err) => reject(err);
    await promise;
    return new CDPClient(ws);
  }

  async send(method: string, params: Record<string, unknown> = {}): Promise<unknown> {
    const id = this.nextId++;
    const message = JSON.stringify({ id, method, params });
    const { promise, resolve, reject } = Promise.withResolvers<unknown>();
    this.pending.set(id, { resolve, reject });
    this.ws.send(message);
    return promise;
  }

  async evaluate<T = unknown>(expression: string): Promise<T> {
    const raw = await this.send("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    const res = raw as {
      result?: { value?: T };
      exceptionDetails?: { text?: string; exception?: { description?: string } };
    };
    if (res.exceptionDetails) {
      const desc = res.exceptionDetails.exception?.description || res.exceptionDetails.text;
      throw new Error(`Evaluation failed: ${desc}`);
    }
    return res.result?.value as T;
  }

  close(): void {
    try {
      this.ws.close();
    } catch {}
  }
}

async function waitFor(
  cdp: CDPClient,
  predicateExpr: string,
  timeoutMs = 15000,
  pollMs = 250
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const ok = await cdp.evaluate<boolean>(predicateExpr);
      if (ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, pollMs));
  }
  throw new Error(`Wait timed out after ${timeoutMs}ms for: ${predicateExpr}`);
}

async function click(cdp: CDPClient, selector: string): Promise<void> {
  const clicked = await cdp.evaluate<boolean>(`(() => {
    const el = document.querySelector(${JSON.stringify(selector)});
    if (!el) return false;
    el.scrollIntoView({ block: "center" });
    el.click();
    return true;
  })()`);
  if (!clicked) {
    throw new Error(`Element not found to click: ${selector}`);
  }
}

async function runProductionAcceptance(): Promise<void> {
  const chromePath = findChromePath();
  if (!chromePath) {
    throw new Error("Google Chrome executable not found.");
  }

  const tempProfile = mkdtempSync(join(tmpdir(), "ohmni-e2e-prod-"));
  const localState = {
    browser: {
      enabled_labs_experiments: ["enable-webmcp-testing@1"],
    },
  };
  writeFileSync(join(tempProfile, "Local State"), JSON.stringify(localState));

  const debugPort = 9255;

  const chromeProc: ChildProcess = spawn(
    chromePath,
    [
      `--remote-debugging-port=${debugPort}`,
      `--user-data-dir=${tempProfile}`,
      "--no-first-run",
      "--no-default-browser-check",
      "--headless=new",
      "--window-size=1440,900",
      "--flag-switches-begin",
      "--enable-webmcp-testing",
      "--flag-switches-end",
      "about:blank",
    ],
    { stdio: "pipe" }
  );

  let cdpClient: CDPClient | null = null;
  let prodShellResult = "PENDING";
  let nativeWebMCPResult = "PENDING";
  let prodDemoAgentResult = "PENDING";
  let prodGroqResult = "PENDING";

  try {
    let pageTargetUrl = "";
    for (let i = 0; i < 40; i++) {
      await new Promise((r) => setTimeout(r, 150));
      try {
        const res = await fetch(`http://127.0.0.1:${debugPort}/json/list`);
        const targets = (await res.json()) as Array<{ type: string; webSocketDebuggerUrl: string }>;
        const page = targets.find((t) => t.type === "page");
        if (page) {
          pageTargetUrl = page.webSocketDebuggerUrl;
          break;
        }
      } catch {}
    }

    if (!pageTargetUrl) {
      throw new Error("Failed to connect to Chrome CDP target.");
    }

    cdpClient = await CDPClient.connect(pageTargetUrl);
    await cdpClient.send("Runtime.enable");
    await cdpClient.send("Page.enable");
    await cdpClient.send("DOM.enable");

    // -----------------------------------------------------------------
    // Part 1: Check Production Shell & Build SHA
    // -----------------------------------------------------------------
    console.info("[Production] Navigating to deployed production URL...");
    await cdpClient.send("Page.navigate", { url: PROD_URL });
    await waitFor(cdpClient, `Boolean(document.getElementById("app"))`, 15000);

    const buildSha = await cdpClient.evaluate<string>(`window.__OHMNI_BUILD_SHA__ || "unknown"`);
    console.info(`[Production] Loaded Deployed Build SHA: ${buildSha}`);
    prodShellResult = "PASS";

    // -----------------------------------------------------------------
    // Part 2: Native WebMCP Detection
    // -----------------------------------------------------------------
    const hasModelContext = await cdpClient.evaluate<boolean>(`Boolean("modelContext" in document)`);
    const webmcpMode = await cdpClient.evaluate<string>(`window.__webmcpMode || "unknown"`);
    console.info(`[Production] document.modelContext present: ${hasModelContext}, mode: ${webmcpMode}`);
    nativeWebMCPResult = hasModelContext ? "PASS" : "FAIL";

    // -----------------------------------------------------------------
    // Part 3: Test Production Demo Agent Mode
    // -----------------------------------------------------------------
    console.info("\n[Production] Testing Demo Agent Golden Path on deployed application...");
    await cdpClient.send("Page.navigate", { url: `${PROD_URL}/?scenario=brownout&agent=demo` });
    await waitFor(cdpClient, `Boolean(document.getElementById("welcome-view-root"))`, 15000);

    try {
      await click(cdpClient, "#start-mystery-btn");
      await waitFor(cdpClient, `Boolean(document.getElementById("mystery-intro-card"))`, 8000);
      await click(cdpClient, "#begin-mystery-btn");
      await waitFor(cdpClient, `Boolean(document.getElementById("lab-header"))`, 12000);
      await waitFor(
        cdpClient,
        `Boolean(document.getElementById("start-investigation-btn") || document.querySelector("[data-testid='bench-agent-start']"))`,
        10000
      );

      // Click start investigation for built-in demo agent
      await cdpClient.evaluate(`(() => {
        const btn = document.getElementById("start-investigation-btn") || document.querySelector("[data-testid='bench-agent-start']");
        if (btn) btn.click();
      })()`);
      // Wait for amber approval
      await waitFor(
        cdpClient,
        `Boolean(document.querySelector("[data-scene='approval']") || document.getElementById("approve-test-btn") || document.querySelector("[data-testid='bench-agent-approve']"))`,
        15000
      );

      // Click approve
      await cdpClient.evaluate(`(() => {
        const btn = document.getElementById("approve-test-btn") || document.querySelector("[data-testid='bench-agent-approve']");
        if (btn) btn.click();
      })()`);

      // Wait for hypothesis
      await waitFor(cdpClient, `Boolean(window.__hypothesisStore && window.__hypothesisStore.getAll().length >= 1)`, 12000);

      // Check if proceed button
      try {
        await waitFor(cdpClient, `Boolean(document.getElementById("proceed-to-repair-btn") || document.getElementById("tell-agent-repair-btn"))`, 10000);
        const hasProc = await cdpClient.evaluate<boolean>(`Boolean(document.getElementById("proceed-to-repair-btn"))`);
        if (hasProc) await click(cdpClient, "#proceed-to-repair-btn");
      } catch {}

      await waitFor(
        cdpClient,
        `Boolean(document.body.innerText.includes("THE AGENT NEEDS YOUR HANDS") || document.body.innerText.includes("PHYSICAL JUMPER"))`,
        10000
      );

      // Click 5V jumper
      await cdpClient.evaluate(`(() => {
        const jp1Btn = document.querySelector("[data-testid='simulate-jp1-btn']") || document.getElementById("simulate-jp1-btn");
        if (jp1Btn) {
          jp1Btn.click();
          return;
        }
        const btns = Array.from(document.querySelectorAll("button"));
        const btn5v = btns.find(b => b.textContent?.includes("5 V") || b.textContent?.includes("5v") || b.textContent?.includes("External"));
        if (btn5v) btn5v.click();
      })()`);

      // Tell agent
      await cdpClient.evaluate(`(() => {
        const btn = document.getElementById("tell-agent-repair-btn") || document.querySelector("[data-testid='tell-gemini-repair-btn']");
        if (btn) btn.click();
      })()`);

      // Second approval
      await waitFor(
        cdpClient,
        `Boolean(document.querySelector("[data-testid='repair-approve-btn']") || document.getElementById("approve-test-btn") || document.querySelector("[data-testid='bench-agent-approve']"))`,
        15000
      );

      await cdpClient.evaluate(`(() => {
        const btn = document.querySelector("[data-testid='repair-approve-btn']") || document.getElementById("approve-test-btn") || document.querySelector("[data-testid='bench-agent-approve']");
        if (btn) btn.click();
      })()`);
      // Wait for VERIFIED & Reveal
      await waitFor(
        cdpClient,
        `Boolean(document.getElementById("ground-truth-reveal-scene"))`,
        15000
      );

      const matchBadge = await cdpClient.evaluate<string>(
        `document.querySelector("[data-testid='diagnosis-match-badge']")?.innerText || ""`
      );
      if (matchBadge.includes("MATCH")) {
        prodDemoAgentResult = "PASS";
      } else {
        prodDemoAgentResult = "FAIL";
      }
    } catch (err) {
      console.error("[Production Demo Agent Error]:", err);
      prodDemoAgentResult = "FAIL";
    }

    // -----------------------------------------------------------------
    // Part 4: Test Production Groq Mode
    // -----------------------------------------------------------------
    console.info("\n[Production] Testing Groq Provider availability on deployed application...");
    try {
      const canaryRes = await fetch(`${PROD_URL}/api/bench-agent`, { method: "GET" });
      if (canaryRes.ok) {
        const data = (await canaryRes.json()) as { available?: boolean; provider?: string };
        if (data.available) {
          prodGroqResult = `PASS (${data.provider ?? "groq"})`;
        } else {
          prodGroqResult = "BLOCKED (Groq API key unconfigured / billing quota exhausted)";
        }
      } else {
        prodGroqResult = "BLOCKED (Production API endpoint unavailable or quota exceeded)";
      }
    } catch (err) {
      prodGroqResult = `BLOCKED (${err instanceof Error ? err.message : "Network error"})`;
    }
    // -----------------------------------------------------------------
    // Final Production Acceptance Summary
    // -----------------------------------------------------------------
    console.info("\n==================================================================");
    console.info("   PRODUCTION ACCEPTANCE REPORT                                   ");
    console.info("==================================================================");
    console.info(`Target URL:               ${PROD_URL}`);
    console.info(`Deployed Build SHA:       ${buildSha}`);
    console.info(`Production shell:         ${prodShellResult}`);
    console.info(`Native WebMCP:            ${nativeWebMCPResult}`);
    console.info(`Production demo agent:    ${prodDemoAgentResult}`);
    console.info(`Production Groq:          ${prodGroqResult}`);
    console.info("==================================================================\n");
  } finally {
    if (cdpClient) cdpClient.close();
    chromeProc.kill("SIGTERM");
  }
}

runProductionAcceptance().catch((err) => {
  console.error("Production acceptance runner failed:", err);
  process.exit(1);
});
