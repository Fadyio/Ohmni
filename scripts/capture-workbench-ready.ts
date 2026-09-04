import { spawn, execSync, type ChildProcess } from "node:child_process";
import { mkdtempSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer, type Server } from "node:http";
import { readFile } from "node:fs/promises";

function findChromePath(): string | null {
  const envPath = process.env.CHROME_BIN || process.env.GOOGLE_CHROME_BIN;
  if (envPath && existsSync(envPath)) return envPath;

  const paths = [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ];
  for (const p of paths) {
    if (existsSync(p)) return p;
  }
  return null;
}

const ARTIFACTS_DIR = join(process.cwd(), "artifacts", "screenshots");
if (!existsSync(ARTIFACTS_DIR)) {
  mkdirSync(ARTIFACTS_DIR, { recursive: true });
}

console.info("[Build] Building production distribution...");
execSync("bun run build", { stdio: "inherit" });

async function startVisualServer(distDir: string, port = 0): Promise<{ server: Server; url: string }> {
  const mimeTypes: Record<string, string> = {
    ".html": "text/html; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".woff2": "font/woff2",
  };

  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url || "/", "http://127.0.0.1");
      const filePath = join(distDir, url.pathname === "/" ? "index.html" : url.pathname);
      const ext = filePath.includes(".") ? filePath.substring(filePath.lastIndexOf(".")) : ".html";
      const contentType = mimeTypes[ext] || "text/html; charset=utf-8";

      try {
        const data = await readFile(filePath);
        res.writeHead(200, { "Content-Type": contentType, "Cache-Control": "no-cache" });
        res.end(data);
      } catch {
        const fallback = await readFile(join(distDir, "index.html"));
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(fallback);
      }
    } catch {
      res.writeHead(500);
      res.end("Internal Error");
    }
  });

  const { promise, resolve } = Promise.withResolvers<void>();
  server.listen(port, "127.0.0.1", () => resolve());
  await promise;
  const assignedPort = (server.address() as any).port;
  return { server, url: `http://127.0.0.1:${assignedPort}` };
}

class CDPClient {
  private ws: WebSocket;
  private nextId = 1;
  private pending = new Map<number, { resolve: (val: unknown) => void; reject: (err: Error) => void }>();
  public consoleErrors: string[] = [];

