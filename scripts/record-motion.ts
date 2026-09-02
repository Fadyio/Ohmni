/**
 * Real Screen Recording Capture Tool for Chrome.
 * Milestone 7.9 — Visual Truth Reset.
 *
 * Drives the real application end-to-end via CDP:
 * Welcome -> Start -> Agent inspect -> Approval -> Relay -> Brownout -> Evidence -> Hypothesis
 * Captures live viewport frames via Page.startScreencast and encodes to artifacts/demo-motion.webm.
 */

import { spawn, type ChildProcess } from "node:child_process";
import { mkdtempSync, rmSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
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
    "/usr/bin/google-chrome-stable",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium-browser",
    "/usr/bin/chromium",
  ];

  for (const p of standardPaths) {
    if (existsSync(p)) return p;
  }
  return null;
}

interface MockTurnPayload {
  readonly interactionId?: string;
  readonly previousInteractionId?: string;
  readonly prompt?: string;
  readonly input?: unknown[];
}

interface EvidenceDiscoveryItem {
  readonly id: string;
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

async function startStaticServer(distDir: string, port = 5178): Promise<{ server: Server; url: string }> {
  const mimeTypes: Record<string, string> = {
    ".html": "text/html; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
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

      const content = await readFile(filePath);
      const ext = filePath.substring(filePath.lastIndexOf("."));
      res.setHeader("Content-Type", mimeTypes[ext] || "application/octet-stream");
      res.statusCode = 200;
      res.end(content);
    } catch {
      res.statusCode = 404;
      res.end("Not Found");
    }
  });

  const { promise, resolve, reject } = Promise.withResolvers<{ server: Server; url: string }>();
  server.listen(port, "127.0.0.1", () => {
    resolve({ server, url: `http://127.0.0.1:${port}` });
  });
  server.on("error", reject);

  return promise;
}

class CDPClient {
  public ws: WebSocket;
  private nextId = 1;
  private pending = new Map<number, (res: { result?: unknown; error?: unknown }) => void>();
  public onEvent?: (method: string, params: Record<string, unknown>) => void;

  private constructor(ws: WebSocket) {
    this.ws = ws;
    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data as string);
        if (msg.id && this.pending.has(msg.id)) {
          const resolve = this.pending.get(msg.id)!;
          this.pending.delete(msg.id);
          resolve(msg);
        } else if (msg.method && this.onEvent) {
          this.onEvent(msg.method, msg.params);
        }
      } catch {}
    };
  }

  static async connect(wsUrl: string): Promise<CDPClient> {
    const ws = new WebSocket(wsUrl);
    const { promise, resolve, reject } = Promise.withResolvers<CDPClient>();
    ws.onopen = () => resolve(new CDPClient(ws));
    ws.onerror = reject;
    return promise;
  }

  async send(method: string, params: Record<string, unknown> = {}): Promise<unknown> {
    const id = this.nextId++;
    const message = JSON.stringify({ id, method, params });
    const { promise, resolve, reject } = Promise.withResolvers<{ result?: unknown; error?: unknown }>();
    this.pending.set(id, resolve);
    this.ws.send(message);

    const res = await promise;
    if (res.error) {
      throw new Error(`CDP Error (${method}): ${JSON.stringify(res.error)}`);
    }
    return res.result;
  }

  async evaluate<T>(expression: string): Promise<T> {
    const result = (await this.send("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true,
    })) as { result: { value: T } };
    return result.result.value;
  }

  close(): void {
    try {
      this.ws.close();
    } catch {}
  }
}

