/**
 * scripts/generate-final-artifacts.ts
 *
 * Captures all 14 required final product screenshots and the full interaction video:
 * - artifacts/final/01-landing.png
 * - artifacts/final/02-agent-ready.png
 * - artifacts/final/03-observation.png
 * - artifacts/final/04-approval.png
 * - artifacts/final/05-experiment.png
 * - artifacts/final/06-fault.png
 * - artifacts/final/07-evidence.png
 * - artifacts/final/08-diagnosis.png
 * - artifacts/final/09-human-action.png
 * - artifacts/final/10-verification.png
 * - artifacts/final/11-result.png
 * - artifacts/final/12-connect-hardware.png
 * - artifacts/final/13-physical-device.png
 * - artifacts/final/14-webmcp-inspector.png
 * - artifacts/final-product-run.webm
 */

import { spawn, execSync, type ChildProcess } from "node:child_process";
import { mkdtempSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer, type Server } from "node:http";
import { readFile } from "node:fs/promises";

console.info("==================================================================");
console.info("   OHMNI — FINAL 14 SCREENSHOTS & FULL PRODUCT VIDEO CAPTURE      ");
console.info("==================================================================\n");

function findChromePath(): string {
  const standardPaths = [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary",
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
  ];
  for (const p of standardPaths) {
    if (existsSync(p)) return p;
  }
  throw new Error("Chrome binary not found.");
}

const FINAL_DIR = join(process.cwd(), "artifacts", "final");
mkdirSync(FINAL_DIR, { recursive: true });

async function startStaticServer(distDir: string, port = 5178): Promise<{ server: Server; url: string }> {
  const server = createServer(async (req, res) => {
    const parsedUrl = new URL(req.url || "/", `http://127.0.0.1:${port}`);
    let reqPath = parsedUrl.pathname;
    if (reqPath === "/") reqPath = "/index.html";

    const assetPath = join(distDir, reqPath);
    try {
      const data = await readFile(assetPath);
      const ext = assetPath.split(".").pop() || "";
      const mimeTypes: Record<string, string> = {
        html: "text/html",
        js: "application/javascript",
        css: "text/css",
        svg: "image/svg+xml",
        png: "image/png",
        json: "application/json",
      };
      res.writeHead(200, { "Content-Type": mimeTypes[ext] || "application/octet-stream" });
      res.end(data);
    } catch {
      try {
        const indexHtml = await readFile(join(distDir, "index.html"));
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(indexHtml);
      } catch {
        res.writeHead(404);
        res.end("Not Found");
      }
    }
  });

  await new Promise<void>((resolve) => server.listen(port, "127.0.0.1", resolve));
  return { server, url: `http://127.0.0.1:${port}` };
}

class CDPClient {
  private ws: WebSocket;
  private nextId = 1;
  private pending = new Map<number, { resolve: (val: unknown) => void; reject: (err: unknown) => void }>();
  public screencastFrames: Buffer[] = [];

  private constructor(ws: WebSocket) {
    this.ws = ws;
    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data.toString()) as {
          id?: number;
          method?: string;
          params?: { data?: string; sessionId?: number };
          error?: { message?: string };
          result?: unknown;
        };

        if (data.method === "Page.screencastFrame" && data.params?.data) {
          this.screencastFrames.push(Buffer.from(data.params.data, "base64"));
          if (data.params.sessionId !== undefined) {
            void this.send("Page.screencastFrameAck", { sessionId: data.params.sessionId });
          }
        }

