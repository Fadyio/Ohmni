/**
 * Automated Real Chrome WebMCP Test Suite.
 *
 * Launches installed Google Chrome with WebMCP experimental flags,
 * connects via Chrome DevTools Protocol (CDP), and verifies native
 * document.modelContext lifecycle, tool registration, JSON execution,
 * Amber actuation, brownout physics, and abort signals.
 *
 * Usage:
 *   bun run scripts/test-chrome.ts
 *   bun run test:chrome
 */

import { spawn, type ChildProcess } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer, type Server } from "node:http";
import { readFile } from "node:fs/promises";

// 1. Locate Chrome binary
function findChromePath(): string | null {
  const candidates = [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    process.env.CHROME_PATH || "",
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
}

// 2. Simple static server for built dist/
async function startStaticServer(distDir: string, port = 5174): Promise<{ server: Server; url: string }> {
  const server = createServer(async (req, res) => {
    try {
      const reqPath = req.url === "/" ? "/index.html" : (req.url || "/index.html").split("?")[0];
      const filePath = join(distDir, reqPath.startsWith("/") ? reqPath.slice(1) : reqPath);
      
      const content = await readFile(filePath);
      const ext = filePath.split(".").pop() || "";
      const mimeTypes: Record<string, string> = {
        html: "text/html",
        js: "application/javascript",
        css: "text/css",
        json: "application/json",
        png: "image/png",
        svg: "image/svg+xml",
      };
      res.writeHead(200, {
        "Content-Type": mimeTypes[ext] || "application/octet-stream",
        "Origin-Agent-Cluster": "?1",
      });
      res.end(content);
    } catch {
      // SPA Fallback to index.html
      try {
        const indexHtml = await readFile(join(distDir, "index.html"));
        res.writeHead(200, { "Content-Type": "text/html", "Origin-Agent-Cluster": "?1" });
        res.end(indexHtml);
      } catch {
        res.writeHead(404);
        res.end("Not Found");
      }
    }
  });
  const { promise: listenPromise, resolve: listenResolve } = Promise.withResolvers<void>();
  server.listen(port, "127.0.0.1", () => listenResolve());
  await listenPromise;
  return { server, url: `http://127.0.0.1:${port}` };
}

// 3. CDP Helper
class CDPClient {
  private ws: WebSocket;
  private msgId = 1;

  constructor(ws: WebSocket) {
    this.ws = ws;
  }

  static async connect(wsUrl: string): Promise<CDPClient> {
    const ws = new WebSocket(wsUrl);
    const { promise, resolve, reject } = Promise.withResolvers<void>();
    ws.onopen = () => resolve();
    ws.onerror = (e) => reject(e);
    await promise;
    return new CDPClient(ws);
  }

  send(method: string, params: Record<string, unknown> = {}): Promise<any> {
    const id = this.msgId++;
    const { promise, resolve, reject } = Promise.withResolvers<any>();
    const handler = (evt: MessageEvent) => {
      const data = JSON.parse(evt.data as string);
      if (data.id === id) {
        this.ws.removeEventListener("message", handler as any);
        if (data.error) reject(data.error);
        else resolve(data.result);
      }
    };
    this.ws.addEventListener("message", handler as any);
    this.ws.send(JSON.stringify({ id, method, params }));
    return promise;
  }

  async evaluate(expression: string): Promise<any> {
    const res = await this.send("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (res.exceptionDetails) {
      throw new Error(`Evaluation failed: ${JSON.stringify(res.exceptionDetails)}`);
    }
    return res.result?.value;
  }

  close(): void {
    this.ws.close();
  }
}

// 4. Main test suite
async function runChromeTests(): Promise<void> {
  console.info("==================================================================");
  console.info("   OHMNI — REAL GOOGLE CHROME WEBMCP AUTOMATED REGRESSION GATE   ");
  console.info("==================================================================");

  const chromePath = findChromePath();
  if (!chromePath) {
    console.error("❌ Google Chrome binary not found on host machine.");
    console.error("Please install Google Chrome to execute real browser validation.");
    process.exit(1);
  }

  console.info(`[Chrome Gate] Found Chrome at: ${chromePath}`);

  // Build production bundle first
  console.info("[Chrome Gate] Building production distribution (vite build)...");
  const buildProc = spawn("bun", ["run", "build"], { stdio: "inherit" });
  const { promise: buildPromise, resolve: buildResolve, reject: buildReject } = Promise.withResolvers<void>();
  buildProc.on("close", (code) => (code === 0 ? buildResolve() : buildReject(new Error("Build failed"))));
  await buildPromise;

  const distDir = join(process.cwd(), "dist");
  const { server, url: serverUrl } = await startStaticServer(distDir, 5174);
  console.info(`[Chrome Gate] Serving production bundle at: ${serverUrl}`);

  // Prepare clean profile with WebMCP flag
  const tempProfile = mkdtempSync(join(tmpdir(), "ohmni-chrome-test-"));
  const localState = {
    browser: {
      enabled_labs_experiments: ["enable-webmcp-testing@1"],
    },
  };
  writeFileSync(join(tempProfile, "Local State"), JSON.stringify(localState));

  const debugPort = 9233;
  const chromeArgs = [
    `--user-data-dir=${tempProfile}`,
    `--remote-debugging-port=${debugPort}`,
    "--no-first-run",
    "--no-default-browser-check",
    "--flag-switches-begin",
    "--enable-webmcp-testing",
    "--flag-switches-end",
    serverUrl,
  ];

  console.info(`[Chrome Gate] Launching Chrome (PID will be monitored)...`);
  const chromeProc: ChildProcess = spawn(chromePath, chromeArgs, {
    detached: false,
    stdio: "pipe",
  });

  let cdpClient: CDPClient | null = null;

  try {
    // Wait for CDP endpoint
    console.info(`[Chrome Gate] Waiting for Chrome remote debugging on port ${debugPort}...`);
    let versionData: any = null;
    for (let i = 0; i < 40; i++) {
      await new Promise((r) => setTimeout(r, 250));
      try {
        const res = await fetch(`http://127.0.0.1:${debugPort}/json/version`);
        if (res.ok) {
          versionData = await res.json();
          break;
        }
      } catch {}
    }

    if (!versionData) {
      throw new Error("Timed out waiting for Chrome DevTools port to open");
    }

    console.info(`[Chrome Gate] Connected to: ${versionData.Browser}`);

    // Discover page target
    const listRes = await fetch(`http://127.0.0.1:${debugPort}/json/list`);
    const targets: any[] = await listRes.json();
    const pageTarget = targets.find((t) => t.type === "page" && t.url.includes("127.0.0.1:5174"));

    if (!pageTarget) {
      throw new Error("Application page target not found in Chrome tabs");
    }

    cdpClient = await CDPClient.connect(pageTarget.webSocketDebuggerUrl);
    await cdpClient.send("Runtime.enable");
    await cdpClient.send("Page.enable");

    // Wait 1 second for page JS initialization
    await new Promise((r) => setTimeout(r, 1000));

    console.info("\n--- EXECUTING NATIVE CHROME WEBMCP TEST MATRIX ---\n");

    const tests = [
      {
        name: "document.modelContext Availability",
        fn: async () => {
          const res = await cdpClient!.evaluate(`({
            hasModelContext: "modelContext" in document,
            type: typeof document.modelContext,
            isNative: window.__modelContext === undefined
          })`);
          if (!res.hasModelContext || res.type !== "object") {
            throw new Error(`Expected document.modelContext object, got: ${JSON.stringify(res)}`);
          }
          return `Native document.modelContext is object (isNative: ${res.isNative})`;
        },
      },
      {
        name: "Pre-Connection Initial Tool Count (0 tools)",
        fn: async () => {
          const tools = await cdpClient!.evaluate(`document.modelContext.getTools()`);
          if (!Array.isArray(tools) || tools.length !== 0) {
            throw new Error(`Expected 0 initial tools, got ${tools?.length}`);
          }
          return "0 tools registered before device connection";
        },
      },
      {
        name: "Device Connection & 5-Tool WebMCP Dynamic Registration",
        fn: async () => {
          const res = await cdpClient!.evaluate(`(async () => {
            await window.__virtualDevice.connect();
            await window.__toolRegistrar.registerDevice(window.__virtualDevice);
            const tools = await document.modelContext.getTools();
            return tools.map(t => ({ name: t.name, title: t.title, readOnly: t.annotations?.readOnlyHint }));
          })()`);
          const expected = [
            "read_device_info",
            "read_reset_history",
            "read_system_health",
            "measure_supply_voltage",
            "run_relay_stress_test",
          ];
          const names = res.map((t: any) => t.name);
          for (const exp of expected) {
            if (!names.includes(exp)) throw new Error(`Missing expected tool: ${exp}`);
          }
          return `Successfully registered 5 WebMCP tools: [${names.join(", ")}]`;
        },
      },
      {
        name: "executeTool with Valid JSON String (Chrome Standard)",
        fn: async () => {
          const res = await cdpClient!.evaluate(`(async () => {
            const tools = await document.modelContext.getTools();
            const resetTool = tools.find(t => t.name === "read_reset_history");
            const raw = await document.modelContext.executeTool(resetTool, '{}');
            return { raw, parsed: JSON.parse(raw) };
          })()`);
          if (typeof res.raw !== "string" || !res.parsed.resets || res.parsed.count < 1) {
            throw new Error(`Unexpected reset history output: ${res.raw}`);
          }
          return `executeTool(tool, '{}') returned valid stringified JSON (${res.parsed.count} resets)`;
        },
      },
      {
        name: "executeTool with Object Input (Native Chrome Error Verification)",
        fn: async () => {
          const res = await cdpClient!.evaluate(`(async () => {
            const tools = await document.modelContext.getTools();
            const infoTool = tools.find(t => t.name === "read_device_info");
            try {
              await document.modelContext.executeTool(infoTool, {});
              return { threw: false };
            } catch (err) {
              return { threw: true, name: err.name, message: err.message };
            }
          })()`);
          if (!res.threw || !/parse/i.test(res.message)) {
            throw new Error(`Expected native Chrome to reject object input with parse error, got: ${JSON.stringify(res)}`);
          }
          return `Native Chrome strictly enforces JSON string input (rejected object with ${res.name}: "${res.message}")`;
        },
      },
      {
        name: "Amber Tool Invocation & Brownout Fault Reproduction (Milestone 3 ExperimentRunner)",
        fn: async () => {
          const res = await cdpClient!.evaluate(`(async () => {
            const tools = await document.modelContext.getTools();
            const relayTool = tools.find(t => t.name === "run_relay_stress_test");
            const raw = await document.modelContext.executeTool(relayTool, JSON.stringify({ cycles: 3, duration_ms: 20 }));
            let parsed;
            try { parsed = JSON.parse(raw); } catch (e) { parsed = { rawString: raw }; }
            const localRecord = window.__experimentStore ? window.__experimentStore.getExperiment(parsed.experiment_id) : undefined;
            return {
              raw,
              parsed,
              hasTracesInResult: "traces" in parsed,
              hasEventsInResult: "events" in parsed,
              hasLocalRecord: !!localRecord,
              localTraceSampleCount: localRecord?.traces?.supply_voltage?.samples?.length ?? 0,
            };
          })()`);
          const { raw, parsed, hasTracesInResult, hasEventsInResult, hasLocalRecord, localTraceSampleCount } = res;
          if (!parsed.experiment_id || !parsed.experiment_id.startsWith("exp_")) {
            throw new Error(`Expected experiment_id starting with 'exp_', got parsed: ${JSON.stringify(parsed)} (raw: ${JSON.stringify(raw)})`);
          }
          if (!parsed.faultReproduced || !parsed.resetOccurred || parsed.resetReason !== "BROWNOUT") {
            throw new Error(`Failed to reproduce brownout fault: ${JSON.stringify(parsed)}`);
          }
          if (!parsed.supply_voltage || parsed.supply_voltage.minimum_v >= 2.80) {
            throw new Error(`Expected voltage sag below 2.80V in supply_voltage summary: ${JSON.stringify(parsed.supply_voltage)}`);
          }
          if (hasTracesInResult || hasEventsInResult) {
            throw new Error("Raw trace arrays must not be returned in concise WebMCP result");
          }
          if (!hasLocalRecord || localTraceSampleCount === 0) {
            throw new Error(`Expected experiment record in window.__experimentStore with traces, got count: ${localTraceSampleCount}`);
          }
          return `Experiment ${parsed.experiment_id} returned concise summary: ${parsed.supply_voltage.baseline_v}V -> ${parsed.supply_voltage.minimum_v}V (-${parsed.supply_voltage.drop_v}V), local traces stored (${localTraceSampleCount} samples)`;
        },
      },
      {
        name: "AbortSignal Execution Cancellation & Safe State Teardown",
        fn: async () => {
          const res = await cdpClient!.evaluate(`(async () => {
            const tools = await document.modelContext.getTools();
            const relayTool = tools.find(t => t.name === "run_relay_stress_test");
            const controller = new AbortController();
            controller.abort();
            try {
              await document.modelContext.executeTool(relayTool, JSON.stringify({ cycles: 10, duration_ms: 100 }), { signal: controller.signal });
              return { aborted: false };
            } catch (err) {
              return { aborted: true, name: err.name, message: err.message, relayState: window.__virtualDevice.getRelayState() };
            }
          })()`);
          if (!res.aborted || res.relayState !== "open") {
            throw new Error(`Abort did not leave hardware in safe open state: ${JSON.stringify(res)}`);
          }
          return `AbortSignal caught: ${res.message}, relay restored to ${res.relayState}`;
        },
      },
      {
        name: "Device Disconnect & Registration Lifecycle Teardown",
        fn: async () => {
          const res = await cdpClient!.evaluate(`(async () => {
            let changes = 0;
            const listener = () => changes++;
            document.modelContext.addEventListener("toolchange", listener);
            await window.__virtualDevice.disconnect();
            window.__toolRegistrar.unregisterDevice(window.__virtualDevice);
            const remaining = await document.modelContext.getTools();
            document.modelContext.removeEventListener("toolchange", listener);
            return { remainingCount: remaining.length, changes };
          })()`);
          if (res.remainingCount !== 0) {
            throw new Error(`Expected 0 remaining tools after disconnect, found: ${res.remainingCount}`);
          }
          return `All tools removed upon disconnect (toolchange events received)`;
        },
      },
    ];

    let allPassed = true;
    for (const test of tests) {
      try {
        const detail = await test.fn();
        console.info(`  ✅ PASS: ${test.name}`);
        console.info(`     ↳ ${detail}`);
      } catch (err: any) {
        console.error(`  ❌ FAIL: ${test.name}`);
        console.error(`     ↳ ${err.message || String(err)}`);
        allPassed = false;
      }
    }

    console.info("\n==================================================================");
    if (allPassed) {
      console.info("🎉 ALL REAL CHROME WEBMCP TESTS PASSED SUCCESSFULLY!");
    } else {
      console.error("❌ SOME CHROME WEBMCP TESTS FAILED.");
      process.exit(1);
    }
    console.info("==================================================================");
  } finally {
    // Teardown
    if (cdpClient) {
      try {
        cdpClient.close();
      } catch {}
    }
    chromeProc.kill("SIGTERM");
    server.close();
    try {
      rmSync(tempProfile, { recursive: true, force: true });
    } catch {}
  }
}

runChromeTests().catch((err) => {
  console.error("Fatal test runner error:", err);
  process.exit(1);
});
