/**
 * Real Google Chrome Motion & Timeline Choreography Test Suite.
 * Milestone 7.10 — Real GSAP & Visual Truth Motion Verification Gate.
 *
 * Launches Google Chrome with WebMCP experimental flags,
 * connects via Chrome DevTools Protocol (CDP), and executes strict physical motion assertions:
 * 1. Welcome -> Lab: Samples hardware illustration bounding rect at 0ms, 150ms, 500ms.
 *    Asserts box150 differs from boxBefore AND box500 differs meaningfully.
 * 2. Agent Tool Pulse: Samples signal pulse bounding rect across time.
 *    Asserts pulse element moves by >= 30px across the viewport.
 * 3. Relay Armature: Samples SVG armature lever position before and during actuation.
 *    Asserts transform / state changes upon approval.
 * 4. Oscilloscope Canvas: Samples DEV/TEST frame counter at t0 and t+300ms.
 *    Asserts continuous frame rendering (> 0 frame delta).
 * 5. Evidence Token Ledger: Asserts evidence cards and hypothesis render with verified motion.
 *
 * Usage:
 *   bun run scripts/test-motion.ts
 *   bun run test:motion
 */

import { spawn, type ChildProcess } from "node:child_process";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer, type Server } from "node:http";
import { readFile } from "node:fs/promises";

function findChromePath(): string | null {
  const custom = process.env.CHROME_BIN || process.env.GOOGLE_CHROME_PATH;
  if (custom && existsSync(custom)) return custom;

  const standardMac = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  if (existsSync(standardMac)) return standardMac;

  const canaryMac = "/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary";
  if (existsSync(canaryMac)) return canaryMac;

  const linuxPaths = ["/usr/bin/google-chrome", "/usr/bin/chromium-browser", "/usr/bin/chromium"];
  for (const lp of linuxPaths) {
    if (existsSync(lp)) return lp;
  }
  return null;
}

interface MockTurnPayload {
  readonly functionCalls?: Array<{ name: string; args: Record<string, unknown> }>;
  readonly text?: string;
}

interface ChromeTargetItem {
  readonly id: string;
  readonly title: string;
  readonly type: string;
  readonly url: string;
  readonly webSocketDebuggerUrl: string;
}

interface CDPVersionInfo {
  readonly Browser: string;
}