  private constructor(ws: WebSocket) {
    this.ws = ws;
    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data.toString()) as {
          id?: number;
          error?: { message?: string };
          result?: unknown;
          method?: string;
          params?: {
            type?: string;
            args?: Array<{ value?: string }>;
          };
        };
        if (data.id && this.pending.has(data.id)) {
          const { resolve, reject } = this.pending.get(data.id)!;
          this.pending.delete(data.id);
          if (data.error) {
            reject(new Error(data.error.message || JSON.stringify(data.error)));
          } else {
            resolve(data.result);
          }
        } else if (data.method === "Runtime.consoleAPICalled" && data.params) {
          const { type, args } = data.params;
          if (type === "error" && args) {
            this.consoleErrors.push(args.map((a) => a.value || JSON.stringify(a)).join(" "));
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

  async setViewport(width: number, height: number): Promise<void> {
    await this.send("Emulation.setDeviceMetricsOverride", {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: width < 600,
    });
  }

  async captureScreenshot(outputPath: string): Promise<void> {
    const raw = await this.send("Page.captureScreenshot", { format: "png" });
    const res = raw as { data: string };
    const buffer = Buffer.from(res.data, "base64");
    writeFileSync(outputPath, buffer);
    console.info(`  ✓ Captured screenshot: ${outputPath}`);
  }

  close(): void {
    try {
      this.ws.close();
    } catch {}
  }
}

async function run(): Promise<void> {
  const chromePath = findChromePath();
  if (!chromePath) throw new Error("Chrome not found");

  const distDir = join(process.cwd(), "dist");
  const { server, url } = await startVisualServer(distDir);
  const tempProfile = mkdtempSync(join(tmpdir(), "ohmni-wb-ready-"));
  const debugPort = 9260;

  const chromeProc: ChildProcess = spawn(
    chromePath,
    [
      `--remote-debugging-port=${debugPort}`,
      `--user-data-dir=${tempProfile}`,
      "--no-first-run",
      "--no-default-browser-check",
      "--headless=new",
      "--window-size=1440,900",
      "about:blank",
    ],
    { stdio: "pipe" }
  );

  let cdpClient: CDPClient | null = null;

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

    if (!pageTargetUrl) throw new Error("Failed to connect to Chrome tab");

    cdpClient = await CDPClient.connect(pageTargetUrl);
    await cdpClient.send("Runtime.enable");
    await cdpClient.send("Page.enable");
    await cdpClient.send("DOM.enable");

    // 1. Navigate to external mode
    console.info("\n[1/4] Navigating to homepage...");
    await cdpClient.send("Page.navigate", { url: `${url}/` });
    await new Promise((r) => setTimeout(r, 800));

    // Click "Launch virtual diagnosis"
    console.info("[2/4] Clicking 'Launch virtual diagnosis' to enter external workbench...");
    await cdpClient.evaluate(`document.getElementById("start-mystery-btn")?.click()`);
    await new Promise((r) => setTimeout(r, 600));

    // Verify Ready state elements in DOM
    const stateCheck = await cdpClient.evaluate<{
      isReadyScene: boolean;
      hasStartBtn: boolean;
      supplyText: string;
      relayText: string;
      resetsText: string;
      railStatus: string;
      hasPromptCard: boolean;
    }>(`(() => {
      const readyScene = document.querySelector('[data-scene="ready"]');
      const startBtn = document.getElementById("start-investigation-btn");
      const supplyTile = document.querySelector('[data-testid="baseline-tile-supply"]');
      const relayTile = document.querySelector('[data-testid="baseline-tile-relay"]');
      const resetsTile = document.querySelector('[data-testid="baseline-tile-resets"]');
      const railStatus = document.querySelector('[data-testid="bench-agent-status"]');
      const promptCard = document.querySelector('[data-testid="suggested-agent-prompt"]');

      return {
        isReadyScene: Boolean(readyScene),
        hasStartBtn: Boolean(startBtn),
        supplyText: supplyTile?.textContent || "",
        relayText: relayTile?.textContent || "",
        resetsText: resetsTile?.textContent || "",
        railStatus: railStatus?.textContent?.trim() || "",
        hasPromptCard: Boolean(promptCard)
      };
    })()`);

    console.info("\n=== External Workbench State Checks ===");
    console.info("Ready Scene present:", stateCheck.isReadyScene);
    console.info("Start investigation button present:", stateCheck.hasStartBtn, "(Expected: false)");
    console.info("Supply text:", stateCheck.supplyText);
    console.info("Relay text:", stateCheck.relayText);
    console.info("Reset history text:", stateCheck.resetsText);
    console.info("Rail status:", stateCheck.railStatus);
    console.info("Suggested prompt card present:", stateCheck.hasPromptCard);

    if (!stateCheck.isReadyScene) throw new Error("Workbench is not in ready scene");
    if (stateCheck.hasStartBtn) throw new Error("Start investigation button must NOT exist in external mode");
    if (!stateCheck.supplyText.includes("Not measured")) throw new Error("Supply must say 'Not measured'");
    if (!stateCheck.relayText.toLowerCase().includes("open")) throw new Error("Relay must say 'Open'");
    if (!stateCheck.resetsText.includes("Not inspected")) throw new Error("Reset history must say 'Not inspected'");
    if (!stateCheck.railStatus.includes("Waiting for tool calls")) throw new Error("Rail status must say 'Waiting for tool calls'");

    // Capture screenshots in pristine ready state before user clicks
    console.info("\n[3/4] Capturing screenshots across target viewports...");
    await cdpClient.setViewport(1440, 900);
    await new Promise((r) => setTimeout(r, 400));
    await cdpClient.captureScreenshot(join(ARTIFACTS_DIR, "workbench-ready-1440.png"));

    // Capture 1366x768
    await cdpClient.setViewport(1366, 768);
    await new Promise((r) => setTimeout(r, 400));
    await cdpClient.captureScreenshot(join(ARTIFACTS_DIR, "workbench-ready-1366.png"));

    // Capture 390x844 mobile
    await cdpClient.setViewport(390, 844);
    await new Promise((r) => setTimeout(r, 400));
    await cdpClient.captureScreenshot(join(ARTIFACTS_DIR, "workbench-ready-mobile.png"));

    // Check overflow on mobile
    const mobileOverflow = await cdpClient.evaluate<{ scrollWidth: number; clientWidth: number }>(`(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth
    }))()`);
    if (mobileOverflow.scrollWidth > mobileOverflow.clientWidth) {
      throw new Error(`Horizontal overflow on mobile: scrollWidth ${mobileOverflow.scrollWidth} > clientWidth ${mobileOverflow.clientWidth}`);
    }
    console.info("  ✓ Zero horizontal overflow on 390x844 mobile confirmed.");

    // Test Copy prompt button
    await cdpClient.setViewport(1440, 900);
    const copyResult = await cdpClient.evaluate<boolean>(`(() => {
      const btn = document.querySelector('[data-testid="copy-agent-prompt"]');
      if (btn) {
        btn.click();
        return true;
      }
      return false;
    })()`);
    console.info("Copy prompt clicked:", copyResult);

    // 4. Test Demo Mode
    console.info("\n[4/4] Testing Demo Mode walkthrough...");
    await cdpClient.setViewport(1440, 900);
    await cdpClient.send("Page.navigate", { url: `${url}/?agent=demo` });
    await new Promise((r) => setTimeout(r, 800));
    await cdpClient.evaluate(`document.getElementById("start-mystery-btn")?.click()`);
    await new Promise((r) => setTimeout(r, 500));
    // Click Begin investigation in mystery modal
    await cdpClient.evaluate(`document.querySelector('[data-testid="mystery-begin-btn"]')?.click()`);
    await new Promise((r) => setTimeout(r, 1200));

    // Confirm workbench entered
    const demoWorkbench = await cdpClient.evaluate<boolean>(`Boolean(document.getElementById("workbench-view"))`);
    console.info("Demo workbench entered:", demoWorkbench);

    console.info("\nConsole errors encountered:", cdpClient.consoleErrors.length);
    if (cdpClient.consoleErrors.length > 0) {
      console.error(cdpClient.consoleErrors);
    }
  } finally {
    if (cdpClient) cdpClient.close();
    chromeProc.kill("SIGKILL");
    server.close();
  }
}

run().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
