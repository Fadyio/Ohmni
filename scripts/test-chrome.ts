/**
 * Automated Real Chrome WebMCP Test Suite & Screenshot Regression Gate.
 * Milestone 7 — Real Bench Agent + Gemini Tool Orchestration.
 *
 * Launches installed Google Chrome with WebMCP experimental flags,
 * connects via Chrome DevTools Protocol (CDP), and verifies:
 * 1. Native document.modelContext lifecycle and dynamic tool discovery.
 * 2. Bench Agent UI mounting, idle state, and availability.
 * 3. Autonomous execution of Green/read-only tools (read_reset_history).
 * 4. Amber/controlled tool execution gate (run_relay_stress_test) pausing for human approval.
 * 5. Human approval resume and exact WebMCP tool execution.
 * 6. Evidence generation and WebMCP hypothesis synthesis (propose_hypothesis, link_evidence, update_hypothesis).
 * 7. Evidence-grounded hypothesis (H-001, HIGH) with zero unverified repair claims.
 * 8. Agent abort on device disconnect / STOP with complete state preservation.
 * 9. Multi-resolution layout integrity (1440x900 and 1366x768).
 * 10. Captures required visual proof screenshots to artifacts/screenshots/:
 *     - agent-idle.png
 *     - agent-investigating.png
 *     - agent-approval-request.png
 *     - agent-hypothesis.png
 * 11. Zero console errors.
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

function findChromePath(): string | null {
  const candidates = [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary",
    process.env.CHROME_BIN,
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

interface MockTurnPayload {
  readonly input?: unknown;
  readonly previousInteractionId?: string;
  readonly tools?: unknown[];
}

interface EvidenceDiscoveryItem {
  readonly id: string;
}

interface ChromeTargetItem {
  readonly id: string;
  readonly type: string;
  readonly url: string;
  readonly webSocketDebuggerUrl: string;
}

interface CDPVersionInfo {
  readonly Browser: string;
}

// Static server for built dist/ with deterministic /api/bench-agent mock
async function startStaticServer(distDir: string, port = 5174): Promise<{ server: Server; url: string }> {
  const mimeTypes: Record<string, string> = {
    ".html": "text/html; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
  };

  const sessionTurns = new Map<string, number>();
  let discoveredEvidenceIds: string[] = [];

  const server = createServer(async (req, res) => {
    try {
      const parsedUrl = new URL(req.url || "/", `http://127.0.0.1:${port}`);
      const reqPath = parsedUrl.pathname;

      // Handle Mock Bench Agent API for deterministic native browser loop testing
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

          // Step 1: User prompt -> call read_reset_history
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
          }
          // Step 2: Result of read_reset_history -> call run_relay_stress_test (Amber)
          else if (turnRequest.previousInteractionId === `interaction-${sessionId}-1` || turnCount === 2) {
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
          }
          // Step 3: Result of relay stress -> list_evidence
          else if (turnRequest.previousInteractionId === `interaction-${sessionId}-2` || turnCount === 3) {
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
          }
          // Step 4: Result of list_evidence -> propose_hypothesis
          else if (turnRequest.previousInteractionId === `interaction-${sessionId}-3` || turnCount === 4) {
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
          }
          // Step 5: Result of propose_hypothesis -> link_evidence (first record)
          else if (turnRequest.previousInteractionId === `interaction-${sessionId}-4` || turnCount === 5) {
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
          }
          // Step 6: Result of link_evidence 1 -> link_evidence (second record)
          else if (turnRequest.previousInteractionId === `interaction-${sessionId}-5` || turnCount === 6) {
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
                    relationship: "STRONGLY_SUPPORTS",
                    note: "Measured minimum voltage sag of 2.72V violates 2.80V rail threshold.",
                  },
                },
              ],
            };
          }
          // Step 7: Result of link_evidence 2 -> update_hypothesis to HIGH
          else if (turnRequest.previousInteractionId === `interaction-${sessionId}-6` || turnCount === 7) {
            const evList = discoveredEvidenceIds.length >= 2 ? discoveredEvidenceIds.slice(0, 2) : ["E-001", "E-002"];
            responseBody = {
              interactionId: `interaction-${sessionId}-7`,
              functionCalls: [
                {
                  id: "call-update-high",
                  name: "update_hypothesis",
                  arguments: {
                    hypothesis_id: "H-001",
                    confidence: "HIGH",
                    evidence_ids: evList,
                    reason: "Both reset log and oscilloscope trace confirm relay actuation causes supply voltage sag below 2.80V.",
                  },
                },
              ],
            };
          }
          // Step 8: Final diagnostic synthesis
          else {
            responseBody = {
              interactionId: `interaction-${sessionId}-8`,
              functionCalls: [],
              text: "Empirical diagnosis complete: Observed failures are caused by relay coil inrush drawing the 3.3V rail down to 2.72V, triggering a microcontroller brownout reset. Hypothesis H-001 elevated to HIGH confidence supported by cited evidence. Physical repair is NOT claimed as verified because jumper intervention has not been tested.",
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

      // Static File Serving
      const normalizedPath = reqPath === "/" ? "/index.html" : reqPath;
      const filePath = join(distDir, normalizedPath);
      const ext = normalizedPath.includes(".")
        ? normalizedPath.substring(normalizedPath.lastIndexOf("."))
        : ".html";
      const contentType = mimeTypes[ext] || "text/html; charset=utf-8";

      try {
        const data = await readFile(filePath);
        res.writeHead(200, {
          "Content-Type": contentType,
          "Cache-Control": "no-cache",
        });
        res.end(data);
      } catch {
        // Fallback for SPA routing
        try {
          const fallback = await readFile(join(distDir, "index.html"));
          res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
          res.end(fallback);
        } catch {
          res.writeHead(404);
          res.end("Not Found");
        }
      }
    } catch {
      res.writeHead(500);
      res.end("Internal Error");
    }
  });

  const { promise: listenPromise, resolve: listenResolve } = Promise.withResolvers<void>();
  server.listen(port, "127.0.0.1", () => listenResolve());
  await listenPromise;
  return { server, url: `http://127.0.0.1:${port}` };
}

// CDP Client
class CDPClient {
  private ws: WebSocket;
  private nextId = 1;
  private pending = new Map<number, { resolve: (val: unknown) => void; reject: (err: unknown) => void }>();
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
            args?: Array<{ value?: string; description?: string }>;
            exceptionDetails?: { text?: string; exception?: { description?: string } };
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
            const msg = args.map((a) => a.value || a.description || JSON.stringify(a)).join(" ");
            this.consoleErrors.push(msg);
          }
        } else if (data.method === "Runtime.exceptionThrown" && data.params) {
          const desc = data.params.exceptionDetails?.exception?.description || data.params.exceptionDetails?.text;
          this.consoleErrors.push(`Uncaught Exception: ${desc}`);
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
      mobile: false,
    });
  }

  async captureScreenshot(outputPath: string): Promise<void> {
    const raw = await this.send("Page.captureScreenshot", { format: "png" });
    const res = raw as { data: string };
    const buffer = Buffer.from(res.data, "base64");
    writeFileSync(outputPath, buffer);
  }

  close(): void {
    try {
      this.ws.close();
    } catch {}
  }
}

async function runChromeTests(): Promise<void> {
  console.info("==================================================================");
  console.info("   OHMNI — REAL GOOGLE CHROME WEBMCP AGENT ACCEPTANCE GATE        ");
  console.info("   Milestone 7: Real Bench Agent + Gemini Tool Orchestration      ");
  console.info("==================================================================");

  const chromePath = findChromePath();
  if (!chromePath) {
    console.error("❌ Google Chrome binary not found on host machine.");
    console.error("Please install Google Chrome to execute real browser validation.");
    process.exit(1);
  }

  console.info(`[Chrome Gate] Found Chrome at: ${chromePath}`);

  const screenshotDir = join(process.cwd(), "artifacts", "screenshots");
  mkdirSync(screenshotDir, { recursive: true });

  console.info("[Chrome Gate] Building production distribution (vite build)...");
  const buildProc = spawn("bun", ["run", "build"], { stdio: "inherit" });
  const { promise: buildPromise, resolve: buildResolve, reject: buildReject } = Promise.withResolvers<void>();
  buildProc.on("close", (code) => (code === 0 ? buildResolve() : buildReject(new Error("Build failed"))));
  await buildPromise;

  const distDir = join(process.cwd(), "dist");
  const { server, url: serverUrl } = await startStaticServer(distDir, 5174);
  console.info(`[Chrome Gate] Serving production bundle at: ${serverUrl}`);

  const tempProfile = mkdtempSync(join(tmpdir(), "ohmni-chrome-m7-test-"));
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

  console.info(`[Chrome Gate] Launching Chrome...`);
  const chromeProc: ChildProcess = spawn(chromePath, chromeArgs, {
    detached: false,
    stdio: "pipe",
  });

  let cdpClient: CDPClient | null = null;

  try {
    console.info(`[Chrome Gate] Waiting for Chrome remote debugging on port ${debugPort}...`);
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

    console.info(`[Chrome Gate] Connected to: ${versionData.Browser}`);

    let pageTarget: ChromeTargetItem | undefined;
    for (let i = 0; i < 30; i++) {
      try {
        const listRes = await fetch(`http://127.0.0.1:${debugPort}/json/list`);
        const targets = (await listRes.json()) as ChromeTargetItem[];
        pageTarget =
          targets.find((t) => t.type === "page" && t.url.includes("127.0.0.1:5174")) ??
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

    console.info(`[Connecting to target] id=${pageTarget.id} url=${pageTarget.url}`);
    cdpClient = await CDPClient.connect(pageTarget.webSocketDebuggerUrl);
    await cdpClient.send("Runtime.enable");
    await cdpClient.send("Page.enable");
    await cdpClient.send("Page.navigate", { url: serverUrl });

    console.info(`[Chrome Gate] Waiting for application mount...`);
    let mounted = false;
    for (let i = 0; i < 40; i++) {
      const { promise: sleepPromise, resolve: sleepResolve } = Promise.withResolvers<void>();
      setTimeout(sleepResolve, 250);
      await sleepPromise;
      try {
        const ready = await cdpClient.evaluate<boolean>(
          `Boolean(window.__virtualDevice && document.querySelector("[data-testid='bench-agent-panel']"))`
        );
        if (ready) {
          mounted = true;
          break;
        }
      } catch {}
    }
    if (!mounted) {
      throw new Error("Application failed to mount within 10 seconds");
    }

    const { promise: settlePromise, resolve: settleResolve } = Promise.withResolvers<void>();
    setTimeout(settleResolve, 500);
    await settlePromise;

    console.info("\n--- EXECUTING NATIVE CHROME WEBMCP & BENCH AGENT REGRESSION MATRIX ---\n");

    const tests = [
      {
        name: "1. document.modelContext Availability & Bench Agent Panel Mounting",
        fn: async () => {
          const res = await cdpClient!.evaluate<{
            hasModelContext: boolean;
            type: string;
            isNative: boolean;
            hasBenchAgentPanel: boolean;
            hasGoalInput: boolean;
            hasStartButton: boolean;
            hasInvestigation: boolean;
            hasHardware: boolean;
          }>(`({
            hasModelContext: "modelContext" in document,
            type: typeof document.modelContext,
            isNative: window.__modelContext === undefined,
            hasBenchAgentPanel: document.querySelector("[data-testid='bench-agent-panel']") !== null,
            hasGoalInput: document.querySelector("[data-testid='bench-agent-goal-input']") !== null,
            hasStartButton: document.querySelector("[data-testid='bench-agent-start']") !== null,
            hasInvestigation: document.body.innerText.includes("INVESTIGATION") || document.body.innerText.includes("Gemini"),
            hasHardware: document.querySelector("#hardware-target-node") !== null || document.querySelector("#hero-hardware-wrapper") !== null || document.querySelector("svg") !== null,
          })`);

          if (!res.hasModelContext || !res.hasBenchAgentPanel || !res.hasGoalInput || !res.hasStartButton || !res.hasHardware) {
            throw new Error(`Bench Agent UI failed to mount: ${JSON.stringify(res)}`);
          }

          const introPath = join(screenshotDir, "01-intro.png");
          const idlePath = join(screenshotDir, "idle.png");
          const agentIdlePath = join(screenshotDir, "agent-idle.png");
          await cdpClient!.captureScreenshot(introPath);
          await cdpClient!.captureScreenshot(idlePath);
          await cdpClient!.captureScreenshot(agentIdlePath);
          console.info(`[Screenshot] Saved 01-intro.png, idle.png, agent-idle.png`);
          return `document.modelContext active (isNative: ${res.isNative}), Bench Agent supervisor & canvas mounted`;
        },
      },
      {
        name: "2. Native Tool Registration & Bench Agent Reads getTools()",
        fn: async () => {
          const res = await cdpClient!.evaluate<{ count: number; toolNames: string[] }>(`(async () => {
            await window.__virtualDevice.connect();
            await window.__toolRegistrar.registerDevice(window.__virtualDevice);
            const tools = await document.modelContext.getTools();
            return {
              count: tools.length,
              toolNames: tools.map(t => t.name),
            };
          })()`);

          const expectedTools = [
            "read_device_info",
            "read_reset_history",
            "read_system_health",
            "measure_supply_voltage",
            "run_relay_stress_test",
            "list_evidence",
            "get_evidence",
            "propose_hypothesis",
            "update_hypothesis",
            "link_evidence",
            "reject_hypothesis",
            "list_hypotheses",
            "get_hypothesis",
          ];

          for (const exp of expectedTools) {
            if (!res.toolNames.includes(exp)) {
              throw new Error(`Missing expected WebMCP tool: ${exp}`);
            }
          }
          const connectedPath = join(screenshotDir, "02-connected.png");
          const connectedLegacyPath = join(screenshotDir, "connected.png");
          await cdpClient!.captureScreenshot(connectedPath);
          await cdpClient!.captureScreenshot(connectedLegacyPath);
          console.info(`[Screenshot] Saved 02-connected.png, connected.png`);

          return `Bench Agent discovered all ${res.count} native WebMCP instruments: [${res.toolNames.join(", ")}]`;
        },
      },
      {
        name: "3. Bench Agent Start & Autonomous Green Tool (read_reset_history) Execution",
        fn: async () => {
          // Set diagnostic goal
          await cdpClient!.evaluate(`(() => {
            const input = document.querySelector("[data-testid='bench-agent-goal-input']");
            const prototype = Object.getPrototypeOf(input);
            const nativeSetter = Object.getOwnPropertyDescriptor(prototype, "value").set;
            nativeSetter.call(input, "The controller unexpectedly restarts when the fan turns on. Investigate the cause using the available instruments.");
            input.dispatchEvent(new Event("input", { bubbles: true }));
            input.dispatchEvent(new Event("change", { bubbles: true }));
          })()`);

          // Wait for start button to become enabled
          let buttonEnabled = false;
          for (let i = 0; i < 30; i++) {
            buttonEnabled = await cdpClient!.evaluate<boolean>(
              `Boolean(document.querySelector("[data-testid='bench-agent-start']:not([disabled])"))`
            );
            if (buttonEnabled) break;
            const { promise: p, resolve: r } = Promise.withResolvers<void>();
            setTimeout(r, 100);
            await p;
          }

          if (!buttonEnabled) {
            throw new Error("Start button remained disabled after setting goal input");
          }

          // Click start
          await cdpClient!.evaluate(`document.querySelector("[data-testid='bench-agent-start']").click()`);

          // Wait for Turn 1 to execute autonomously and pause at Turn 2 amber call
          let greenExecuted = false;
          for (let i = 0; i < 30; i++) {
            const check = await cdpClient!.evaluate<{ count: number; hasResetHistory: boolean }>(`({
              count: document.querySelectorAll("[data-testid='bench-agent-activity-row']").length,
              hasResetHistory: Array.from(document.querySelectorAll("[data-testid='bench-agent-activity-row']")).some(el => el.innerText.includes("read_reset_history")),
            })`);
            if (check.count >= 1 && check.hasResetHistory) {
              greenExecuted = true;
              break;
            }
            const { promise: p, resolve: r } = Promise.withResolvers<void>();
            setTimeout(r, 150);
            await p;
          }

          if (!greenExecuted) {
            const dump = await cdpClient!.evaluate(`({
              status: document.querySelector("[data-testid='bench-agent-status']")?.innerText,
              error: (document.body.innerText.match(/FAILED[\s\S]{0,200}/) || [])[0],
              panelText: document.querySelector("[data-testid='bench-agent-panel']")?.innerText,
            })`);
            throw new Error(`Bench Agent failed: ${JSON.stringify(dump)}`);
          }

          const observingPath = join(screenshotDir, "03-agent-observing.png");
          const investigatingPath = join(screenshotDir, "agent-investigating.png");
          await cdpClient!.captureScreenshot(observingPath);
          await cdpClient!.captureScreenshot(investigatingPath);
          console.info(`[Screenshot] Saved 03-agent-observing.png, agent-investigating.png`);
          return `Green tool read_reset_history executed autonomously`;
        },
      },
      {
        name: "4. Amber Tool Call (run_relay_stress_test) Pauses for Human Approval",
        fn: async () => {
          let approvalVisible = false;
          let toolName = "";

          for (let i = 0; i < 20; i++) {
            const check = await cdpClient!.evaluate<{
              hasApprovalBox: boolean;
              hasApproveBtn: boolean;
              hasDenyBtn: boolean;
              text: string;
            }>(`({
              hasApprovalBox: document.querySelector("[data-testid='bench-agent-approval']") !== null,
              hasApproveBtn: document.querySelector("[data-testid='bench-agent-approve']") !== null,
              hasDenyBtn: document.querySelector("[data-testid='bench-agent-deny']") !== null,
              text: document.querySelector("[data-testid='bench-agent-approval']")?.innerText || "",
            })`);

            if (check.hasApprovalBox && check.hasApproveBtn) {
              approvalVisible = true;
              toolName = check.text;
              break;
            }
            const { promise: pollPromise, resolve: pollResolve } = Promise.withResolvers<void>();
            setTimeout(pollResolve, 200);
            await pollPromise;
          }

          if (!approvalVisible || !toolName.includes("run_relay_stress_test")) {
            throw new Error(`Amber tool did not pause for human approval: visible=${approvalVisible}, text=${toolName}`);
          }

          const approvalPath04 = join(screenshotDir, "04-approval.png");
          const approvalPath = join(screenshotDir, "agent-approval-request.png");
          await cdpClient!.captureScreenshot(approvalPath04);
          await cdpClient!.captureScreenshot(approvalPath);
          console.info(`[Screenshot] Saved 04-approval.png, agent-approval-request.png`);
          return `Amber tool run_relay_stress_test paused with explicit human approval dialog`;
        },
      },
      {
        name: "5. Human Approval Resumes Exact WebMCP Execution & Evidence Extraction",
        fn: async () => {
          await cdpClient!.evaluate(`(() => {
            const approveBtn = document.querySelector("[data-testid='bench-agent-approve']");
            approveBtn?.click();
          })()`);
          const expRunningPath = join(screenshotDir, "05-experiment-running.png");
          await cdpClient!.captureScreenshot(expRunningPath);
          console.info(`[Screenshot] Saved 05-experiment-running.png`);

          const { promise: waitEvidencePromise, resolve: waitEvidenceResolve } = Promise.withResolvers<void>();
          setTimeout(waitEvidenceResolve, 1500);
          await waitEvidencePromise;

          const res = await cdpClient!.evaluate<{ evidenceCount: number; hasResetEvent: boolean; hasMeasurement: boolean }>(`({
            evidenceCount: window.__evidenceStore ? window.__evidenceStore.getAll().length : 0,
            hasResetEvent: window.__evidenceStore ? window.__evidenceStore.getAll().some(e => e.type === "reset_event") : false,
            hasMeasurement: window.__evidenceStore ? window.__evidenceStore.getAll().some(e => e.type === "measurement") : false,
          })`);

          if (res.evidenceCount < 2 || !res.hasResetEvent || !res.hasMeasurement) {
            throw new Error(`Relay stress test approval execution failed to generate factual evidence: ${JSON.stringify(res)}`);
          }
          const brownoutPath06 = join(screenshotDir, "06-brownout.png");
          const brownoutLegacyPath = join(screenshotDir, "brownout-fault.png");
          await cdpClient!.captureScreenshot(brownoutPath06);
          await cdpClient!.captureScreenshot(brownoutLegacyPath);
          console.info(`[Screenshot] Saved 06-brownout.png, brownout-fault.png`);

          // Switch to evidence tab to capture evidence state
          await cdpClient!.evaluate(`(() => {
            const buttons = Array.from(document.querySelectorAll("button"));
            const evBtn = buttons.find(b => b.innerText.includes("Evidence"));
            evBtn?.click();
          })()`);
          const { promise: evP, resolve: evR } = Promise.withResolvers<void>();
          setTimeout(evR, 200);
          await evP;
          const evidencePath07 = join(screenshotDir, "07-evidence.png");
          const evidenceLegacyPath = join(screenshotDir, "evidence.png");
          await cdpClient!.captureScreenshot(evidencePath07);
          await cdpClient!.captureScreenshot(evidenceLegacyPath);
          console.info(`[Screenshot] Saved 07-evidence.png, evidence.png`);

          return `Approval resumed execution, generated ${res.evidenceCount} factual evidence records from hardware test`;
        },
      },
      {
        name: "6. Agent-Driven Hypothesis Synthesis & Confidence Elevation (HIGH)",
        fn: async () => {
          for (let i = 0; i < 15; i++) {
            const check = await cdpClient!.evaluate<{
              status: string;
              hasApproval: boolean;
              hasAssessment: boolean;
            }>(`({
              status: document.querySelector("[data-testid='bench-agent-status']")?.innerText || "",
              hasApproval: document.querySelector("[data-testid='bench-agent-approve']") !== null,
              hasAssessment: document.querySelector("[data-testid='bench-agent-assessment']") !== null,
            })`);

            if (check.hasApproval) {
              await cdpClient!.evaluate(`document.querySelector("[data-testid='bench-agent-approve']").click()`);
              const { promise: p, resolve: r } = Promise.withResolvers<void>();
              setTimeout(r, 400);
              await p;
            }

            if (check.status.includes("COMPLETED") || check.hasAssessment) {
              break;
            }
            const { promise: p2, resolve: r2 } = Promise.withResolvers<void>();
            setTimeout(r2, 300);
            await p2;
          }

          const { promise: settleP, resolve: settleR } = Promise.withResolvers<void>();
          setTimeout(settleR, 600);
          await settleP;

          const res = await cdpClient!.evaluate<{
            storedHypothesis: { confidence: string; supportingEvidenceIds: string[] } | null;
            assessmentText: string;
            statusText: string;
            uiContainsH001: boolean;
            uiContainsHigh: boolean;
          }>(`({
            storedHypothesis: window.__hypothesisStore ? window.__hypothesisStore.get("H-001") : null,
            assessmentText: document.querySelector("[data-testid='bench-agent-assessment']")?.innerText || "",
            statusText: document.querySelector("[data-testid='bench-agent-status']")?.innerText || "",
            uiContainsH001: document.body.innerText.includes("H-001"),
            uiContainsHigh: document.body.innerText.includes("HIGH"),
          })`);

          if (!res.storedHypothesis || res.storedHypothesis.confidence !== "HIGH") {
            throw new Error(`Failed to synthesize HIGH hypothesis H-001: ${JSON.stringify(res)}`);
          }

          if (res.storedHypothesis.supportingEvidenceIds.length < 2) {
            throw new Error(`Hypothesis H-001 must cite at least 2 supporting evidence records, got ${res.storedHypothesis.supportingEvidenceIds.length}`);
          }

          const lowerText = res.assessmentText.toLowerCase();
          if (lowerText.includes("verified fixed") || lowerText.includes("repair verified") || lowerText.includes("confirmed fixed")) {
            throw new Error(`Agent falsely claimed repair was verified: ${res.assessmentText}`);
          }

          // Switch to hypotheses tab to capture hypothesis state
          await cdpClient!.evaluate(`(() => {
            const buttons = Array.from(document.querySelectorAll("button"));
            const hypBtn = buttons.find(b => b.innerText.includes("Hypotheses"));
            hypBtn?.click();
          })()`);
          const { promise: hypP, resolve: hypR } = Promise.withResolvers<void>();
          setTimeout(hypR, 200);
          await hypP;

          const hypoPath08 = join(screenshotDir, "08-hypothesis.png");
          const hypothesesLegacyPath = join(screenshotDir, "hypotheses.png");
          const hypoPath = join(screenshotDir, "agent-hypothesis.png");
          await cdpClient!.captureScreenshot(hypoPath08);
          await cdpClient!.captureScreenshot(hypothesesLegacyPath);
          await cdpClient!.captureScreenshot(hypoPath);
          console.info(`[Screenshot] Saved 08-hypothesis.png, hypotheses.png, agent-hypothesis.png`);
          return `Hypothesis H-001 created & elevated to HIGH with ${res.storedHypothesis.supportingEvidenceIds.length} citations [${res.storedHypothesis.supportingEvidenceIds.join(", ")}]; No verified repair claimed`;
        },
      },
      {
        name: "7. Agent Disconnect / Stop State Preservation",
        fn: async () => {
          const before = await cdpClient!.evaluate<{ hCount: number; eCount: number }>(`({
            hCount: window.__hypothesisStore ? window.__hypothesisStore.getAll().length : 0,
            eCount: window.__evidenceStore ? window.__evidenceStore.getAll().length : 0,
          })`);

          await cdpClient!.evaluate(`(async () => {
            await window.__virtualDevice.disconnect();
            window.__toolRegistrar.unregisterDevice(window.__virtualDevice);
          })()`);

          const { promise: p, resolve: r } = Promise.withResolvers<void>();
          setTimeout(r, 400);
          await p;

          const after = await cdpClient!.evaluate<{ hCount: number; eCount: number; hasH001: boolean }>(`({
            hCount: window.__hypothesisStore ? window.__hypothesisStore.getAll().length : 0,
            eCount: window.__evidenceStore ? window.__evidenceStore.getAll().length : 0,
            hasH001: window.__hypothesisStore ? window.__hypothesisStore.get("H-001") !== undefined : false,
          })`);

          if (after.hCount !== before.hCount || after.eCount !== before.eCount || !after.hasH001) {
            throw new Error(`Investigation state was lost on disconnect: before=${JSON.stringify(before)}, after=${JSON.stringify(after)}`);
          }

          return `Disconnect preserved all ${after.hCount} hypotheses and ${after.eCount} evidence records`;
        },
      },
      {
        name: "8. Multi-Resolution Visual Layout Verification (1440x900 & 1366x768)",
        fn: async () => {
          // Test 1440x900
          await cdpClient!.setViewport(1440, 900);
          const { promise: p1, resolve: r1 } = Promise.withResolvers<void>();
          setTimeout(r1, 300);
          await p1;

          const res1440 = await cdpClient!.evaluate<{
            agentPanel: boolean;
            hasInvestigation: boolean;
            hasCanvas: boolean;
            scrollWidth: number;
            clientWidth: number;
          }>(`({
            agentPanel: document.querySelector("[data-testid='bench-agent-panel']") !== null,
            hasInvestigation: document.body.innerText.includes("INVESTIGATION"),
            hasCanvas: document.querySelector("canvas") !== null,
            scrollWidth: document.documentElement.scrollWidth,
            clientWidth: document.documentElement.clientWidth,
          })`);

          // Test 1366x768
          await cdpClient!.setViewport(1366, 768);
          const { promise: p2, resolve: r2 } = Promise.withResolvers<void>();
          setTimeout(r2, 300);
          await p2;

          const res1366 = await cdpClient!.evaluate<{
            agentPanel: boolean;
            hasInvestigation: boolean;
            hasCanvas: boolean;
            scrollWidth: number;
            clientWidth: number;
          }>(`({
            agentPanel: document.querySelector("[data-testid='bench-agent-panel']") !== null,
            hasInvestigation: document.body.innerText.includes("INVESTIGATION"),
            hasCanvas: document.querySelector("canvas") !== null,
            scrollWidth: document.documentElement.scrollWidth,
            clientWidth: document.documentElement.clientWidth,
          })`);

          // Reset to standard viewport
          await cdpClient!.setViewport(1440, 900);

          if (res1440.scrollWidth > res1440.clientWidth || res1366.scrollWidth > res1366.clientWidth) {
            throw new Error(`Horizontal layout overflow detected: 1440(${res1440.scrollWidth}/${res1440.clientWidth}), 1366(${res1366.scrollWidth}/${res1366.clientWidth})`);
          }

          return `Layout verified at 1440x900 and 1366x768 without horizontal overflow`;
        },
      },
      {
        name: "9. Console Error Audit (Zero Uncaught Errors)",
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
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`  ❌ FAIL: ${test.name}`);
        console.error(`     ↳ ${msg}`);
        allPassed = false;
      }
    }

    console.info("\n==================================================================");
    if (allPassed) {
      console.info("🎉 ALL REAL CHROME WEBMCP & BENCH AGENT TESTS PASSED SUCCESSFULLY!");
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
