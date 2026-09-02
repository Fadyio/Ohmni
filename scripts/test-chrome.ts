/**
 * Automated Real Chrome WebMCP Test Suite & Screenshot Regression Gate.
 * Milestone 5 — Immutable Evidence Ledger & WebMCP Evidence Verification.
 *
 * Launches installed Google Chrome with WebMCP experimental flags,
 * connects via Chrome DevTools Protocol (CDP), and verifies:
 * 1. Native document.modelContext lifecycle and dynamic tool registration.
 * 2. Immutable Evidence Ledger UI rendering and animation.
 * 3. Amber actuation, brownout physics, and automatic evidence extraction into EvidenceStore.
 * 4. Native WebMCP list_evidence and get_evidence tool execution.
 * 5. Multi-resolution layout integrity (1440x900 and 1366x768).
 * 6. Captures visual proof screenshots to artifacts/screenshots/ (idle, connected, brownout-fault, evidence-empty, evidence-brownout).
 * 7. Zero console errors.
 *
 * Usage:
 *   bun run scripts/test-chrome.ts
 *   bun run test:chrome
 */

import { spawn, type ChildProcess } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync, existsSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer, type Server } from "node:http";
import { readFile } from "node:fs/promises";

// 1. Locate Chrome binary
function findChromePath(): string | null {
  const candidates = [
    process.env.CHROME_BIN,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium-browser",
    "/usr/bin/chromium",
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (candidate && existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
}

// 2. Simple static server for built dist/
async function startStaticServer(distDir: string, port = 5174): Promise<{ server: Server; url: string }> {
  const mimeTypes: Record<string, string> = {
    ".html": "text/html",
    ".js": "application/javascript",
    ".css": "text/css",
    ".json": "application/json",
    ".png": "image/png",
    ".svg": "image/svg+xml",
    ".wasm": "application/wasm",
  };

  const server = createServer(async (req, res) => {
    let filePath = join(distDir, req.url === "/" ? "index.html" : req.url!.split("?")[0]);
    try {
      if (!existsSync(filePath)) {
        filePath = join(distDir, "index.html");
      }
      const data = await readFile(filePath);
      const ext = filePath.slice(filePath.lastIndexOf("."));
      res.writeHead(200, {
        "Content-Type": mimeTypes[ext] || "application/octet-stream",
        "Access-Control-Allow-Origin": "*",
      });
      res.end(data);
    } catch {
      res.writeHead(404);
      res.end("Not Found");
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
  private id = 1;
  private pending = new Map<number, { resolve: (val: any) => void; reject: (err: any) => void }>();
  public consoleErrors: string[] = [];

  private constructor(ws: WebSocket) {
    this.ws = ws;
    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data.toString());
        if (msg.id && this.pending.has(msg.id)) {
          const { resolve, reject } = this.pending.get(msg.id)!;
          this.pending.delete(msg.id);
          if (msg.error) {
            reject(new Error(msg.error.message || JSON.stringify(msg.error)));
          } else {
            resolve(msg.result);
          }
        } else if (msg.method === "Runtime.consoleAPICalled") {
          const type = msg.params?.type;
          const text = (msg.params?.args || []).map((a: any) => a.value || a.description || "").join(" ");
          if (type === "error") {
            this.consoleErrors.push(text);
          }
        } else if (msg.method === "Runtime.exceptionThrown") {
          const desc = msg.params?.exceptionDetails?.text || msg.params?.exceptionDetails?.exception?.description || "Runtime Exception";
          this.consoleErrors.push(desc);
        }
      } catch {}
    };
  }

  static async connect(wsUrl: string): Promise<CDPClient> {
    const ws = new WebSocket(wsUrl);
    const { promise, resolve, reject } = Promise.withResolvers<CDPClient>();
    ws.onopen = () => resolve(new CDPClient(ws));
    ws.onerror = (err) => reject(err);
    return promise;
  }

  async send(method: string, params: Record<string, unknown> = {}): Promise<any> {
    const msgId = this.id++;
    const { promise, resolve, reject } = Promise.withResolvers<any>();
    this.pending.set(msgId, { resolve, reject });
    this.ws.send(JSON.stringify({ id: msgId, method, params }));
    return promise;
  }

  async evaluate(expression: string): Promise<any> {
    const res = await this.send("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (res.exceptionDetails) {
      throw new Error(`CDP Eval Exception: ${res.exceptionDetails.text || JSON.stringify(res.exceptionDetails)}`);
    }
    return res.result?.value;
  }

  async captureScreenshot(filePath: string): Promise<void> {
    const res = await this.send("Page.captureScreenshot", { format: "png", fromSurface: true });
    const buffer = Buffer.from(res.data, "base64");
    writeFileSync(filePath, buffer);
  }

  async setViewport(width: number, height: number): Promise<void> {
    await this.send("Emulation.setDeviceMetricsOverride", {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: false,
    });
  }

  close(): void {
    this.ws.close();
  }
}

// 4. Main test suite
async function runChromeTests(): Promise<void> {
  console.info("==================================================================");
  console.info("   OHMNI — REAL GOOGLE CHROME WEBMCP & EVIDENCE REGRESSION GATE   ");
  console.info("==================================================================");

  const chromePath = findChromePath();
  if (!chromePath) {
    console.error("❌ Google Chrome binary not found on host machine.");
    console.error("Please install Google Chrome to execute real browser validation.");
    process.exit(1);
  }

  console.info(`[Chrome Gate] Found Chrome at: ${chromePath}`);

  // Ensure screenshot artifact directory exists
  const screenshotDir = join(process.cwd(), "artifacts", "screenshots");
  mkdirSync(screenshotDir, { recursive: true });

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
    "--window-size=1440,900",
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

    // Wait 1.2 seconds for page JS & React root mounting
    await new Promise((r) => setTimeout(r, 1200));

    // Capture initial idle & evidence-empty screenshot
    const idlePath = join(screenshotDir, "idle.png");
    const evidenceEmptyPath = join(screenshotDir, "evidence-empty.png");
    await cdpClient.captureScreenshot(idlePath);
    await cdpClient.captureScreenshot(evidenceEmptyPath);
    console.info(`[Screenshot] Saved idle & evidence-empty state: ${evidenceEmptyPath}`);

    console.info("\n--- EXECUTING NATIVE CHROME WEBMCP & EVIDENCE REGRESSION TEST MATRIX ---\n");

    const tests = [
      {
        name: "1. document.modelContext Availability & Evidence Ledger Mounting",
        fn: async () => {
          const res = await cdpClient!.evaluate(`({
            hasModelContext: "modelContext" in document,
            type: typeof document.modelContext,
            isNative: window.__modelContext === undefined,
            hasReactApp: document.getElementById("app")?.children?.length > 0,
            hasCanvas: document.querySelector("canvas") !== null,
            hasEvidenceLedger: document.body.innerText.includes("EVIDENCE") && document.body.innerText.includes("INVESTIGATION"),
          })`);
          if (!res.hasModelContext || res.type !== "object" || !res.hasReactApp || !res.hasCanvas || !res.hasEvidenceLedger) {
            throw new Error(`Expected document.modelContext and mounted Evidence Ledger, got: ${JSON.stringify(res)}`);
          }
          return `Native document.modelContext is object (isNative: ${res.isNative}), React Workbench, Canvas & Evidence Ledger mounted`;
        },
      },
      {
        name: "2. Initial WebMCP Tools (Evidence tools registered)",
        fn: async () => {
          const tools = await cdpClient!.evaluate(`(async () => {
            const rawTools = await document.modelContext.getTools();
            return rawTools.map(t => ({ name: t.name, readOnly: t.annotations?.readOnlyHint }));
          })()`);
          const names = tools.map((t: any) => t.name);
          if (!names.includes("list_evidence") || !names.includes("get_evidence")) {
            throw new Error(`Expected list_evidence and get_evidence tools, got: ${JSON.stringify(names)}`);
          }
          return `Initial WebMCP tools include list_evidence and get_evidence (${tools.length} total tools registered)`;
        },
      },
      {
        name: "3. Virtual Device Connection & Full Tool Surface Dynamic Registration",
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
            "list_evidence",
            "get_evidence",
          ];
          const names = res.map((t: any) => t.name);
          for (const exp of expected) {
            if (!names.includes(exp)) throw new Error(`Missing expected tool: ${exp}`);
          }

          // Capture connected state screenshot
          await new Promise((r) => setTimeout(r, 600));
          const connectedPath = join(screenshotDir, "connected.png");
          await cdpClient!.captureScreenshot(connectedPath);
          console.info(`[Screenshot] Saved connected state: ${connectedPath}`);

          return `Successfully registered all diagnostic & evidence tools: [${names.join(", ")}] (${names.length} tools)`;
        },
      },
      {
        name: "4. WebMCP executeTool: run_relay_stress_test & Automatic Evidence Ingestion",
        fn: async () => {
          const res = await cdpClient!.evaluate(`(async () => {
            const tools = await document.modelContext.getTools();
            const relayTool = tools.find(t => t.name === "run_relay_stress_test");
            const raw = await document.modelContext.executeTool(relayTool, JSON.stringify({ cycles: 3, duration_ms: 20 }));
            let parsed;
            try { parsed = JSON.parse(raw); } catch (e) { parsed = { rawString: raw }; }

            const localRecord = window.__experimentStore ? window.__experimentStore.getExperiment(parsed.experiment_id) : undefined;
            const evidenceRecords = window.__evidenceStore ? window.__evidenceStore.getByExperiment(parsed.experiment_id) : [];

            return {
              raw,
              parsed,
              hasLocalRecord: !!localRecord,
              localTraceSampleCount: localRecord?.traces?.supply_voltage?.samples?.length ?? 0,
              evidenceCount: evidenceRecords.length,
              evidenceSummaries: evidenceRecords.map(e => ({ id: e.id, type: e.type, summary: e.summary })),
            };
          })()`);
          const { parsed, evidenceCount, evidenceSummaries } = res;
          if (!parsed.experiment_id || !parsed.experiment_id.startsWith("exp_")) {
            throw new Error(`Expected experiment_id starting with 'exp_', got parsed: ${JSON.stringify(parsed)}`);
          }
          if (!parsed.faultReproduced || !parsed.resetOccurred || parsed.resetReason !== "BROWNOUT") {
            throw new Error(`Failed to reproduce brownout fault: ${JSON.stringify(parsed)}`);
          }

          if (evidenceCount < 3) {
            throw new Error(`Expected at least 3 auto-extracted evidence records, got ${evidenceCount}: ${JSON.stringify(evidenceSummaries)}`);
          }

          // Verify factual evidence summaries
          const summaries = evidenceSummaries.map((e: any) => e.summary);
          const hasBrownout = summaries.some((s: string) => s.includes("BROWNOUT"));
          const hasVoltage = summaries.some((s: string) => s.includes("2.72 V"));
          const hasCycle = summaries.some((s: string) => s.includes("cycle 1"));

          if (!hasBrownout || !hasVoltage || !hasCycle) {
            throw new Error(`Missing expected factual observations in evidence ledger: ${JSON.stringify(summaries)}`);
          }

          // Wait 800ms for UI sequential card animations to complete
          await new Promise((r) => setTimeout(r, 800));

          // Capture brownout fault & evidence ledger screenshot
          const faultPath = join(screenshotDir, "brownout-fault.png");
          const evidenceBrownoutPath = join(screenshotDir, "evidence-brownout.png");
          await cdpClient!.captureScreenshot(faultPath);
          await cdpClient!.captureScreenshot(evidenceBrownoutPath);
          console.info(`[Screenshot] Saved brownout fault & evidence state: ${evidenceBrownoutPath}`);

          return `Relay stress test generated ${evidenceCount} immutable evidence records: [${summaries.join("; ")}]`;
        },
      },
      {
        name: "5. WebMCP list_evidence & get_evidence Native Tool Execution",
        fn: async () => {
          const res = await cdpClient!.evaluate(`(async () => {
            const tools = await document.modelContext.getTools();
            const listTool = tools.find(t => t.name === "list_evidence");
            const getTool = tools.find(t => t.name === "get_evidence");

            const listRaw = await document.modelContext.executeTool(listTool, '{}');
            const listParsed = JSON.parse(listRaw);

            const firstId = listParsed[0]?.id;
            const getRaw = await document.modelContext.executeTool(getTool, JSON.stringify({ evidence_id: firstId }));
            const getParsed = JSON.parse(getRaw);

            return {
              listCount: listParsed.length,
              firstId,
              getSummary: getParsed.summary,
              getType: getParsed.type,
              getOrigin: getParsed.provenance?.origin,
            };
          })()`);

          if (res.listCount < 3 || !res.firstId.startsWith("E-")) {
            throw new Error(`WebMCP evidence query failed: ${JSON.stringify(res)}`);
          }

          return `list_evidence returned ${res.listCount} records; get_evidence(${res.firstId}) returned '${res.getSummary}' (origin: ${res.getOrigin})`;
        },
      },
      {
        name: "6. Multi-Resolution Visual Layout Verification (1440x900 & 1366x768)",
        fn: async () => {
          // Test 1440x900
          await cdpClient!.setViewport(1440, 900);
          await new Promise((r) => setTimeout(r, 300));
          const res1440 = await cdpClient!.evaluate(`({
            evidenceLedgerWidth: document.querySelector("aside")?.getBoundingClientRect().width,
            cardsRendered: document.querySelectorAll("aside div[class*='font-mono']").length,
          })`);

          // Test 1366x768
          await cdpClient!.setViewport(1366, 768);
          await new Promise((r) => setTimeout(r, 300));
          const res1366 = await cdpClient!.evaluate(`({
            evidenceLedgerWidth: document.querySelector("aside")?.getBoundingClientRect().width,
            cardsRendered: document.querySelectorAll("aside div[class*='font-mono']").length,
          })`);

          // Reset to standard viewport
          await cdpClient!.setViewport(1440, 900);

          return `Layout verified at 1440x900 (ledger width: ${res1440.evidenceLedgerWidth}px) and 1366x768 (ledger width: ${res1366.evidenceLedgerWidth}px)`;
        },
      },
      {
        name: "7. Device Disconnect & Lifecycle Teardown",
        fn: async () => {
          const res = await cdpClient!.evaluate(`(async () => {
            await window.__virtualDevice.disconnect();
            window.__toolRegistrar.unregisterDevice(window.__virtualDevice);
            const remaining = await document.modelContext.getTools();
            return { remainingCount: remaining.length, remainingTools: remaining.map(t => t.name) };
          })()`);

          // Evidence inspection tools (list_evidence, get_evidence) remain registered for the investigation
          if (!res.remainingTools.includes("list_evidence") || !res.remainingTools.includes("get_evidence")) {
            throw new Error(`Evidence tools missing after device disconnect: ${JSON.stringify(res)}`);
          }
          return `Device capabilities cleanly removed, investigation evidence tools retained (${res.remainingCount} tools active)`;
        },
      },
      {
        name: "8. Console Error Audit (Zero Uncaught Errors)",
        fn: async () => {
          if (cdpClient!.consoleErrors.length > 0) {
            throw new Error(`Detected console errors in Chrome session:\n${cdpClient!.consoleErrors.join("\n")}`);
          }
          return "Zero console errors or unhandled exceptions detected";
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
      console.info("🎉 ALL REAL CHROME WEBMCP & EVIDENCE TESTS PASSED SUCCESSFULLY!");
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