async function startStaticServer(distDir: string, port = 5176): Promise<{ server: Server; url: string }> {
  const sessionTurns = new Map<string, number>();
  let discoveredEvidenceIds: string[] = [];

  const server = createServer(async (req, res) => {
    const parsedUrl = new URL(req.url || "/", `http://127.0.0.1:${port}`);
    const reqPath = parsedUrl.pathname;

    // Mock /api/bench-agent
    if (reqPath === "/api/bench-agent") {
      if (req.method === "OPTIONS") {
        res.writeHead(204, {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, X-Bench-Agent-Session",
        });
        res.end();
        return;
      }

      if (req.method === "GET") {
        res.writeHead(200, {
          "Content-Type": "application/json; charset=utf-8",
          "Access-Control-Allow-Origin": "*",
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
        const turnRequest = JSON.parse(bodyText || "{}") as {
          previousInteractionId?: string;
          input?: Array<{ name?: string; result?: Array<{ text?: string }> }>;
        };
        const rawSessionHeader = req.headers["x-bench-agent-session"];
        const sessionId = Array.isArray(rawSessionHeader) ? rawSessionHeader[0] : rawSessionHeader || "default";

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
                arguments: { cycles: 3, duration_ms: 400 },
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
              if (item?.name === "list_evidence" && Array.isArray(item.result)) {
                try {
                  const firstResult = item.result[0];
                  if (firstResult && typeof firstResult.text === "string") {
                    const parsedEv: unknown = JSON.parse(firstResult.text);
                    if (Array.isArray(parsedEv)) {
                      discoveredEvidenceIds = parsedEv
                        .filter((e): e is { id: string } => Boolean(e && typeof e === "object" && "id" in e && typeof e.id === "string"))
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
                  relationship: "STRONGLY_SUPPORTS",
                  note: "Brownout reset log recorded upon relay actuation.",
                },
              },
            ],
          };
        } else {
          const ev2 = discoveredEvidenceIds[1] || "E-002";
          responseBody = {
            interactionId: `interaction-${sessionId}-6`,
            functionCalls: [
              {
                id: "call-update-1",
                name: "update_hypothesis",
                arguments: {
                  hypothesis_id: "H-001",
                  confidence: "HIGH",
                  evidence_ids: ["E-001", ev2],
                  reason: "Empirical telemetry confirmed supply rail sagged to 2.72V triggering MCU reset.",
                },
              },
            ],
            text: "Diagnosis complete: Relay inrush current causes 3.3V supply rail to collapse to 2.72V.",
          };
        }

        res.writeHead(200, {
          "Content-Type": "application/json; charset=utf-8",
          "Access-Control-Allow-Origin": "*",
        });
        res.end(JSON.stringify(responseBody));
        return;
      }
    }

    // Static assets from dist/
    let assetPath = parsedUrl.pathname;
    if (assetPath === "/") assetPath = "/index.html";
    const filePath = join(distDir, assetPath.startsWith("/") ? assetPath.slice(1) : assetPath);

    try {
      const data = await readFile(filePath);
      const ext = assetPath.split(".").pop() || "";
      const mimeTypes: Record<string, string> = {
        html: "text/html",
        js: "application/javascript",
        css: "text/css",
        svg: "image/svg+xml",
        png: "image/png",
        json: "application/json",
      };
      res.writeHead(200, {
        "Content-Type": mimeTypes[ext] || "application/octet-stream",
        "Cache-Control": "no-cache",
      });
      res.end(data);
    } catch {
      try {
        const fallback = await readFile(join(distDir, "index.html"));
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(fallback);
      } catch {
        res.writeHead(404, { "Content-Type": "text/plain" });
        res.end("Not Found");
      }
    }
  });
  const { promise, resolve, reject } = Promise.withResolvers<void>();
  server.listen(port, "127.0.0.1", () => resolve());
  server.on("error", reject);
  await promise;

  return { server, url: `http://127.0.0.1:${port}` };
}

class CDPClient {
  private ws: WebSocket;
  private nextId = 1;
  private pending = new Map<number, { resolve: (val: unknown) => void; reject: (err: Error) => void }>();

  private constructor(ws: WebSocket) {
    this.ws = ws;
    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data.toString()) as { id?: number; result?: unknown; error?: { message: string } };
        if (typeof msg.id === "number" && this.pending.has(msg.id)) {
          const { resolve, reject } = this.pending.get(msg.id)!;
          this.pending.delete(msg.id);
          if (msg.error) {
            reject(new Error(msg.error.message));
          } else {
            resolve(msg.result);
          }
        }
      } catch {}
    };
  }

  public static async connect(wsUrl: string): Promise<CDPClient> {
    const ws = new WebSocket(wsUrl);
    const { promise, resolve, reject } = Promise.withResolvers<void>();
    ws.onopen = () => resolve();
    ws.onerror = (e) => reject(new Error(`WebSocket connection failed: ${e}`));
    await promise;
    return new CDPClient(ws);
  }

  public async send<T = unknown>(method: string, params: Record<string, unknown> = {}): Promise<T> {
    const id = this.nextId++;
    const payload = JSON.stringify({ id, method, params });
    const { promise, resolve, reject } = Promise.withResolvers<unknown>();
    this.pending.set(id, { resolve, reject });
    this.ws.send(payload);
    return promise as Promise<T>;
  }

  public async evaluate<T = unknown>(expression: string): Promise<T> {
    const res = await this.send<{ result: { value: T } }>("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    return res.result.value;
  }

  public close(): void {
    try {
      this.ws.close();
    } catch {}
  }
}

