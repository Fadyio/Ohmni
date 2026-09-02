/**
 * Multi-Resolution Visual Layout Verification.
 * Captures real Chrome screenshots at 1366x768, 1440x900, and 1512x982.
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
  ];
  for (const p of paths) {
    try {
      if (require("node:fs").existsSync(p)) return p;
    } catch {}
  }
  return null;
}

async function startStaticServer(distDir: string, port = 5178): Promise<{ server: Server; url: string }> {
  const server = createServer(async (req, res) => {
    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
    if (url.pathname === "/api/bench-agent") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ available: true, model: "deterministic-bench-agent" }));
      return;
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

  async setViewport(width: number, height: number): Promise<void> {
    await this.send("Emulation.setDeviceMetricsOverride", {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: false,
    });
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

async function run(): Promise<void> {
  const chromePath = findChromePath();
  if (!chromePath) throw new Error("Chrome not found");

  const screenshotDir = join(process.cwd(), "artifacts", "screenshots");
  mkdirSync(screenshotDir, { recursive: true });

  const distDir = join(process.cwd(), "dist");
  const { server, url: serverUrl } = await startStaticServer(distDir, 5178);

  const tempProfile = mkdtempSync(join(tmpdir(), "ohmni-res-"));
  const debugPort = 9239;
  const chromeArgs = [
    `--user-data-dir=${tempProfile}`,
    `--remote-debugging-port=${debugPort}`,
    "--no-first-run",
    "--no-default-browser-check",
    "--window-size=1512,982",
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
    const target = targets.find((t: any) => t.type === "page" && t.url.includes("127.0.0.1:5178"));
    cdpClient = await CDPClient.connect(target.webSocketDebuggerUrl);

    await cdpClient.send("Runtime.enable");
    await cdpClient.send("Page.enable");
    await cdpClient.send("Page.navigate", { url: serverUrl });

    const sleep = async (ms: number) => {
      const { promise: p, resolve: r } = Promise.withResolvers<void>();
      setTimeout(r, ms);
      await p;
    };
    await sleep(600);

    // Connect device so workbench is in populated state
    await cdpClient.send("Runtime.evaluate", {
      expression: `(async () => {
        if (window.__virtualDevice) {
          await window.__virtualDevice.connect();
          if (window.__toolRegistrar) await window.__toolRegistrar.registerDevice(window.__virtualDevice);
        }
      })()`,
      awaitPromise: true,
    });
    await sleep(400);

    const resolutions = [
      { name: "1366x768", width: 1366, height: 768 },
      { name: "1440x900", width: 1440, height: 900 },
      { name: "1512x982", width: 1512, height: 982 },
    ];

    for (const res of resolutions) {
      console.info(`Setting viewport to ${res.name}...`);
      await cdpClient.setViewport(res.width, res.height);
      await sleep(400);
      const outPath = join(screenshotDir, `res-${res.name}.png`);
      await cdpClient.captureScreenshot(outPath);
      console.info(`Saved ${outPath}`);
    }

    console.info("Multi-resolution screenshots captured successfully.");
  } finally {
    if (cdpClient) await cdpClient.close();
    chromeProc.kill("SIGKILL");
    server.close();
  }
}

run().catch(console.error);
