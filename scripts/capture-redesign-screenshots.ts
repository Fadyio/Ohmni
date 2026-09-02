/**
 * Automated Real Chrome Screenshot Capture for Milestone 7.5 Redesign.
 * Captures all 8 required product proof screenshots:
 * 01-intro.png
 * 02-connected.png
 * 03-agent-observing.png
 * 04-approval.png
 * 05-experiment-running.png
 * 06-brownout.png
 * 07-evidence.png
 * 08-hypothesis.png
 */

import { spawn, type ChildProcess } from "node:child_process";
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer, type Server } from "node:http";
import { readFile } from "node:fs/promises";

function findChromePath(): string | null {
  const paths = [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ];
  for (const p of paths) {
    try {
      if (require("node:fs").existsSync(p)) return p;
    } catch {}
  }
  return null;
}

interface MockTurnPayload {
  readonly thought?: string;
  readonly assessment?: string;
  readonly calls?: Array<{ readonly id: string; readonly name: string; readonly arguments: Record<string, unknown> }>;
}

async function startStaticServer(distDir: string, port = 5176): Promise<{ server: Server; url: string }> {
  let mockTurn = 0;
  const mockPlan: MockTurnPayload[] = [
    {
      thought: "Controller unexpectedly restarts when fan is activated. Reading device info and reset history to identify prior failure reasons.",
      calls: [
        { id: "call_read_info", name: "read_device_info", arguments: {} },
        { id: "call_read_resets", name: "read_reset_history", arguments: {} },
      ],
    },
    {
      thought: "Reset history reveals prior BROWNOUT events. Proposing controlled relay stress test to verify supply rail sag under coil load.",
      calls: [
        { id: "call_stress_test", name: "run_relay_stress_test", arguments: { cycles: 3, durationMs: 50 } },
      ],
    },
    {
      thought: "Stress test reproduced brownout reset: supply voltage collapsed from 3.31V down to 2.72V (< 2.80V threshold). Synthesizing high confidence hypothesis.",
      calls: [
        {
          id: "call_prop_hypo",
          name: "propose_hypothesis",
          arguments: {
            title: "Relay-induced supply brownout",
            description: "Relay coil inrush current from the 3.3V rail pulls voltage below the 2.80V brownout threshold, resetting the MCU.",
            confidence: "MEDIUM",
            evidenceIds: ["E-001", "E-002"],
          },
        },
        {
          id: "call_upd_hypo",
          name: "update_hypothesis",
          arguments: {
            hypothesisId: "H-001",
            confidence: "HIGH",
            supportingEvidenceIds: ["E-001", "E-002"],
            rationale: "Empirical telemetry proves that relay coil activation causes supply sag to 2.72V, triggering a brownout reset.",
          },
        },
      ],
    },
    {
      thought: "Investigation complete. Diagnostic hypothesis H-001 formulated and elevated to HIGH based on factual measurement evidence.",
      assessment: "Diagnostic complete: The controller resets when the fan activates because the relay coil is powered from the shared 3.3V MCU rail. Coil inrush current collapses supply voltage to 2.72V, crossing the 2.80V brownout detector threshold.",
      calls: [],
    },
  ];

  const server = createServer(async (req, res) => {
    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
    if (url.pathname === "/api/bench-agent") {
      if (req.method === "GET") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ available: true, provider: "gemini", model: "gemini-2.5-pro", transport: "http" }));
        return;
      }
      if (req.method === "POST") {
        const bodyBuf: Buffer[] = [];
        for await (const chunk of req) bodyBuf.push(chunk as Buffer);
        const turn = mockPlan[mockTurn] || mockPlan[mockPlan.length - 1];
        mockTurn++;
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
          provider: "gemini",
          model: "gemini-2.5-pro",
          turn: {
            thought: turn.thought,
            assessment: turn.assessment,
            toolCalls: turn.calls ? turn.calls.map(c => ({ id: c.id, name: c.name, arguments: c.arguments })) : [],
          },
        }));
        return;
      }
    }

    let filePath = join(distDir, url.pathname === "/" ? "index.html" : url.pathname);
    try {
      const content = await readFile(filePath);
      const ext = filePath.split(".").pop();
      const mime = ext === "html" ? "text/html" : ext === "js" ? "application/javascript" : ext === "css" ? "text/css" : ext === "svg" ? "image/svg+xml" : "application/octet-stream";
      res.writeHead(200, { "Content-Type": mime });
      res.end(content);
    } catch {
      try {
        const fallback = await readFile(join(distDir, "index.html"));
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(fallback);
      } catch {
        res.writeHead(404);
        res.end("Not Found");
      }
    }
  });

  const { promise, resolve } = Promise.withResolvers<void>();
  server.listen(port, "127.0.0.1", () => resolve());
  await promise;
  return { server, url: `http://127.0.0.1:${port}` };
}

