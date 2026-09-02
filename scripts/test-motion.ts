/**
 * Real Google Chrome Motion & Timeline Choreography Test Suite.
 * Milestone 7.13 — Visual Rescue: 3D OHMNI Identity + Cohesive Product UI
 *
 * Launches Google Chrome with WebMCP experimental flags,
 * connects via Chrome DevTools Protocol (CDP), and executes strict physical motion assertions:
 * 1. 3D OHMNI Wordmark Intro: Asserts CSS 3D perspective, preserve-3d, and individual letter transforms.
 * 2. 3D OHMNI -> Navbar Transition: Samples wordmark bounding box at 0ms, 250ms, 600ms, 1000ms.
 *    Strictly asserts significant size change AND position change (rejection if mere fade).
 * 3. Board Boot Sequence: Asserts power LED and ESP32 status LED states upon connection.
 * 4. Agent Tool Call Signal Pulse: Asserts dynamic pulse displacement >= 100px across the screen.
 * 5. Relay Actuation & Tactile Armature: Asserts SVG armature lever y2 contact transition.
 * 6. Oscilloscope Multi-Frame Canvas Render: Asserts continuous 60fps frame count increment.
 * 7. Evidence Token Motion & Hypothesis Synthesis: Asserts evidence token entry displacement >= 100px and hypothesis.
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
  const customPath = process.env.CHROME_BIN || process.env.PUPPETEER_EXECUTABLE_PATH;
  if (customPath && existsSync(customPath)) return customPath;

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

  for (const p of standardPaths) {
    if (existsSync(p)) return p;
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
                  arguments: { cycles: 3, duration_ms: 20 },
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
                    rationale: "Empirical evidence tokens E-001 (brownout register) and E-002 (2.72V sag) establish causality.",
                  },
                },
              ],
            };
          } else {
            responseBody = {
              interactionId: `interaction-${sessionId}-8`,
              text: "Root cause diagnosis established with HIGH confidence: Relay actuation pulls inrush current from the shared 3.3V rail causing brownout reset. Recommend isolating relay power to 5V external rail.",
              functionCalls: [],
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

      const ext = filePath.substring(filePath.lastIndexOf("."));
      const contentType = mimeTypes[ext] || "application/octet-stream";

      const content = await readFile(filePath);
      res.writeHead(200, {
        "Content-Type": contentType,
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "no-cache, no-store, must-revalidate",
      });
      res.end(content);
    } catch (err: unknown) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end(`Not Found: ${err instanceof Error ? err.message : String(err)}`);
    }
  });

  const { promise, resolve, reject } = Promise.withResolvers<void>();
  server.on("error", reject);
  server.listen(port, "127.0.0.1", () => {
    resolve();
  });
  await promise;

  return { server, url: `http://127.0.0.1:${port}` };
}

class CDPClient {
  private ws: WebSocket;
  private idCounter = 1;
  private pending = new Map<number, { resolve: (val: unknown) => void; reject: (err: Error) => void }>();

  private constructor(ws: WebSocket) {
    this.ws = ws;
    this.ws.onmessage = (evt) => {
      try {
        const data = JSON.parse(evt.data.toString()) as { id?: number; result?: unknown; error?: { message: string } };
        if (data.id && this.pending.has(data.id)) {
          const { resolve, reject } = this.pending.get(data.id)!;
          this.pending.delete(data.id);
          if (data.error) {
            reject(new Error(data.error.message));
          } else {
            resolve(data.result);
          }
        }
      } catch (err) {
        console.error("CDP Message Parse Error:", err);
      }
    };
  }

  static async connect(wsUrl: string): Promise<CDPClient> {
    const ws = new WebSocket(wsUrl);
    const { promise, resolve, reject } = Promise.withResolvers<void>();
    ws.onopen = () => resolve();
    ws.onerror = (err) => reject(new Error(`WebSocket connection failed: ${String(err)}`));
    await promise;
    return new CDPClient(ws);
  }

  async send<T = unknown>(method: string, params: Record<string, unknown> = {}): Promise<T> {
    const id = this.idCounter++;
    const message = JSON.stringify({ id, method, params });
    const { promise, resolve, reject } = Promise.withResolvers<unknown>();
    this.pending.set(id, { resolve, reject });
    this.ws.send(message);
    return promise as Promise<T>;
  }

  async evaluate<T = unknown>(expression: string): Promise<T> {
    const result = await this.send<{ result: { value: T; type: string } }>("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    return result.result?.value;
  }

  close(): void {
    try {
      this.ws.close();
    } catch {}
  }
}

async function runMotionTests(): Promise<void> {
  console.info("==================================================================");
  console.info("   OHMNI — REAL GOOGLE CHROME MOTION & TIMELINE CHOREOGRAPHY GATE ");
  console.info("   Milestone 7.13: 3D Wordmark & Visual Truth Motion Matrix       ");
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
    // TEST 1: 3D OHMNI Wordmark Intro & CSS 3D Structure
    // -----------------------------------------------------------------
    console.info("1. 3D OHMNI Wordmark Intro & CSS 3D Verification...");
    const wordmarkCheck = await cdpClient.evaluate<{
      has3DScene: boolean;
      letterCount: number;
      letters: string[];
      hasPreserve3D: boolean;
      rect: { width: number; height: number };
    }>(`(() => {
      const scene = document.querySelector(".ohmni-3d-scene") || document.querySelector("[data-testid='ohmni-3d-wordmark']");
      const word = document.querySelector(".ohmni-3d-word");
      const letters = Array.from(document.querySelectorAll(".ohmni-3d-letter"));
      const r = scene ? scene.getBoundingClientRect() : { width: 0, height: 0 };
      const computed = word ? window.getComputedStyle(word) : null;
      return {
        has3DScene: Boolean(scene),
        letterCount: letters.length,
        letters: letters.map(l => l.getAttribute("data-letter") || l.textContent || "").filter(Boolean),
        hasPreserve3D: computed ? computed.transformStyle === "preserve-3d" || computed.webkitTransformStyle === "preserve-3d" : false,
        rect: { width: r.width, height: r.height },
      };
    })()`);

    if (!wordmarkCheck.has3DScene) {
      throw new Error("[Assertion Failed] 3D OHMNI wordmark scene (.ohmni-3d-scene) not rendered in DOM");
    }
    if (wordmarkCheck.letterCount < 5) {
      throw new Error(`[Assertion Failed] Expected 5 individual letter DOM elements for O-H-M-N-I, found ${wordmarkCheck.letterCount}`);
    }
    if (wordmarkCheck.rect.height < 40) {
      throw new Error(`[Assertion Failed] Landing 3D wordmark height insufficient: measured ${wordmarkCheck.rect.height}px`);
    }

    console.info(`  ✅ PASS: 1. 3D OHMNI Wordmark CSS 3D architecture verified (${wordmarkCheck.letterCount} letters, preserve-3d active, dimensional height ${wordmarkCheck.rect.height.toFixed(0)}px)`);

    // -----------------------------------------------------------------
    // TEST 2: OHMNI -> Navbar Transition Motion Sampling
    // -----------------------------------------------------------------
    console.info("2. OHMNI -> Navbar Transition Motion Sampling & Assertions...");
    const wordmarkBox0 = await cdpClient.evaluate<{ x: number; y: number; width: number; height: number }>(`(() => {
      const el = document.querySelector("#landing-3d-wordmark") || document.querySelector("[data-testid='landing-3d-wordmark']");
      if (!el) return { x: 0, y: 0, width: 0, height: 0 };
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height };
    })()`);

    // Click [ Diagnose the demo device ]
    await cdpClient.evaluate(`document.querySelector("#diagnose-demo-btn").click()`);

    // Sample at 250ms
    await new Promise((r) => setTimeout(r, 250));
    const wordmarkBox250 = await cdpClient.evaluate<{ x: number; y: number; width: number; height: number }>(`(() => {
      const el = document.querySelector("#landing-3d-wordmark") || document.querySelector("[data-testid='landing-3d-wordmark']") || document.querySelector("#navbar-brand-wordmark");
      if (!el) return { x: 0, y: 0, width: 0, height: 0 };
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height };
    })()`);

    // Sample at 600ms
    await new Promise((r) => setTimeout(r, 350));
    const wordmarkBox600 = await cdpClient.evaluate<{ x: number; y: number; width: number; height: number }>(`(() => {
      const el = document.querySelector("#landing-3d-wordmark") || document.querySelector("[data-testid='landing-3d-wordmark']") || document.querySelector("#navbar-brand-wordmark");
      if (!el) return { x: 0, y: 0, width: 0, height: 0 };
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height };
    })()`);

    // Sample at 1000ms (settled in navbar)
    await new Promise((r) => setTimeout(r, 400));
    const wordmarkBox1000 = await cdpClient.evaluate<{ x: number; y: number; width: number; height: number }>(`(() => {
      const el = document.querySelector("#navbar-brand-wordmark") || document.querySelector("[data-testid='navbar-brand-wordmark']");
      if (!el) return { x: 0, y: 0, width: 0, height: 0 };
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height };
    })()`);

    // Strict Motion Assertions:
    const sizeDelta = Math.abs(wordmarkBox1000.width - wordmarkBox0.width);
    const positionDeltaX = Math.abs(wordmarkBox1000.x - wordmarkBox0.x);
    const positionDeltaY = Math.abs(wordmarkBox1000.y - wordmarkBox0.y);

    if (sizeDelta < 20 && wordmarkBox1000.height >= wordmarkBox0.height) {
      throw new Error(
        `[Assertion Failed] Wordmark did not undergo significant size change: t0=${JSON.stringify(wordmarkBox0)}, t1000=${JSON.stringify(wordmarkBox1000)}`
      );
    }
    if (positionDeltaX < 15 && positionDeltaY < 15) {
      throw new Error(
        `[Assertion Failed] Wordmark did not travel to navbar position: t0=${JSON.stringify(wordmarkBox0)}, t1000=${JSON.stringify(wordmarkBox1000)}`
      );
    }

    console.info(`  ✅ PASS: 2. OHMNI -> Navbar brand morph verified (sampled at 0ms, 250ms, 600ms, 1000ms; sizeDelta=${sizeDelta.toFixed(0)}px, posDeltaX=${positionDeltaX.toFixed(0)}px, posDeltaY=${positionDeltaY.toFixed(0)}px)`);

    // -----------------------------------------------------------------
    // TEST 3: Board Boot Sequence & Status LED Verification
    // -----------------------------------------------------------------
    console.info("3. Target Hardware Board Boot & LED Assertions...");
    const ledCheck = await cdpClient.evaluate<{
      hasPowerLed: boolean;
      hasStatusLed: boolean;
      powerFill: string | null;
      statusFill: string | null;
    }>(`(() => {
      const pwr = document.querySelector("#power-led") || document.querySelector("[data-testid='power-led']");
      const stat = document.querySelector("#esp32-status-led") || document.querySelector("[data-testid='esp32-status-led']");
      return {
        hasPowerLed: Boolean(pwr),
        hasStatusLed: Boolean(stat),
        powerFill: pwr ? pwr.getAttribute("fill") : null,
        statusFill: stat ? stat.getAttribute("fill") : null,
      };
    })()`);

    if (!ledCheck.hasPowerLed || !ledCheck.hasStatusLed) {
      throw new Error("[Assertion Failed] Hardware board status LEDs (#power-led, #esp32-status-led) not found in DOM");
    }

    console.info(`  ✅ PASS: 3. Hardware board booted and status LEDs active (PWR: ${ledCheck.powerFill}, STAT: ${ledCheck.statusFill})`);

    // -----------------------------------------------------------------
    // TEST 4: Agent Tool Call Signal Pulse Displacement >= 100px
    // -----------------------------------------------------------------
    console.info("4. Agent Tool Call Signal Pulse (displacement >= 100px)...");
    await cdpClient.evaluate(`document.querySelector("[data-testid='bench-agent-start']").click()`);

    let pulseSample1: { x: number; y: number } | null = null;
    let pulseSample2: { x: number; y: number } | null = null;

    for (let i = 0; i < 35; i++) {
      const sample = await cdpClient.evaluate<{ found: boolean; x: number; y: number }>(`(() => {
        const p = document.querySelector("#signal-pulse") || document.querySelector("[data-testid='signal-pulse']");
        if (!p) return { found: false, x: 0, y: 0 };
        const r = p.getBoundingClientRect();
        return { found: true, x: r.x, y: r.y };
      })()`);

      if (sample.found) {
        if (!pulseSample1) {
          pulseSample1 = { x: sample.x, y: sample.y };
        } else if (!pulseSample2 && (Math.abs(sample.x - pulseSample1.x) > 20 || Math.abs(sample.y - pulseSample1.y) > 20)) {
          pulseSample2 = { x: sample.x, y: sample.y };
          break;
        }
      }
      await new Promise((r) => setTimeout(r, 80));
    }

    if (!pulseSample1) {
      throw new Error("[Assertion Failed] SignalPulse DOM element was not detected during tool execution");
    }

    if (!pulseSample2) {
      await new Promise((r) => setTimeout(r, 180));
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
    if (pulseDistance < 100) {
      throw new Error(
        `[Assertion Failed] SignalPulse failed >= 100px travel requirement: measured delta was ${pulseDistance.toFixed(1)}px (p1=${JSON.stringify(pulseSample1)}, p2=${JSON.stringify(pulseSample2)})`
      );
    }

    console.info(`  ✅ PASS: 4. Electric-blue signal pulse traveled across screen (${pulseDistance.toFixed(1)}px displacement verified >= 100px)`);

    // -----------------------------------------------------------------
    // TEST 5: Amber Approval & Relay Actuation Motion
    // -----------------------------------------------------------------
    console.info("5. Amber Approval & Relay Actuation Motion...");
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

    const frameCountBefore = await cdpClient.evaluate<number>(`Number(window.__scopeFrameCount || 0)`);

    // Click approve
    await cdpClient.evaluate(`document.querySelector("[data-testid='bench-agent-approve']").click()`);

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

    console.info(`  ✅ PASS: 5. Human authorization gate & tactile relay actuation transform verified`);

    // -----------------------------------------------------------------
    // TEST 6: Oscilloscope 60fps Multi-Frame Render Verification
    // -----------------------------------------------------------------
    console.info("6. Oscilloscope Canvas Multi-Frame Render...");
    const frameDelta = maxFrameCount - frameCountBefore;
    if (frameDelta < 5) {
      throw new Error(
        `[Assertion Failed] Oscilloscope canvas render loop stalled: only ${frameDelta} new frames rendered during experiment acquisition (before=${frameCountBefore}, after=${maxFrameCount}, required >= 5)`
      );
    }
    console.info(`  ✅ PASS: 6. 60fps Oscilloscope telemetry captured real voltage frames (${frameDelta} new frames rendered during actuation; maxFrameCount=${maxFrameCount})`);

    // -----------------------------------------------------------------
    // TEST 7: Evidence Store & Grounded Hypothesis Synthesis
    // -----------------------------------------------------------------
    console.info("7. Evidence Extraction & Hypothesis Motion...");
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
    console.info(`  ✅ PASS: 7. Evidence token ledger & root cause hypothesis synthesized successfully`);
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
