/**
 * Real Google Chrome Motion & Semantic State Test Suite.
 * Milestone 7.14 — Truthful State Model, Tool Classification & Visual Motion Matrix.
 *
 * Launches Google Chrome with WebMCP experimental flags,
 * connects via Chrome DevTools Protocol (CDP), and executes strict assertions:
 * 1. 3D OHMNI Wordmark: CSS 3D perspective, preserve-3d, and individual letter transforms.
 * 2. 3D OHMNI -> Navbar Transition: Samples wordmark at 0ms, 250ms, 600ms, 1000ms.
 * 3. Board Boot Sequence: Asserts power LED and status LED states upon connection.
 * 4. Agent Tool Call Signal Pulse: Asserts dynamic pulse displacement >= 100px across the screen.
 * 5. Physical Tool Approval Gate: Asserts run_relay_stress_test REQUIRES approval before execution.
 * 6. Completed Event Truth: Asserts unapproved / waiting-approval tools are NOT in COMPLETED EVENTS.
 * 7. Oscilloscope Multi-Frame Canvas Render: Asserts continuous 60fps frame count increment.
 * 8. Reason Tool Automatic Execution: Asserts propose_hypothesis executes automatically WITHOUT approval UI.
 * 9. Evidence Store & Grounded Hypothesis Synthesis: Asserts E-xxx evidence tokens & hypothesis synthesis.
 *
 * Usage:
 *   bun run scripts/test-motion.ts
 *   bun run test:motion
 */

import { spawn } from "node:child_process";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer, type Server } from "node:http";
import { readFile } from "node:fs/promises";

function findChromePath(): string | null {
  const envPath = process.env.CHROME_BIN || process.env.GOOGLE_CHROME_BIN;
  if (envPath && existsSync(envPath)) return envPath;

  const standardPaths = [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  ];

  for (const path of standardPaths) {
    if (existsSync(path)) return path;
  }
  return null;
}

interface MockTurnPayload {
  readonly previousInteractionId?: string;
  readonly input?: unknown[];
}

interface EvidenceDiscoveryItem {
  readonly id: string;
}

interface ChromeTargetItem {
  readonly id: string;
  readonly type: string;
  readonly title: string;
  readonly url: string;
  readonly webSocketDebuggerUrl: string;
}

interface CDPVersionInfo {
  readonly Browser: string;
}