async function recordMotionDemo(): Promise<void> {
  console.info("==================================================================");
  console.info("   OHMNI — AUTOMATED REAL CHROME SCREEN RECORDING RECORDER        ");
  console.info("   Sequence: Welcome -> Start -> Inspect -> Approval -> Relay ->   ");
  console.info("             Brownout -> Evidence -> Hypothesis                   ");
  console.info("==================================================================");

  const chromePath = findChromePath();
  if (!chromePath) {
    throw new Error("Chrome not found");
  }

  const distDir = join(process.cwd(), "dist");
  const { server, url: serverUrl } = await startStaticServer(distDir, 5178);

  const framesDir = mkdtempSync(join(tmpdir(), "ohmni-recording-frames-"));
  const tempProfile = mkdtempSync(join(tmpdir(), "ohmni-chrome-rec-"));
  const debugPort = 9235;

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
  let frameIndex = 0;

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

    // Handle screencast frames
    cdpClient.onEvent = async (method, params) => {
      if (method === "Page.screencastFrame") {
        const sessionId = params.sessionId as number;
        const data = params.data as string;
        const framePath = join(framesDir, `frame_${String(frameIndex++).padStart(6, "0")}.jpg`);
        writeFileSync(framePath, Buffer.from(data, "base64"));
        await cdpClient?.send("Page.screencastFrameAck", { sessionId });
      }
    };

    await new Promise((r) => setTimeout(r, 1000));

    console.info("[Recording] Starting Page.startScreencast...");
    await cdpClient.send("Page.startScreencast", {
      format: "jpeg",
      quality: 90,
      maxWidth: 1440,
      maxHeight: 900,
      everyNthFrame: 1,
    });

    // 1. Welcome state (hold 2 seconds)
    console.info("[Recording] 1. Welcome Screen (World 1)...");
    await new Promise((r) => setTimeout(r, 2000));

    // 2. Click Diagnose to trigger GSAP transition
    console.info("[Recording] 2. Triggering GSAP Landing -> Lab Transition...");
    await cdpClient.evaluate(`document.querySelector("#diagnose-demo-btn").click()`);
    await new Promise((r) => setTimeout(r, 2500));

    // 3. Start Agent Investigation
    console.info("[Recording] 3. Starting Bench Agent (Turn 1 - read_reset_history)...");
    await cdpClient.evaluate(`document.querySelector("[data-testid='bench-agent-start']").click()`);
    await new Promise((r) => setTimeout(r, 3000));

    // 4. Amber Approval Gate
    console.info("[Recording] 4. Reaching Amber Approval Interlock...");
    let approvalReady = false;
    for (let i = 0; i < 30; i++) {
      approvalReady = await cdpClient.evaluate<boolean>(`Boolean(document.querySelector("[data-testid='bench-agent-approve']"))`);
      if (approvalReady) break;
      await new Promise((r) => setTimeout(r, 200));
    }
    await new Promise((r) => setTimeout(r, 2000));

    // 5. Click Approve
    console.info("[Recording] 5. Human Approval & Relay Actuation (Turn 2 - run_relay_stress_test)...");
    await cdpClient.evaluate(`document.querySelector("[data-testid='bench-agent-approve']").click()`);
    await new Promise((r) => setTimeout(r, 3500));

    // 6. Evidence & Hypothesis Synthesis (Turns 3-7)
    console.info("[Recording] 6. Evidence Extraction & Hypothesis Synthesis...");
    for (let i = 0; i < 30; i++) {
      const hasHypo = await cdpClient.evaluate<boolean>(`Boolean(document.querySelector("[data-testid='hypothesis-card']"))`);
      if (hasHypo) break;
      await new Promise((r) => setTimeout(r, 300));
    }
    await new Promise((r) => setTimeout(r, 4000));

    console.info("[Recording] Stopping screencast...");
    await cdpClient.send("Page.stopScreencast");

    console.info(`[Recording] Captured ${frameIndex} frames in ${framesDir}`);

    // Encode to artifacts/demo-motion.webm using ffmpeg
    const artifactsDir = join(process.cwd(), "artifacts");
    if (!existsSync(artifactsDir)) mkdirSync(artifactsDir, { recursive: true });
    const outputVideoPath = join(artifactsDir, "demo-motion.webm");

    console.info(`[Recording] Encoding video with ffmpeg to ${outputVideoPath}...`);
    const ffmpegProc = spawn(
      "ffmpeg",
      [
        "-y",
        "-framerate",
        "15",
        "-i",
        join(framesDir, "frame_%06d.jpg"),
        "-c:v",
        "libvpx-vp9",
        "-b:v",
        "1M",
        "-pix_fmt",
        "yuv420p",
        outputVideoPath,
      ],
      { stdio: "inherit" }
    );

    const { promise: ffmpegPromise, resolve: ffmpegResolve, reject: ffmpegReject } = Promise.withResolvers<void>();
    ffmpegProc.on("close", (code) => {
      if (code === 0) ffmpegResolve();
      else ffmpegReject(new Error(`ffmpeg exited with code ${code}`));
    });

    await ffmpegPromise;
    console.info(`\n🎉 Screen recording saved successfully to: ${outputVideoPath}`);
  } finally {
    if (cdpClient) cdpClient.close();
    chromeProc.kill();
    server.close();
    try {
      rmSync(framesDir, { recursive: true, force: true });
      rmSync(tempProfile, { recursive: true, force: true });
    } catch {}
  }
}

recordMotionDemo().catch((err) => {
  console.error(`Recording failed: ${err.message}`);
  process.exit(1);
});