        if (data.id && this.pending.has(data.id)) {
          const { resolve, reject } = this.pending.get(data.id)!;
          this.pending.delete(data.id);
          if (data.error) reject(new Error(data.error.message || JSON.stringify(data.error)));
          else resolve(data.result);
        }
      } catch {}
    };
  }

  static async connect(wsUrl: string): Promise<CDPClient> {
    const ws = new WebSocket(wsUrl);
    await new Promise<void>((resolve, reject) => {
      ws.onopen = () => resolve();
      ws.onerror = (e) => reject(new Error(`WebSocket connection failed: ${String(e)}`));
    });
    return new CDPClient(ws);
  }

  send<T = unknown>(method: string, params: Record<string, unknown> = {}): Promise<T> {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve: resolve as (val: unknown) => void, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async evaluate<T = unknown>(expression: string): Promise<T> {
    const res = await this.send<{ result: { value: T; description?: string } }>("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    return res.result.value;
  }

  async captureScreenshot(filename: string): Promise<void> {
    const res = await this.send<{ data: string }>("Page.captureScreenshot", { format: "png" });
    const buffer = Buffer.from(res.data, "base64");
    const fullPath = join(FINAL_DIR, filename);
    writeFileSync(fullPath, buffer);
    console.info(`  📸 Saved: ${filename}`);
  }

  close(): void {
    try {
      this.ws.close();
    } catch {}
  }
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function runCapture() {
  console.info("[Build] Building production distribution (vite build)...");
  execSync("bun run build", { stdio: "inherit" });

  const distDir = join(process.cwd(), "dist");
  const { server, url: serverUrl } = await startStaticServer(distDir, 5178);

  const chromePath = findChromePath();
  const tmpProfile = mkdtempSync(join(tmpdir(), "ohmni-chrome-final-"));
  const debugPort = 9260;

  const chromeProc: ChildProcess = spawn(
    chromePath,
    [
      "--headless=new",
      `--remote-debugging-port=${debugPort}`,
      `--user-data-dir=${tmpProfile}`,
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-gpu",
      "--window-size=1440,900",
      "--enable-features=WebModelContext",
      serverUrl,
    ],
    { stdio: "ignore" }
  );

  let cdpClient: CDPClient | null = null;

  try {
    let connected = false;
    for (let i = 0; i < 40; i++) {
      try {
        const res = await fetch(`http://127.0.0.1:${debugPort}/json/list`);
        if (res.ok) {
          const list = (await res.json()) as Array<{ type: string; webSocketDebuggerUrl: string }>;
          const page = list.find((p) => p.type === "page");
          if (page) {
            cdpClient = await CDPClient.connect(page.webSocketDebuggerUrl);
            connected = true;
            break;
          }
        }
      } catch {}
      await sleep(150);
    }
    if (!connected || !cdpClient) throw new Error("Failed to connect to Chrome via CDP");

    await cdpClient.send("Runtime.enable");
    await cdpClient.send("Page.enable");
    await cdpClient.send("Emulation.setDeviceMetricsOverride", {
      width: 1440,
      height: 900,
      deviceScaleFactor: 2,
      mobile: false,
    });

    // Start video screencast
    await cdpClient.send("Page.startScreencast", { format: "jpeg", quality: 90, everyNthFrame: 1 });

    console.info("\n[1/14] Capturing 01-landing.png...");
    await sleep(600);
    await cdpClient.captureScreenshot("01-landing.png");

    console.info("\n[2/14] Entering workbench -> 02-agent-ready.png...");
    await cdpClient.evaluate(`document.querySelector("[data-testid='start-mystery-btn']").click()`);
    await sleep(600);
    await cdpClient.captureScreenshot("02-agent-ready.png");

    console.info("\n[3/14] Executing read_reset_history -> 03-observation.png...");
    await cdpClient.evaluate(`(() => {
      const modelContext = window.__agentModelContext || document.modelContext;
      if (modelContext && modelContext.executeTool) {
        modelContext.executeTool("read_reset_history", {});
      }
    })()`);
    await sleep(700);
    await cdpClient.captureScreenshot("03-observation.png");

    console.info("\n[4/14] Calling run_relay_stress_test -> 04-approval.png...");
    await cdpClient.evaluate(`(() => {
      const modelContext = window.__agentModelContext || document.modelContext;
      if (modelContext && modelContext.executeTool) {
        modelContext.executeTool("run_relay_stress_test", { duration_ms: 200 });
      }
    })()`);
    await sleep(700);
    await cdpClient.captureScreenshot("04-approval.png");

    console.info("\n[5/14] Approving stress test -> 05-experiment.png & 06-fault.png...");
    // Click approve
    await cdpClient.evaluate(`(() => {
      const btn = document.querySelector("[data-testid='approval-approve-btn']") || document.querySelector("[data-testid='bench-agent-approve']");
      if (btn) btn.click();
    })()`);
    await sleep(150);
    await cdpClient.captureScreenshot("05-experiment.png");

    // Wait for fault reproduced state
    await sleep(800);
    await cdpClient.captureScreenshot("06-fault.png");

    console.info("\n[7/14] Reviewing evidence -> 07-evidence.png...");
    await cdpClient.evaluate(`(() => {
      const modelContext = window.__agentModelContext || document.modelContext;
      if (modelContext && modelContext.executeTool) {
        modelContext.executeTool("list_evidence", {});
      }
    })()`);
    await sleep(600);
    await cdpClient.captureScreenshot("07-evidence.png");

    console.info("\n[8/14] Proposing hypothesis -> 08-diagnosis.png...");
    await cdpClient.evaluate(`(() => {
      const modelContext = window.__agentModelContext || document.modelContext;
      if (modelContext && modelContext.executeTool) {
        modelContext.executeTool("propose_hypothesis", {
          title: "Relay activation is collapsing the MCU supply rail.",
          confidence: "HIGH",
          supporting_evidence_ids: ["E-001", "E-002", "E-003"],
        });
      }
    })()`);
    await sleep(600);
    await cdpClient.captureScreenshot("08-diagnosis.png");

    console.info("\n[9/14] Requesting human intervention -> 09-human-action.png...");
    await cdpClient.evaluate(`(() => {
      const proceedBtn = document.querySelector("[data-testid='proceed-to-repair-btn']");
      if (proceedBtn) {
        proceedBtn.click();
      } else {
        const modelContext = window.__agentModelContext || document.modelContext;
        if (modelContext && modelContext.executeTool) {
          modelContext.executeTool("request_human_intervention", {
            target: "relay_power_jumper",
            action: "move_to_5v",
            instruction: "Move relay power jumper from shared 3.3V rail to independent 5V supply.",
          });
        }
      }
    })()`);
    await sleep(700);
    await cdpClient.captureScreenshot("09-human-action.png");

    console.info("\n[10/14] Moving JP1 jumper & running verification -> 10-verification.png...");
    await cdpClient.evaluate(`(() => {
      const jp1Btn = document.querySelector("[data-testid='simulate-jp1-btn']");
      if (jp1Btn) jp1Btn.click();
    })()`);
    await sleep(400);

    // Tell agent I've changed it / run verification
    await cdpClient.evaluate(`(() => {
      const tellBtn = document.querySelector("[data-testid='tell-agent-repair-btn']");
      if (tellBtn) tellBtn.click();
    })()`);
    await sleep(500);

    // If verification requires approval
    await cdpClient.evaluate(`(() => {
      const approveBtn = document.querySelector("[data-testid='approval-approve-btn']") || document.querySelector("[data-testid='bench-agent-approve']");
      if (approveBtn) approveBtn.click();
    })()`);
    await sleep(800);
    await cdpClient.captureScreenshot("10-verification.png");

    console.info("\n[11/14] Capturing final result -> 11-result.png...");
    await sleep(600);
    await cdpClient.captureScreenshot("11-result.png");

    console.info("\n[12/14] Opening Connect Hardware modal -> 12-connect-hardware.png...");
    // Return to landing or trigger connect hardware
    await cdpClient.send("Page.navigate", { url: serverUrl });
    await sleep(600);
    await cdpClient.evaluate(`document.querySelector("[data-testid='connect-hardware-btn']").click()`);
    await sleep(500);
    await cdpClient.captureScreenshot("12-connect-hardware.png");

    console.info("\n[13/14] Testing physical device visualization -> 13-physical-device.png...");
    await cdpClient.evaluate(`(() => {
      const tryWithoutBtn = document.querySelector("[data-testid='try-without-hardware-btn']");
      if (tryWithoutBtn) {
        tryWithoutBtn.click();
      }
    })()`);
    await sleep(700);
    await cdpClient.captureScreenshot("13-physical-device.png");

    console.info("\n[14/14] Opening WebMCP Instrument Inspector drawer -> 14-webmcp-inspector.png...");
    await cdpClient.evaluate(`(() => {
      const badge = document.querySelector("[data-testid='webmcp-mode-badge']");
      if (badge) badge.click();
    })()`);
    await sleep(600);
    await cdpClient.captureScreenshot("14-webmcp-inspector.png");

    console.info("\n[Video] Stopping screencast and encoding final-product-run.webm...");
    await cdpClient.send("Page.stopScreencast");
    console.info(`[Video] Total recorded frames: ${cdpClient.screencastFrames.length}`);

    const videoPath = join(process.cwd(), "artifacts", "final-product-run.webm");
    const framesDir = mkdtempSync(join(tmpdir(), "ohmni-final-run-"));
    for (let i = 0; i < cdpClient.screencastFrames.length; i++) {
      writeFileSync(join(framesDir, `frame_${String(i).padStart(5, "0")}.jpg`), cdpClient.screencastFrames[i]);
    }
    execSync(`ffmpeg -y -framerate 20 -i "${join(framesDir, "frame_%05d.jpg")}" -c:v libvpx-vp9 -b:v 1M "${videoPath}"`, {
      stdio: "ignore",
    });
    console.info(`  🎬 Video saved: artifacts/final-product-run.webm`);

    console.info("\n==================================================================");
    console.info("🎉 ALL 14 ARTIFACTS AND PRODUCT RUN VIDEO PRODUCED SUCCESSFULLY!   ");
    console.info("==================================================================\n");
  } finally {
    if (cdpClient) cdpClient.close();
    chromeProc.kill("SIGTERM");
    server.close();
  }
}

runCapture().catch((err) => {
  console.error("❌ Artifact generation failed:", err);
  process.exit(1);
});