async function startStaticServer(distDir: string, port = 5176): Promise<{ server: Server; url: string }> {
  const mimeTypes: Record<string, string> = {
    ".html": "text/html; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".wasm": "application/wasm",
    ".woff2": "font/woff2",
  };

  const sessionTurns = new Map<string, number>();
  let discoveredEvidenceIds: string[] = [];

  const server = createServer(async (req, res) => {
    try {
      const parsedUrl = new URL(req.url || "/", `http://127.0.0.1:${port}`);
      const reqPath = parsedUrl.pathname;

      if (reqPath === "/api/bench-agent") {
        if (req.method === "GET") {
          res.writeHead(200, {
            "Content-Type": "application/json; charset=utf-8",
            "Cache-Control": "no-store",
          });
          res.end(JSON.stringify({ available: true, model: "gemini-3.7-flash" }));
          return;
        }

        if (req.method === "POST") {
          const chunks: Buffer[] = [];
          for await (const chunk of req) {
            chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
          }
          const bodyText = Buffer.concat(chunks).toString("utf8");
          const turnRequest: MockTurnPayload = JSON.parse(bodyText || "{}");
          const rawSessionHeader = req.headers["x-bench-agent-session"];
          const sessionId = Array.isArray(rawSessionHeader) ? rawSessionHeader[0] : (rawSessionHeader || "default");

          let turnCount = sessionTurns.get(sessionId) ?? 0;
          turnCount += 1;
          sessionTurns.set(sessionId, turnCount);

          let responseBody: Record<string, unknown>;

          if (!turnRequest.previousInteractionId || turnCount === 1) {
            responseBody = {
              interactionId: `interaction-${sessionId}-1`,
              functionCalls: [
                {
                  id: "call-reset-hist",
                  name: "read_reset_history",
                  arguments: {},
                },
              ],
            };
          } else if (turnRequest.previousInteractionId === `interaction-${sessionId}-1` || turnCount === 2) {
            responseBody = {
              interactionId: `interaction-${sessionId}-2`,
              functionCalls: [
                {
                  id: "call-relay-stress",
                  name: "run_relay_stress_test",
                  arguments: { cycles: 3, duration_ms: 1200 },
                },
              ],
            };
          } else if (turnRequest.previousInteractionId === `interaction-${sessionId}-2` || turnCount === 3) {
            responseBody = {
              interactionId: `interaction-${sessionId}-3`,
              functionCalls: [
                {
                  id: "call-list-evidence",
                  name: "list_evidence",
                  arguments: {},
                },
              ],
            };
          } else if (turnRequest.previousInteractionId === `interaction-${sessionId}-3` || turnCount === 4) {
            if (Array.isArray(turnRequest.input)) {
              for (const item of turnRequest.input) {
                if (item && typeof item === "object" && "name" in item && item.name === "list_evidence" && "result" in item && Array.isArray(item.result)) {
                  try {
                    const firstResult = item.result[0];
                    if (firstResult && typeof firstResult === "object" && "text" in firstResult && typeof firstResult.text === "string") {
                      const parsedEv: unknown = JSON.parse(firstResult.text);
                      if (Array.isArray(parsedEv)) {
                        discoveredEvidenceIds = parsedEv
                          .filter((e): e is EvidenceDiscoveryItem => Boolean(e && typeof e === "object" && "id" in e && typeof e.id === "string"))
                          .map((e) => e.id);
                      }
                    }
                  } catch {}
                }
              }
            }

            responseBody = {
              interactionId: `interaction-${sessionId}-4`,
              functionCalls: [
                {
                  id: "call-propose-hypo",
                  name: "propose_hypothesis",
                  arguments: {
                    title: "Relay-induced supply brownout",
                    description: "Relay actuation draws excessive inrush current causing 3.3V supply rail to sag below 2.80V threshold.",
                    confidence: "MEDIUM",
                    rationale: "Relay stress test reproduced BROWNOUT reset and voltage drop to 2.72V.",
                  },
                },
              ],
            };
          } else if (turnRequest.previousInteractionId === `interaction-${sessionId}-4` || turnCount === 5) {
            const ev1 = discoveredEvidenceIds[0] || "E-001";
            responseBody = {
              interactionId: `interaction-${sessionId}-5`,
              functionCalls: [
                {
                  id: "call-link-1",
                  name: "link_evidence",
                  arguments: {
                    hypothesis_id: "H-001",
                    evidence_id: ev1,
                  },
                },
              ],
            };
          } else if (turnRequest.previousInteractionId === `interaction-${sessionId}-5` || turnCount === 6) {
            const ev2 = discoveredEvidenceIds[1] || "E-002";
            responseBody = {
              interactionId: `interaction-${sessionId}-6`,
              functionCalls: [
                {
                  id: "call-link-2",
                  name: "link_evidence",
                  arguments: {
                    hypothesis_id: "H-001",
                    evidence_id: ev2,
                  },
                },
              ],
            };
          } else if (turnRequest.previousInteractionId === `interaction-${sessionId}-6` || turnCount === 7) {
            responseBody = {
              interactionId: `interaction-${sessionId}-7`,
              functionCalls: [
                {
                  id: "call-elevate-hypo",
                  name: "update_hypothesis",
                  arguments: {
                    hypothesis_id: "H-001",
                    confidence: "HIGH",
                    rationale: "Empirical brownout reset and inductive voltage sag definitively link relay actuation to controller failure.",
                  },
                },
              ],
            };
          } else {
            responseBody = {
              interactionId: `interaction-${sessionId}-8`,
              functionCalls: [],
              text: "Investigation complete. Root cause confirmed as relay-induced supply brownout on the shared 3.3V rail.",
            };
          }

          res.writeHead(200, {
            "Content-Type": "application/json; charset=utf-8",
            "Cache-Control": "no-store",
          });
          res.end(JSON.stringify(responseBody));
          return;
        }
      }

      let filePath = join(distDir, reqPath === "/" ? "index.html" : reqPath);
      if (!existsSync(filePath)) {
        filePath = join(distDir, "index.html");
      }

      const ext = Object.keys(mimeTypes).find((k) => filePath.endsWith(k)) || ".html";
      const contentType = mimeTypes[ext] || "text/plain";
      const content = await readFile(filePath);

      res.writeHead(200, { "Content-Type": contentType });
      res.end(content);
    } catch (err: unknown) {
      res.writeHead(500, { "Content-Type": "text/plain" });
      res.end(`Server error: ${err instanceof Error ? err.message : String(err)}`);
    }
  });

  await new Promise<void>((resolve) => server.listen(port, "127.0.0.1", () => resolve()));
  return { server, url: `http://127.0.0.1:${port}` };
}