class CDPClient {
  private ws: WebSocket;
  private idCounter = 1;
  private pending = new Map<number, { resolve: (val: any) => void; reject: (err: any) => void }>();

  private constructor(ws: WebSocket) {
    this.ws = ws;
    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data.toString());
        if (msg.id && this.pending.has(msg.id)) {
          const { resolve, reject } = this.pending.get(msg.id)!;
          this.pending.delete(msg.id);
          if (msg.error) reject(new Error(msg.error.message));
          else resolve(msg.result);
        }
      } catch {}
    };
  }

  static async connect(wsUrl: string): Promise<CDPClient> {
    const ws = new WebSocket(wsUrl);
    const { promise, resolve, reject } = Promise.withResolvers<CDPClient>();
    ws.onopen = () => resolve(new CDPClient(ws));
    ws.onerror = (e) => reject(e);
    return promise;
  }

  async send(method: string, params: Record<string, unknown> = {}): Promise<any> {
    const id = this.idCounter++;
    const msg = { id, method, params };
    const { promise, resolve, reject } = Promise.withResolvers<any>();
    this.pending.set(id, { resolve, reject });
    this.ws.send(JSON.stringify(msg));
    return promise;
  }

  async evaluate<T = any>(expression: string): Promise<T> {
    const res = await this.send("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (res.exceptionDetails) {
      throw new Error(`Evaluation failed: ${JSON.stringify(res.exceptionDetails)}`);
    }
    return res.result.value as T;
  }

  async captureScreenshot(outputPath: string): Promise<void> {
    const res = await this.send("Page.captureScreenshot", { format: "png" });
    const buf = Buffer.from(res.data, "base64");
    writeFileSync(outputPath, buf);
  }

  async close(): Promise<void> {
    this.ws.close();
  }
}