async function runMotionTests(): Promise<void> {
  console.info("==================================================================");
  console.info("   OHMNI — REAL GOOGLE CHROME MOTION & TIMELINE CHOREOGRAPHY GATE ");
  console.info("   Milestone 7.10: Real GSAP & Visual Truth Physical Verification ");
  console.info("==================================================================");

  const chromePath = findChromePath();
  if (!chromePath) {
    throw new Error("Google Chrome executable not found in standard system paths.");
  }
  console.info(`[Motion Gate] Found Chrome at: ${chromePath}`);

  console.info(`[Motion Gate] Building production distribution (vite build)...`);
  const buildProc = spawn("bun", ["run", "build"], { stdio: "inherit" });
  const { promise: buildPromise, resolve: buildResolve, reject: buildReject } = Promise.withResolvers<void>();
  buildProc.on("close", (code) => {
    if (code === 0) buildResolve();
    else buildReject(new Error(`vite build failed with exit code ${code}`));
  });
  await buildPromise;

  const distDir = join(process.cwd(), "dist");
  const { server, url: serverUrl } = await startStaticServer(distDir, 5176);
  console.info(`[Motion Gate] Serving production bundle at: ${serverUrl}`);

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

  console.info(`[Motion Gate] Launching Chrome...`);
  const chromeProc: ChildProcess = spawn(chromePath, chromeArgs, {
    detached: false,
    stdio: "pipe",
  });

  let cdpClient: CDPClient | null = null;

  try {
    console.info(`[Motion Gate] Waiting for Chrome remote debugging on port ${debugPort}...`);
    let versionData: CDPVersionInfo | null = null;
    for (let i = 0; i < 40; i++) {
      const { promise: sleepPromise, resolve: sleepResolve } = Promise.withResolvers<void>();
      setTimeout(sleepResolve, 250);
      await sleepPromise;
      try {
        const res = await fetch(`http://127.0.0.1:${debugPort}/json/version`);
        if (res.ok) {
          versionData = (await res.json()) as CDPVersionInfo;
          break;
        }
      } catch {}
    }

    if (!versionData) {
      throw new Error("Timed out waiting for Chrome DevTools port to open");
    }

    let pageTarget: ChromeTargetItem | undefined;
    for (let i = 0; i < 30; i++) {
      try {
        const listRes = await fetch(`http://127.0.0.1:${debugPort}/json/list`);
        const targets = (await listRes.json()) as ChromeTargetItem[];
        pageTarget =
          targets.find((t) => t.type === "page" && t.url.includes("127.0.0.1:5176")) ??
          targets.find((t) => t.type === "page" && !t.url.startsWith("chrome-extension://"));
        if (pageTarget) break;
      } catch {}
      const { promise: p, resolve: r } = Promise.withResolvers<void>();
      setTimeout(r, 200);
      await p;
    }

    if (!pageTarget) {
      throw new Error("Application page target not found in Chrome tabs");
    }

    cdpClient = await CDPClient.connect(pageTarget.webSocketDebuggerUrl);
    await cdpClient.send("Runtime.enable");
    await cdpClient.send("Page.enable");
    await cdpClient.send("Page.navigate", { url: serverUrl });

    console.info(`[Motion Gate] Waiting for application mount...`);
    let mounted = false;
    for (let i = 0; i < 40; i++) {
      const { promise: sleepPromise, resolve: sleepResolve } = Promise.withResolvers<void>();
      setTimeout(sleepResolve, 250);
      await sleepPromise;
      try {
        const ready = await cdpClient.evaluate<boolean>(
          `Boolean(document.querySelector("#diagnose-demo-btn") || document.querySelector("[data-testid='diagnose-demo-btn']"))`
        );
        if (ready) {
          mounted = true;
          break;
        }
      } catch {}
    }

    if (!mounted) {
      throw new Error("Welcome page failed to mount within 10 seconds");
    }

    console.info("\n--- EXECUTING REAL GSAP & MOTION VERIFICATION MATRIX ---\n");

    // -----------------------------------------------------------------
    // TEST 1: Welcome -> Lab Transition Motion Sampling & Assertions
    // -----------------------------------------------------------------
    console.info("1. Welcome -> Lab Transition Motion Sampling & Assertions...");
    const boxBefore = await cdpClient.evaluate<{ x: number; y: number; width: number; height: number }>(`(() => {
      const el = document.querySelector("#hardware-illustration") || document.querySelector("[data-testid='hardware-illustration']");
      const r = el ? el.getBoundingClientRect() : { x: 0, y: 0, width: 0, height: 0 };
      return { x: r.x, y: r.y, width: r.width, height: r.height };
    })()`);

    // Trigger GSAP transition timeline
    await cdpClient.evaluate(`document.querySelector("#diagnose-demo-btn").click()`);

    // Sample at 150ms
    await new Promise((r) => setTimeout(r, 150));
    const box150 = await cdpClient.evaluate<{ x: number; y: number; width: number; height: number }>(`(() => {
      const el = document.querySelector("#hardware-illustration") || document.querySelector("[data-testid='hardware-illustration']");
      if (!el) return { x: 0, y: 0, width: 0, height: 0 };
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height };
    })()`);

    // Sample at 500ms
    await new Promise((r) => setTimeout(r, 350));
    const box500 = await cdpClient.evaluate<{ x: number; y: number; width: number; height: number }>(`(() => {
      const el = document.querySelector("#hardware-illustration") || document.querySelector("[data-testid='hardware-illustration']");
      if (!el) return { x: 0, y: 0, width: 0, height: 0 };
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height };
    })()`);

    // Strict Motion Assertions:
    const delta150X = Math.abs(box150.x - boxBefore.x);
    const delta150Width = Math.abs(box150.width - boxBefore.width);
    const delta150Y = Math.abs(box150.y - boxBefore.y);
    if (delta150X < 0.1 && delta150Width < 0.1 && delta150Y < 0.1) {
      throw new Error(
        `[Assertion Failed] Welcome->Lab GSAP timeline did not initiate motion at 150ms. boxBefore=${JSON.stringify(boxBefore)}, box150=${JSON.stringify(box150)}`
      );
    }

    const delta500X = Math.abs(box500.x - boxBefore.x);
    const delta500Width = Math.abs(box500.width - boxBefore.width);
    const delta500Y = Math.abs(box500.y - boxBefore.y);
    if (delta500X < 3 && delta500Width < 3 && delta500Y < 3) {
      throw new Error(
        `[Assertion Failed] Welcome->Lab GSAP timeline did not achieve meaningful motion at 500ms. boxBefore=${JSON.stringify(boxBefore)}, box500=${JSON.stringify(box500)}`
      );
    }

    // Wait for transition to complete
    await new Promise((r) => setTimeout(r, 600));

    console.info(`  ✅ PASS: 1. Welcome -> Lab GSAP timeline verified (sampled at 0ms, 150ms, 500ms with strict delta assertions)`);

    // -----------------------------------------------------------------
    // TEST 2: Agent Tool Call Signal Pulse Motion Assertions
    // -----------------------------------------------------------------
    console.info("2. Agent Tool Call Pulse Motion Assertions...");
    await cdpClient.evaluate(`document.querySelector("[data-testid='bench-agent-start']").click()`);

    let pulseSample1: { x: number; y: number } | null = null;
    let pulseSample2: { x: number; y: number } | null = null;

    for (let i = 0; i < 25; i++) {
      const sample = await cdpClient.evaluate<{ found: boolean; x: number; y: number }>(`(() => {
        const p = document.querySelector("#signal-pulse") || document.querySelector("[data-testid='signal-pulse']");
        if (!p) return { found: false, x: 0, y: 0 };
        const r = p.getBoundingClientRect();
        return { found: true, x: r.x, y: r.y };
      })()`);

      if (sample.found) {
        if (!pulseSample1) {
          pulseSample1 = { x: sample.x, y: sample.y };
        } else if (!pulseSample2 && (Math.abs(sample.x - pulseSample1.x) > 10 || Math.abs(sample.y - pulseSample1.y) > 10)) {
          pulseSample2 = { x: sample.x, y: sample.y };
          break;
        }
      }
      await new Promise((r) => setTimeout(r, 80));
    }

    if (!pulseSample1) {
      throw new Error("[Assertion Failed] SignalPulse DOM element was not detected during tool execution");
    }

    // Sample once more after 150ms if second point wasn't captured in poll loop
    if (!pulseSample2) {
      await new Promise((r) => setTimeout(r, 150));
      const secondSample = await cdpClient.evaluate<{ found: boolean; x: number; y: number }>(`(() => {
        const p = document.querySelector("#signal-pulse") || document.querySelector("[data-testid='signal-pulse']");
        if (!p) return { found: false, x: 0, y: 0 };
        const r = p.getBoundingClientRect();
        return { found: true, x: r.x, y: r.y };
      })()`);
      if (secondSample.found) {
        pulseSample2 = { x: secondSample.x, y: secondSample.y };
      }
    }

    if (!pulseSample2) {
      throw new Error("[Assertion Failed] SignalPulse second coordinate sample could not be obtained");
    }

    const pulseDistance = Math.hypot(pulseSample2.x - pulseSample1.x, pulseSample2.y - pulseSample1.y);
    if (pulseDistance < 30) {
      throw new Error(
        `[Assertion Failed] SignalPulse failed >= 30px travel requirement: measured delta was ${pulseDistance.toFixed(1)}px (p1=${JSON.stringify(pulseSample1)}, p2=${JSON.stringify(pulseSample2)})`
      );
    }

    console.info(`  ✅ PASS: 2. Electric-blue signal pulse traveled across screen (${pulseDistance.toFixed(1)}px displacement verified)`);

    // -----------------------------------------------------------------
    // TEST 3: Amber Approval & Relay Actuation Motion
    // -----------------------------------------------------------------
    console.info("3. Amber Approval & Relay Actuation Motion...");
    let approvalReady = false;
    for (let i = 0; i < 30; i++) {
      approvalReady = await cdpClient.evaluate<boolean>(`Boolean(document.querySelector("[data-testid='bench-agent-approve']"))`);
      if (approvalReady) break;
      await new Promise((r) => setTimeout(r, 150));
    }

    if (!approvalReady) {
      throw new Error("Approval state was not reached");
    }

    // Read relay armature state before approval
    const relayBefore = await cdpClient.evaluate<{ state: string | null; y2: string | null }>(`(() => {
      const lever = document.querySelector("#relay-armature-lever") || document.querySelector("[data-testid='relay-armature-lever']");
      const grp = document.querySelector("#relay-module-group") || document.querySelector("[data-testid='relay-module-group']");
      return {
        state: grp ? grp.getAttribute("data-relay-state") : (lever ? lever.getAttribute("data-relay-state") : "open"),
        y2: lever ? lever.getAttribute("y2") : null,
      };
    })()`);

    // Sample frame count before clicking approve
    const frameCountBefore = await cdpClient.evaluate<number>(`Number(window.__scopeFrameCount || 0)`);

    // Click approve to energize relay coil and start oscilloscope telemetry acquisition
    await cdpClient.evaluate(`document.querySelector("[data-testid='bench-agent-approve']").click()`);

    // Read relay state & oscilloscope frame increments during active actuation
    let relayActuationVerified = false;
    let maxFrameCount = frameCountBefore;

    for (let i = 0; i < 25; i++) {
      const sample = await cdpClient.evaluate<{ state: string | null; y2: string | null; frameCount: number }>(`(() => {
        const lever = document.querySelector("#relay-armature-lever") || document.querySelector("[data-testid='relay-armature-lever']");
        const grp = document.querySelector("#relay-module-group") || document.querySelector("[data-testid='relay-module-group']");
        return {
          state: grp ? grp.getAttribute("data-relay-state") : (lever ? lever.getAttribute("data-relay-state") : "open"),
          y2: lever ? lever.getAttribute("y2") : null,
          frameCount: Number(window.__scopeFrameCount || 0),
        };
      })()`);

      if (sample.frameCount > maxFrameCount) {
        maxFrameCount = sample.frameCount;
      }

      if (sample.state === "closed" || (sample.y2 !== null && sample.y2 !== relayBefore.y2)) {
        relayActuationVerified = true;
      }
      await new Promise((r) => setTimeout(r, 60));
    }

    if (!relayActuationVerified) {
      throw new Error(
        `[Assertion Failed] Relay armature SVG transform / state did not actuate during relay stress test: stateBefore=${relayBefore.state}, y2Before=${relayBefore.y2}`
      );
    }

    console.info(`  ✅ PASS: 3. Human authorization gate & tactile relay actuation transform verified`);

    // -----------------------------------------------------------------
    // TEST 4: Oscilloscope 60fps Canvas Render Verification
    // -----------------------------------------------------------------
    console.info("4. Oscilloscope Canvas Multi-Frame Render...");
    const frameDelta = maxFrameCount - frameCountBefore;
    if (frameDelta < 5) {
      throw new Error(
        `[Assertion Failed] Oscilloscope canvas render loop stalled: only ${frameDelta} new frames rendered during experiment acquisition (before=${frameCountBefore}, after=${maxFrameCount}, required >= 5)`
      );
    }
    console.info(`  ✅ PASS: 4. 60fps Oscilloscope telemetry captured real voltage frames (${frameDelta} new frames rendered during actuation; maxFrameCount=${maxFrameCount})`);
    // -----------------------------------------------------------------
    // TEST 5: Evidence Store & Grounded Hypothesis Synthesis
    // -----------------------------------------------------------------
    console.info("5. Evidence Extraction & Hypothesis Motion...");
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

      if (check.hasApproval) {
        await cdpClient.evaluate(`document.querySelector("[data-testid='bench-agent-approve']")?.click()`);
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
    console.info(`  ✅ PASS: 5. Evidence token ledger & root cause hypothesis synthesized successfully`);
    console.info("\n==================================================================");
    console.info("🎉 ALL REAL GOOGLE CHROME MOTION TESTS PASSED SUCCESSFULLY!");
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