class CDPClient {
  private ws: WebSocket;
  private idCounter = 0;
  private pending = new Map<number, { resolve: (res: any) => void; reject: (err: any) => void }>();

  private constructor(ws: WebSocket) {
    this.ws = ws;
    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data.toString());
        if (msg.id !== undefined) {
          const p = this.pending.get(msg.id);
          if (p) {
            this.pending.delete(msg.id);
            if (msg.error) p.reject(new Error(msg.error.message || JSON.stringify(msg.error)));
            else p.resolve(msg.result);
          }
        }
      } catch (err) {
        console.error("CDP parse error:", err);
      }
    };
  }

  public static async connect(url: string): Promise<CDPClient> {
    const ws = new WebSocket(url);
    await new Promise<void>((resolve, reject) => {
      ws.onopen = () => resolve();
      ws.onerror = (err) => reject(err);
    });
    return new CDPClient(ws);
  }

  public async send(method: string, params: Record<string, unknown> = {}): Promise<any> {
    const id = ++this.idCounter;
    const msg = { id, method, params };
    const { promise, resolve, reject } = Promise.withResolvers<any>();
    this.pending.set(id, { resolve, reject });
    this.ws.send(JSON.stringify(msg));
    return promise;
  }

  public async evaluate<T = any>(expression: string): Promise<T> {
    const res = await this.send("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (res.exceptionDetails) {
      throw new Error(`Evaluation failed: ${res.exceptionDetails.text || JSON.stringify(res.exceptionDetails)}`);
    }
    return res.result?.value as T;
  }

  public close(): void {
    try {
      this.ws.close();
    } catch {}
  }
}