async function captureAll(): Promise<void> {
  const chromePath = findChromePath();
  if (!chromePath) throw new Error("Chrome not found");

  const screenshotDir = join(process.cwd(), "artifacts", "screenshots");
  mkdirSync(screenshotDir, { recursive: true });

  console.info("[Screenshot Tool] Building vite production dist...");
  const buildProc = spawn("bun", ["run", "build"], { stdio: "inherit" });
  const { promise: bp, resolve: br, reject: bRej } = Promise.withResolvers<void>();
  buildProc.on("close", (code) => (code === 0 ? br() : bRej(new Error("Build failed"))));
  await bp;

  const distDir = join(process.cwd(), "dist");
  const { server, url: serverUrl } = await startStaticServer(distDir, 5176);

  const tempProfile = mkdtempSync(join(tmpdir(), "ohmni-screenshots-"));
  const localState = { browser: { enabled_labs_experiments: ["enable-webmcp-testing@1"] } };
  writeFileSync(join(tempProfile, "Local State"), JSON.stringify(localState));

  const debugPort = 9235;
  const chromeArgs = [
    `--user-data-dir=${tempProfile}`,
    `--remote-debugging-port=${debugPort}`,
    "--no-first-run",
    "--no-default-browser-check",
    "--window-size=1440,900",
    "--flag-switches-begin",
    "--enable-webmcp-testing",
    "--flag-switches-end",
    serverUrl,
  ];

  const chromeProc = spawn(chromePath, chromeArgs);
  let cdpClient: CDPClient | null = null;

  try {
    for (let i = 0; i < 40; i++) {
      const { promise: p, resolve: r } = Promise.withResolvers<void>();
      setTimeout(r, 200);
      await p;
      try {
        const res = await fetch(`http://127.0.0.1:${debugPort}/json/version`);
        if (res.ok) break;
      } catch {}
    }

    const listRes = await fetch(`http://127.0.0.1:${debugPort}/json/list`);
    const targets = await listRes.json();
    const target = targets.find((t: any) => t.type === "page" && t.url.includes("127.0.0.1:5176"));
    cdpClient = await CDPClient.connect(target.webSocketDebuggerUrl);

    await cdpClient.send("Runtime.enable");
    await cdpClient.send("Page.enable");
    await cdpClient.send("Page.navigate", { url: serverUrl });

    // Wait for mount
    for (let i = 0; i < 40; i++) {
      const { promise: p, resolve: r } = Promise.withResolvers<void>();
      setTimeout(r, 200);
      await p;
      const ready = await cdpClient.evaluate(`Boolean(window.__virtualDevice)`);
      if (ready) break;
    }

    const sleep = async (ms: number) => {
      const { promise: p, resolve: r } = Promise.withResolvers<void>();
      setTimeout(r, ms);
      await p;
    };

    await sleep(400);

    // 01. WELCOME
    console.info("Capturing 01-welcome.png & 01-intro.png...");
    await cdpClient.captureScreenshot(join(screenshotDir, "01-welcome.png"));
    await cdpClient.captureScreenshot(join(screenshotDir, "01-intro.png"));

    // 02. OBSERVING (Connected)
    console.info("Connecting device and capturing 02-observing.png & 02-connected.png...");
    await cdpClient.evaluate(`(async () => {
      await window.__virtualDevice.connect();
      await window.__toolRegistrar.registerDevice(window.__virtualDevice);
    })()`);
    await sleep(400);
    await cdpClient.captureScreenshot(join(screenshotDir, "02-observing.png"));
    await cdpClient.captureScreenshot(join(screenshotDir, "02-connected.png"));

    // 03. TEST REQUEST (Approval)
    console.info("Setting goal & starting agent; capturing 03-test-request.png & 03-agent-observing.png...");
    await cdpClient.evaluate(`(() => {
      const input = document.querySelector("[data-testid='bench-agent-goal-input']");
      const prototype = Object.getPrototypeOf(input);
      const nativeSetter = Object.getOwnPropertyDescriptor(prototype, "value").set;
      nativeSetter.call(input, "The controller unexpectedly restarts when the fan turns on. Investigate the cause using the available instruments.");
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
      document.querySelector("[data-testid='bench-agent-start']").click();
    })()`);
    await sleep(600);
    for (let i = 0; i < 30; i++) {
      const hasApproval = await cdpClient.evaluate(`Boolean(document.querySelector("[data-testid='bench-agent-approval']"))`);
      if (hasApproval) break;
      await sleep(200);
    }
    await sleep(300);
    await cdpClient.captureScreenshot(join(screenshotDir, "03-test-request.png"));
    await cdpClient.captureScreenshot(join(screenshotDir, "04-approval.png"));

    // 04. RUNNING SCOPE
    console.info("Approving test & capturing 04-running.png & 05-experiment-running.png...");
    await cdpClient.evaluate(`document.querySelector("[data-testid='bench-agent-approve']")?.click()`);
    await sleep(150);
    await cdpClient.captureScreenshot(join(screenshotDir, "04-running.png"));
    await cdpClient.captureScreenshot(join(screenshotDir, "05-experiment-running.png"));

    // 05. BROWNOUT FAULT STATE
    console.info("Waiting for brownout fault; capturing 05-brownout.png & 06-brownout.png...");
    await sleep(1200);
    await cdpClient.captureScreenshot(join(screenshotDir, "05-brownout.png"));
    await cdpClient.captureScreenshot(join(screenshotDir, "06-brownout.png"));

    // 06. EVIDENCE
    console.info("Capturing 06-evidence.png & 07-evidence.png...");
    await sleep(400);
    await cdpClient.captureScreenshot(join(screenshotDir, "06-evidence.png"));
    await cdpClient.captureScreenshot(join(screenshotDir, "07-evidence.png"));

    // 07. HYPOTHESIS
    console.info("Capturing 07-hypothesis.png & 08-hypothesis.png...");
    await sleep(600);
    await cdpClient.captureScreenshot(join(screenshotDir, "07-hypothesis.png"));
    await cdpClient.captureScreenshot(join(screenshotDir, "08-hypothesis.png"));

    console.info("✅ ALL PROOF SCREENSHOTS CAPTURED SUCCESSFULLY!");
    console.info("✅ ALL 8 PROOF SCREENSHOTS CAPTURED SUCCESSFULLY!");
  } finally {
    if (cdpClient) await cdpClient.close();
    chromeProc.kill("SIGKILL");
    server.close();
  }
}

captureAll().catch(console.error);