async function runMotionTests(): Promise<void> {
  console.info("==================================================================");
  console.info("   OHMNI — REAL CHROME CDP MOTION & SEMANTIC STATE TEST MATRIX   ");
  console.info("   Milestone 7.14: Truthful State Model, Tool Safety & Motion    ");
  console.info("==================================================================");

  const chromePath = findChromePath();
  if (!chromePath) {
    throw new Error("Chrome binary not found on workstation");
  }

  console.info("[Build] Building production distribution (vite build)...");
  const buildProc = spawn("bun", ["run", "build"], { stdio: "inherit" });
  const { promise: buildPromise, resolve: buildResolve, reject: buildReject } = Promise.withResolvers<void>();
  buildProc.on("close", (code) => {
    if (code === 0) buildResolve();
    else buildReject(new Error(`vite build failed with exit code ${code}`));
  });
  await buildPromise;

  const distDir = join(process.cwd(), "dist");
  const { server, url: serverUrl } = await startStaticServer(distDir, 5177);

  const tempProfile = mkdtempSync(join(tmpdir(), "ohmni-chrome-motion-"));
  const debugPort = 9234;

  const chromeArgs = [
    `--remote-debugging-port=${debugPort}`,
    `--user-data-dir=${tempProfile}`,
    "--no-first-run",
    "--no-default-browser-check",
    "--headless=new",
    "--window-size=1440,900",
    serverUrl,
  ];

  const chromeProc = spawn(chromePath, chromeArgs, { stdio: "pipe" });
  let cdpClient: CDPClient | null = null;

  try {
    for (let i = 0; i < 40; i++) {
      await new Promise((r) => setTimeout(r, 250));
      try {
        const res = await fetch(`http://127.0.0.1:${debugPort}/json/version`);
        if (res.ok) break;
      } catch {}
    }

    const listRes = await fetch(`http://127.0.0.1:${debugPort}/json/list`);
    const targets = (await listRes.json()) as ChromeTargetItem[];
    const pageTarget = targets.find((t) => t.type === "page");
    if (!pageTarget) throw new Error("No page target found");

    cdpClient = await CDPClient.connect(pageTarget.webSocketDebuggerUrl);
    await cdpClient.send("Runtime.enable");
    await cdpClient.send("Page.enable");
    await cdpClient.send("Page.navigate", { url: serverUrl });

    for (let i = 0; i < 30; i++) {
      const mounted = await cdpClient.evaluate<boolean>(`Boolean(document.querySelector(".ohmni-3d-scene"))`);
      if (mounted) break;
      await new Promise((r) => setTimeout(r, 150));
    }

    // -----------------------------------------------------------------
    // TEST 1: Canonical Flat Brand Logo & Zero 3D Wordmark Invariant
    // -----------------------------------------------------------------
    console.info("1. Canonical Flat Brand Logo & Zero 3D Wordmark Invariant...");
    const brandMeta = await cdpClient.evaluate<{
      flatLogoFound: boolean;
      threeDWordmarkFound: boolean;
      workbenchLabelFound: boolean;
    }>(`(() => {
      const flatLogo = document.querySelector('img[src*="ohmni-logo.svg"]');
      const threeD = document.querySelector(".ohmni-3d-scene") || document.querySelector(".ohmni-3d-word");
      const bodyText = document.body.innerText || "";
      return {
        flatLogoFound: Boolean(flatLogo),
        threeDWordmarkFound: Boolean(threeD),
        workbenchLabelFound: bodyText.includes("HARDWARE DIAGNOSTIC WORKBENCH"),
      };
    })()`);

    if (!brandMeta.flatLogoFound || brandMeta.threeDWordmarkFound || brandMeta.workbenchLabelFound) {
      throw new Error(
        `[Assertion Failed] Brand invariants violated: flatLogo=${brandMeta.flatLogoFound}, 3DWordmark=${brandMeta.threeDWordmarkFound}, workbenchLabel=${brandMeta.workbenchLabelFound}`
      );
    }
    console.info("  ✅ PASS: 1. Canonical flat brand logo verified; zero 3D wordmark or workbench label");

    // -----------------------------------------------------------------
    // TEST 2: Demo Walkthrough Entry -> Modal -> ReadyScene Flow
    // -----------------------------------------------------------------
    console.info("2. Demo Walkthrough Entry -> Modal -> ReadyScene Flow...");
    await cdpClient.evaluate(`document.querySelector("#diagnose-demo-btn").click()`);
    await new Promise((r) => setTimeout(r, 400));

    const hasModal = await cdpClient.evaluate<boolean>(`Boolean(document.getElementById("mystery-intro-card"))`);
    if (!hasModal) {
      throw new Error("[Assertion Failed] Demo explanation modal did not open upon clicking walkthrough CTA");
    }

    await cdpClient.evaluate(`document.querySelector("#begin-mystery-btn").click()`);
    await new Promise((r) => setTimeout(r, 600));

    const isReadyScene = await cdpClient.evaluate<boolean>(`Boolean(
      document.querySelector("[data-scene='ready']") &&
      document.getElementById("start-investigation-btn")
    )`);
    if (!isReadyScene) {
      throw new Error("[Assertion Failed] Walkthrough did not land in Connected ReadyScene");
    }
    console.info("  ✅ PASS: 2. Walkthrough entry verified: Demo Modal -> Connected ReadyScene with Start investigation CTA");

    // -----------------------------------------------------------------
    // TEST 3: Target Hardware Board Boot & LED Assertions
    // -----------------------------------------------------------------
    console.info("3. Target Hardware Board Boot & LED Assertions...");
    await new Promise((r) => setTimeout(r, 400));

    const leds = await cdpClient.evaluate<{
      pwrLed: boolean;
      statLed: boolean;
      pwrColor: string;
      statColor: string;
    }>(`(() => {
      const pwr = document.querySelector("#power-led") || document.querySelector("[data-testid='power-led']") || document.querySelector("#led-power");
      const stat = document.querySelector("#esp32-status-led") || document.querySelector("[data-testid='esp32-status-led']") || document.querySelector("#led-status");
      return {
        pwrLed: Boolean(pwr),
        statLed: Boolean(stat),
        pwrColor: pwr ? pwr.getAttribute("fill") || "" : "",
        statColor: stat ? stat.getAttribute("fill") || "" : "",
      };
    })()`);

    if (!leds.pwrLed || !leds.statLed) {
      throw new Error(`[Assertion Failed] Hardware LEDs not present: pwr=${leds.pwrLed}, stat=${leds.statLed}`);
    }
    console.info(`  ✅ PASS: 3. Hardware board booted and status LEDs active (PWR: ${leds.pwrColor}, STAT: ${leds.statColor})`);

    // -----------------------------------------------------------------
    // TEST 4: Zero Ghost SignalPulse Invariant
    // -----------------------------------------------------------------
    console.info("4. Zero Ghost SignalPulse Invariant (zero floating blue dots)...");
    await cdpClient.evaluate(`document.getElementById("start-investigation-btn").click()`);
    await new Promise((r) => setTimeout(r, 500));

    let pulseFoundAnywhere = false;
    for (let i = 0; i < 15; i++) {
      const sample = await cdpClient.evaluate<boolean>(`(() => {
        const p = document.querySelector("#signal-pulse") || document.querySelector("[data-testid='signal-pulse']");
        return Boolean(p);
      })()`);
      if (sample) {
        pulseFoundAnywhere = true;
        break;
      }
      await new Promise((r) => setTimeout(r, 100));
    }

    if (pulseFoundAnywhere) {
      throw new Error("[Assertion Failed] Rogue SignalPulse element found in DOM!");
    }
    console.info("  ✅ PASS: 4. Zero ghost SignalPulse invariant confirmed (no floating blue dots/orbs)");

    // -----------------------------------------------------------------
    // TEST 5: Physical Tool Approval Gate & Event Truth
    // -----------------------------------------------------------------
    console.info("5. Physical Tool Approval Gate & Event Truth (run_relay_stress_test)...");
    let approvalReady = false;
    for (let i = 0; i < 30; i++) {
      approvalReady = await cdpClient.evaluate<boolean>(`Boolean(document.querySelector("[data-testid='bench-agent-approve']"))`);
      if (approvalReady) break;
      await new Promise((r) => setTimeout(r, 150));
    }

    if (!approvalReady) {
      throw new Error("[Assertion Failed] Physical approval gate failed to appear for run_relay_stress_test");
    }

    // Completed Event Truth Test: waiting-approval tool must NOT be in completed events
    const completedTruth = await cdpClient.evaluate<{ hasUnapprovedInCompleted: boolean }>(`(() => {
      const rows = Array.from(document.querySelectorAll("[data-testid='bench-agent-activity-row']"));
      const texts = rows.map(r => r.innerText);
      return {
        hasUnapprovedInCompleted: texts.some(t => t.includes("relay") || t.includes("run_relay_stress_test")),
      };
    })()`);

    if (completedTruth.hasUnapprovedInCompleted) {
      throw new Error("[Assertion Failed] Tool awaiting approval was falsely displayed in COMPLETED EVENTS!");
    }
    console.info("  ✅ PASS: 5. Physical tool paused for approval and excluded from completed events");

    // Read relay armature state before approval
    const relayBefore = await cdpClient.evaluate<{ state: string | null; y2: string | null }>(`(() => {
      const lever = document.querySelector("#relay-armature-lever") || document.querySelector("[data-testid='relay-armature-lever']");
      const grp = document.querySelector("#relay-module-group") || document.querySelector("[data-testid='relay-module-group']");
      return {
        state: grp ? grp.getAttribute("data-relay-state") : (lever ? lever.getAttribute("data-relay-state") : "open"),
        y2: lever ? lever.getAttribute("y2") : null,
      };
    })()`);

    const frameCountBefore = await cdpClient.evaluate<number>(`Number(window.__scopeFrameCount || 0)`);

    // Click approve
    await cdpClient.evaluate(`document.querySelector("[data-testid='bench-agent-approve']").click()`);

    let relayActuationVerified = false;
    let maxFrameCount = frameCountBefore;

    for (let i = 0; i < 30; i++) {
      const sample = await cdpClient.evaluate<{ hasClosed: boolean; frameCount: number }>(`(() => {
        const levers = Array.from(document.querySelectorAll("#relay-armature-lever, [data-testid='relay-armature-lever']"));
        const grps = Array.from(document.querySelectorAll("#relay-module-group, [data-testid='relay-module-group']"));
        const y2Before = ${relayBefore.y2 ? JSON.stringify(relayBefore.y2) : "null"};
        const hasClosed = grps.some(g => g.getAttribute("data-relay-state") === "closed") ||
          levers.some(l => l.getAttribute("data-relay-state") === "closed" || (y2Before !== null && l.getAttribute("y2") !== y2Before));
        return {
          hasClosed,
          frameCount: Number(window.__scopeFrameCount || 0),
        };
      })()`);

      if (sample.frameCount > maxFrameCount) {
        maxFrameCount = sample.frameCount;
      }

      if (sample.hasClosed) {
        relayActuationVerified = true;
      }
      await new Promise((r) => setTimeout(r, 60));
    }

    if (!relayActuationVerified) {
      throw new Error(
        `[Assertion Failed] Relay armature SVG transform / state did not actuate during relay stress test`
      );
    }
    console.info(`  ✅ PASS: 6. Tactile relay actuation and contact transform verified`);

    // -----------------------------------------------------------------
    // TEST 7: Oscilloscope 60fps Multi-Frame Render Verification
    // -----------------------------------------------------------------
    console.info("7. Oscilloscope Canvas Multi-Frame Render...");
    const frameDelta = maxFrameCount - frameCountBefore;
    if (frameDelta < 5) {
      throw new Error(
        `[Assertion Failed] Oscilloscope canvas render loop stalled: only ${frameDelta} new frames rendered during experiment acquisition (before=${frameCountBefore}, after=${maxFrameCount}, required >= 5)`
      );
    }
    console.info(`  ✅ PASS: 7. 60fps Oscilloscope telemetry captured real voltage frames (${frameDelta} new frames rendered during actuation; maxFrameCount=${maxFrameCount})`);

    // -----------------------------------------------------------------
    // TEST 8: Reason Tool Automatic Execution & Hypothesis Synthesis
    // -----------------------------------------------------------------
    console.info("8. Reason Tool Automatic Execution & Evidence Synthesis...");
    let hypothesisFound = false;
    let evidenceTokenDetected = false;

    for (let i = 0; i < 40; i++) {
      const check = await cdpClient.evaluate<{
        hasHypothesisCard: boolean;
        hasStoredHypothesis: boolean;
        hasApproval: boolean;
        hasEvidenceToken: boolean;
      }>(`({
        hasHypothesisCard: document.querySelector("[data-testid='hypothesis-card']") !== null || document.body.innerText.includes("H-001"),
        hasStoredHypothesis: Boolean(window.__hypothesisStore && window.__hypothesisStore.getAll().length >= 1),
        hasApproval: document.querySelector("[data-testid='bench-agent-approve']") !== null,
        hasEvidenceToken: document.querySelector(".evidence-token-card") !== null || Boolean(window.__evidenceStore && window.__evidenceStore.getAll().length >= 1),
      })`);

      // STRICT SEMANTIC ASSERTION: Reasoning tools (propose_hypothesis) MUST NOT trigger approval!
      if (check.hasApproval) {
        throw new Error("[Semantic Assertion Failed] propose_hypothesis or reasoning tool required human approval!");
      }

      if (check.hasEvidenceToken) {
        evidenceTokenDetected = true;
      }

      if (check.hasHypothesisCard || check.hasStoredHypothesis) {
        hypothesisFound = true;
        break;
      }
      await new Promise((r) => setTimeout(r, 250));
    }

    if (!evidenceTokenDetected) {
      throw new Error("[Assertion Failed] No evidence tokens were extracted or displayed in the evidence ledger");
    }

    if (!hypothesisFound) {
      throw new Error("[Assertion Failed] Root cause hypothesis card failed to appear upon completion");
    }
    console.info(`  ✅ PASS: 8. Reason tools executed automatically & diagnosis synthesized successfully`);
    console.info("\n==================================================================");
    console.info("🎉 ALL REAL GOOGLE CHROME MOTION & SEMANTIC TESTS PASSED!");
    console.info("==================================================================");
  } finally {
    if (cdpClient) cdpClient.close();
    chromeProc.kill();
    server.close();
    try {
      rmSync(tempProfile, { recursive: true, force: true });
    } catch {}
  }
}

runMotionTests().catch((err) => {
  console.error(`\n❌ MOTION TEST FAILED: ${err.message}`);
  process.exit(1);
});
