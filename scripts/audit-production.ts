/**
 * scripts/audit-production.ts
 *
 * Automated Full Audit of https://ohmni-three.vercel.app
 * Runs against live production in Google Chrome via CDP.
 * Covers:
 * - Normal Chrome vs WebMCP flag enabled
 * - 1440x900, 1366x768, 1512x982 viewports
 * - User flows: Landing -> Agent-Ready Workbench -> Tool invocations -> Approval ->
 *   Experiment -> Evidence -> Diagnosis -> Repair -> Verify -> Result
 * - Connect Hardware modal -> Try without hardware -> Serial descriptor -> Generic physical device UI
 * - WebMCP Capability Drawer & Developer Inspector
 * - Captures screenshots into artifacts/audit/
 * - Logs all observations for docs/UX-AUDIT-FINAL.md
 */

import { spawn, type ChildProcess } from "node:child_process";
import { mkdtempSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const PROD_URL = "https://ohmni-three.vercel.app";
const AUDIT_DIR = join(process.cwd(), "artifacts", "audit");
if (!existsSync(AUDIT_DIR)) {
  mkdirSync(AUDIT_DIR, { recursive: true });
}

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

class CDPClient {
  private ws: WebSocket;
  private nextId = 1;
  private pending = new Map<number, { resolve: (val: unknown) => void; reject: (err: unknown) => void }>();
  public consoleErrors: string[] = [];
  public consoleLogs: string[] = [];

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
            args?: Array<{ value?: unknown; description?: string }>;
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
          const msg = (args || []).map((a) => a.value ?? a.description ?? JSON.stringify(a)).join(" ");
          if (type === "error") {
            this.consoleErrors.push(msg);
          } else {
            this.consoleLogs.push(`[${type}] ${msg}`);
          }
        } else if (data.method === "Runtime.exceptionThrown" && data.params) {
          const desc = data.params.exceptionDetails?.exception?.description || data.params.exceptionDetails?.text;
          this.consoleErrors.push(`Uncaught Exception: ${desc}`);
        }
      } catch (err) {
        console.error("CDP message error:", err);
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

  async captureScreenshot(filename: string): Promise<void> {
    const res = (await this.send("Page.captureScreenshot", { format: "png" })) as { data: string };
    const buffer = Buffer.from(res.data, "base64");
    const filePath = join(AUDIT_DIR, filename);
    writeFileSync(filePath, buffer);
    console.info(`[Screenshot] Saved: ${filename}`);
  }

  close(): void {
    try {
      this.ws.close();
    } catch {}
  }
}

interface ChromeSession {
  process: ChildProcess;
  client: CDPClient;
  cleanup: () => Promise<void>;
}

async function launchChrome(enableWebMcp = false, width = 1440, height = 900): Promise<ChromeSession> {
  const chromePath = findChromePath();
  const tempProfile = mkdtempSync(join(tmpdir(), "ohmni-audit-"));
  if (enableWebMcp) {
    const localState = {
      browser: {
        enabled_labs_experiments: ["enable-webmcp-testing@1"],
      },
    };
    writeFileSync(join(tempProfile, "Local State"), JSON.stringify(localState));
  }

  const debugPort = 9244;
  const args = [
    `--user-data-dir=${tempProfile}`,
    `--remote-debugging-port=${debugPort}`,
    "--no-first-run",
    "--no-default-browser-check",
    `--window-size=${width},${height}`,
  ];
  if (enableWebMcp) {
    args.push("--flag-switches-begin", "--enable-webmcp-testing", "--flag-switches-end");
  }
  args.push("about:blank");

  const proc = spawn(chromePath, args, { stdio: "ignore" });

  let wsUrl = "";
  for (let i = 0; i < 40; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${debugPort}/json/version`);
      if (res.ok) {
        const data = (await res.json()) as { webSocketDebuggerUrl?: string };
        if (data.webSocketDebuggerUrl) {
          const listRes = await fetch(`http://127.0.0.1:${debugPort}/json/list`);
          const pages = (await listRes.json()) as Array<{ webSocketDebuggerUrl?: string; type?: string }>;
          const page = pages.find((p) => p.type === "page") || pages[0];
          if (page?.webSocketDebuggerUrl) {
            wsUrl = page.webSocketDebuggerUrl;
            break;
          }
        }
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }

  if (!wsUrl) {
    proc.kill();
    throw new Error("Failed to connect to Chrome remote debugging port.");
  }

  const client = await CDPClient.connect(wsUrl);
  await client.send("Page.enable");
  await client.send("Runtime.enable");
  await client.setViewport(width, height);

  return {
    process: proc,
    client,
    cleanup: async () => {
      client.close();
      proc.kill("SIGTERM");
      await new Promise((r) => setTimeout(r, 500));
    },
  };
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function runAudit(): Promise<void> {
  console.info("==================================================================");
  console.info("   OHMNI — AUTOMATED PRODUCTION UX & WEBMCP AUDIT                ");
  console.info(`   Target: ${PROD_URL}`);
  console.info("==================================================================\n");

  const observations: Record<string, unknown> = {};

  // Session 1: Normal Chrome at 1440x900
  console.info("--- TEST SESSION 1: Normal Chrome (1440x900) ---");
  const session1 = await launchChrome(false, 1440, 900);
  const cdp1 = session1.client;

  try {
    await cdp1.send("Page.navigate", { url: PROD_URL });
    await sleep(2500);

    // 1. Landing Screen Audit
    await cdp1.captureScreenshot("01-landing-1440x900.png");
    const landingAudit = await cdp1.evaluate(`({
      title: document.title,
      headline: document.querySelector('h1')?.innerText,
      subline: document.querySelector('p')?.innerText,
      buttons: Array.from(document.querySelectorAll('button')).map(b => b.innerText.trim()).filter(Boolean),
      has3DLogo: Boolean(document.querySelector('canvas')),
      hasWebMCP: Boolean(window.modelContext || document.modelContext),
      webmcpMode: window.__webmcpMode,
      buildSha: window.__OHMNI_BUILD_SHA__,
      bodyText: document.body.innerText.slice(0, 1000)
    })`);
    observations.landing = landingAudit;
    console.info("[Landing Audit]:", landingAudit);

    // Test responsive viewports on landing
    console.info("Testing landing at 1366x768...");
    await cdp1.setViewport(1366, 768);
    await sleep(500);
    await cdp1.captureScreenshot("01-landing-1366x768.png");

    console.info("Testing landing at 1512x982...");
    await cdp1.setViewport(1512, 982);
    await sleep(500);
    await cdp1.captureScreenshot("01-landing-1512x982.png");

    // Reset back to 1440x900
    await cdp1.setViewport(1440, 900);
    await sleep(500);

    // 2. Open Connect Hardware Modal
    console.info("Testing Connect Hardware Modal...");
    const openedConnectModal = await cdp1.evaluate<boolean>(`(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Connect Hardware') || b.innerText.includes('Connect physical'));
      if (btn) { btn.click(); return true; }
      return false;
    })()`);
    await sleep(1000);
    await cdp1.captureScreenshot("02-connect-hardware-modal.png");
    const connectModalAudit = await cdp1.evaluate(`({
      modalTitle: document.querySelector('[role="dialog"] h2, [role="dialog"] h3, .modal h2')?.innerText,
      bodyText: document.querySelector('[role="dialog"]')?.innerText?.slice(0, 500),
      buttons: Array.from(document.querySelectorAll('[role="dialog"] button')).map(b => b.innerText.trim())
    })`);
    observations.connectHardwareModal = connectModalAudit;
    console.info("[Connect Hardware Modal Audit]:", connectModalAudit);

    // Close modal or click "Try without hardware"
    const clickedSim = await cdp1.evaluate<boolean>(`(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Try without hardware') || b.innerText.includes('Simulated') || b.innerText.includes('Virtual'));
      if (btn) { btn.click(); return true; }
      const closeBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Close') || b.getAttribute('aria-label') === 'Close');
      if (closeBtn) { closeBtn.click(); return true; }
      return false;
    })()`);
    console.info("[Clicked Simulator / Close]:", clickedSim);
    await sleep(1500);

    // 3. Open Agent-Ready Workbench
    console.info("Navigating into Agent-Ready Workbench...");
    const enterWorkbench = await cdp1.evaluate<boolean>(`(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Open agent-ready workbench') || b.innerText.includes('Open Agent-Ready Workbench') || b.innerText.includes('Start Investigation') || b.innerText.includes('Open workbench'));
      if (btn) { btn.click(); return true; }
      return false;
    })()`);
    console.info("[Entered Workbench]:", enterWorkbench);
    await sleep(2500);

    await cdp1.captureScreenshot("03-workbench-ready-1440x900.png");
    const readyAudit = await cdp1.evaluate(`({
      activeScene: document.querySelector('[data-scene]')?.getAttribute('data-scene'),
      topBar: {
        title: document.querySelector('header')?.innerText?.slice(0, 200),
        stages: Array.from(document.querySelectorAll('nav span, header span')).map(s => s.innerText.trim()).filter(Boolean)
      },
      rightRail: {
        heading: document.querySelector('aside h2, aside h3, [data-testid="agent-panel"] h2')?.innerText,
        text: document.querySelector('aside, [data-testid="agent-panel"]')?.innerText?.slice(0, 400)
      },
      mainCanvas: {
        heading: document.querySelector('main h1, main h2')?.innerText,
        text: document.querySelector('main')?.innerText?.slice(0, 400)
      },
      registeredToolsCount: (window.__agentModelContext?.listTools ? window.__agentModelContext.listTools().length : null)
    })`);
    observations.workbenchReady = readyAudit;
    console.info("[Workbench Ready Audit]:", readyAudit);

    // Check responsive viewports on workbench
    console.info("Testing workbench at 1366x768...");
    await cdp1.setViewport(1366, 768);
    await sleep(500);
    await cdp1.captureScreenshot("03-workbench-ready-1366x768.png");

    console.info("Testing workbench at 1512x982...");
    await cdp1.setViewport(1512, 982);
    await sleep(500);
    await cdp1.captureScreenshot("03-workbench-ready-1512x982.png");

    await cdp1.setViewport(1440, 900);
    await sleep(500);

    // 4. Manually invoke WebMCP tools through browser test harness
    console.info("\n--- INVOKING WEBMCP TOOLS VIA EXTERNAL-AGENT HARNESS ---");

    // Tool 1: read_device_info
    console.info("Invoking read_device_info...");
    const devInfoRes = await cdp1.evaluate(`(async () => {
      const mc = window.__agentModelContext || document.modelContext;
      if (!mc) return { error: "No modelContext" };
      return await (mc.executeTool ? mc.executeTool("read_device_info", {}) : mc.callTool("read_device_info", {}));
    })()`);
    console.info("[read_device_info Result]:", devInfoRes);
    await sleep(1000);
    await cdp1.captureScreenshot("04-after-read-device-info.png");

    // Tool 2: read_reset_history
    console.info("Invoking read_reset_history...");
    const resetHistRes = await cdp1.evaluate(`(async () => {
      const mc = window.__agentModelContext || document.modelContext;
      if (!mc) return { error: "No modelContext" };
      return await (mc.executeTool ? mc.executeTool("read_reset_history", {}) : mc.callTool("read_reset_history", {}));
    })()`);
    console.info("[read_reset_history Result]:", resetHistRes);
    await sleep(1500);
    await cdp1.captureScreenshot("05-observing-read-reset-history.png");
    const observeAudit = await cdp1.evaluate(`({
      activeScene: document.querySelector('[data-scene]')?.getAttribute('data-scene'),
      sceneHeadline: document.querySelector('[data-scene] h1, [data-scene] h2')?.innerText,
      mainText: document.querySelector('main')?.innerText?.slice(0, 500),
      railText: document.querySelector('aside')?.innerText?.slice(0, 300)
    })`);
    observations.observeScene = observeAudit;
    console.info("[Observe Scene Audit]:", observeAudit);

    // Tool 3: measure_supply_voltage
    console.info("Invoking measure_supply_voltage...");
    const voltageRes = await cdp1.evaluate(`(async () => {
      const mc = window.__agentModelContext || document.modelContext;
      if (!mc) return { error: "No modelContext" };
      return await (mc.executeTool ? mc.executeTool("measure_supply_voltage", {}) : mc.callTool("measure_supply_voltage", {}));
    })()`);
    console.info("[measure_supply_voltage Result]:", voltageRes);
    await sleep(1500);
    await cdp1.captureScreenshot("06-passive-measure-supply.png");
    const measureAudit = await cdp1.evaluate(`({
      activeScene: document.querySelector('[data-scene]')?.getAttribute('data-scene'),
      voltageDisplay: document.querySelector('.metric-large, [data-testid="voltage-display"]')?.innerText,
      mainText: document.querySelector('main')?.innerText?.slice(0, 500)
    })`);
    observations.measureScene = measureAudit;
    console.info("[Measure Scene Audit]:", measureAudit);

    // Tool 4: run_relay_stress_test (AMBER - requires human approval)
    console.info("Invoking run_relay_stress_test (Controlled Physical Actuation)...");
    const stressPromise = cdp1.evaluate(`(async () => {
      const mc = window.__agentModelContext || document.modelContext;
      if (!mc) return { error: "No modelContext" };
      return await (mc.executeTool ? mc.executeTool("run_relay_stress_test", { duration_ms: 300, target: "cooling_fan_relay" }) : mc.callTool("run_relay_stress_test", { duration_ms: 300, target: "cooling_fan_relay" }));
    })()`);
    // Wait for Amber Approval Screen to mount
    await sleep(1500);
    await cdp1.captureScreenshot("07-amber-approval-scene.png");
    const approvalAudit = await cdp1.evaluate(`({
      activeScene: document.querySelector('[data-scene]')?.getAttribute('data-scene'),
      heading: document.querySelector('main h1, main h2, [data-scene] h2')?.innerText,
      approvalButtons: Array.from(document.querySelectorAll('button')).map(b => b.innerText.trim()).filter(b => b.includes('Approve') || b.includes('Deny')),
      bodyText: document.querySelector('main')?.innerText?.slice(0, 600)
    })`);
    observations.approvalScene = approvalAudit;
    console.info("[Amber Approval Audit]:", approvalAudit);

    // Click "Approve test" or approve via gate
    console.info("Approving test in UI...");
    const approved = await cdp1.evaluate<boolean>(`(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.toLowerCase().includes('approve'));
      if (btn) { btn.click(); return true; }
      if (window.__toolApprovalGate) {
        const reqs = window.__toolApprovalGate.getPendingRequests();
        if (reqs.length > 0) {
          window.__toolApprovalGate.respond(reqs[0].id, "approve");
          return true;
        }
      }
      return false;
    })()`);
    console.info("[Approved in UI]:", approved);

    // Now experiment runs
    await sleep(1500);
    await cdp1.captureScreenshot("08-running-experiment-oscilloscope.png");
    const runningAudit = await cdp1.evaluate(`({
      activeScene: document.querySelector('[data-scene]')?.getAttribute('data-scene'),
      heading: document.querySelector('main h1, main h2')?.innerText,
      relayStatus: document.querySelector('[data-testid="relay-status"], .relay-indicator')?.innerText,
      canvasFound: Boolean(document.querySelector('canvas'))
    })`);
    observations.runningExperimentScene = runningAudit;
    console.info("[Running Experiment Audit]:", runningAudit);

    // Wait for experiment completion and stressPromise resolution
    const stressResult = await stressPromise;
    console.info("[run_relay_stress_test Result]:", stressResult);
    await sleep(2000);
    await cdp1.captureScreenshot("09-fault-reproduced.png");

    // Check evidence store & hypothesis tools
    console.info("Invoking list_evidence & propose_hypothesis...");
    const evidenceRes = await cdp1.evaluate(`(async () => {
      const mc = window.__agentModelContext || document.modelContext;
      return await (mc.executeTool ? mc.executeTool("list_evidence", {}) : mc.callTool("list_evidence", {}));
    })()`);
    console.info("[list_evidence Result]:", evidenceRes);

    const hypoRes = await cdp1.evaluate(`(async () => {
      const mc = window.__agentModelContext || document.modelContext;
      const payload = {
        title: "Supply rail voltage sag under relay load",
        description: "Relay inrush current collapses shared 3.3V power rail below 2.80V brownout threshold, resetting MCU.",
        confidence: "MEDIUM",
        rationale: "Oscilloscope captured 2.72V drop matching brownout reset timing.",
        evidence_ids: ["E-001", "E-002", "E-003", "E-004", "E-005"]
      };
      return await (mc.executeTool ? mc.executeTool("propose_hypothesis", payload) : mc.callTool("propose_hypothesis", payload));
    })()`);
    await sleep(2000);
    await cdp1.captureScreenshot("10-hypothesis-diagnosis-scene.png");
    const hypoAudit = await cdp1.evaluate(`({
      activeScene: document.querySelector('[data-scene]')?.getAttribute('data-scene'),
      heading: document.querySelector('main h1, main h2')?.innerText,
      mainText: document.querySelector('main')?.innerText?.slice(0, 600)
    })`);
    observations.hypothesisScene = hypoAudit;
    console.info("[Hypothesis Diagnosis Audit]:", hypoAudit);

    // Request Human Intervention
    console.info("Invoking request_human_intervention...");
    const humanRes = await cdp1.evaluate(`(async () => {
      const mc = window.__agentModelContext || document.modelContext;
      const payload = {
        target: "JUMPER_JP1",
        instruction: "Move relay VCC jumper from shared 3.3V MCU supply to independent 5V auxiliary rail.",
        rationale: "Isolates inductive load from MCU power rail to prevent brownout collapse.",
        evidence_ids: ["E-001", "E-002"]
      };
      return await (mc.executeTool ? mc.executeTool("request_human_intervention", payload) : mc.callTool("request_human_intervention", payload));
    })()`);
    console.info("[request_human_intervention Result]:", humanRes);
    await sleep(1500);

    // Click "Verify with repair →" or enter repair mode
    await cdp1.evaluate(`(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Verify with repair') || b.innerText.includes('repair'));
      if (btn) btn.click();
    })()`);
    await sleep(1500);
    await cdp1.captureScreenshot("11-human-repair-scene.png");
    const repairAudit = await cdp1.evaluate(`({
      activeScene: document.querySelector('[data-scene]')?.getAttribute('data-scene'),
      heading: document.querySelector('main h1, main h2')?.innerText,
      buttons: Array.from(document.querySelectorAll('button')).map(b => b.innerText.trim()).filter(Boolean),
      mainText: document.querySelector('main')?.innerText?.slice(0, 600)
    })`);
    observations.repairScene = repairAudit;
    console.info("[Human Repair Audit]:", repairAudit);

    // Perform the jumper switch in UI
    console.info("Performing jumper switch in UI...");
    const jumperMoved = await cdp1.evaluate<boolean>(`(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Switch to Independent') || b.innerText.includes('Move jumper') || b.innerText.includes('Aux') || b.innerText.includes('5V') || b.innerText.includes('Simulate moving JP1'));
      if (btn) { btn.click(); return true; }
      const anyJumper = document.querySelector('[data-testid="jumper-switch"], .jumper-control');
      if (anyJumper) { anyJumper.click(); return true; }
      return false;
    })()`);
    console.info("[Jumper moved in UI]:", jumperMoved);
    await sleep(1500);
    await cdp1.captureScreenshot("12-after-jumper-moved.png");

    // Click "Tell agent I've changed it"
    console.info("Notifying agent of hardware change...");
    const notifiedAgent = await cdp1.evaluate<boolean>(`(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes("Tell agent") || b.innerText.includes("Continue") || b.innerText.includes("Verification"));
      if (btn) { btn.click(); return true; }
      return false;
    })()`);
    console.info("[Notified agent]:", notifiedAgent);
    await sleep(1500);

    // Verify / Retest tool call
    console.info("Invoking verification run_relay_stress_test...");
    const retestPromise = cdp1.evaluate(`(async () => {
      const mc = window.__agentModelContext || document.modelContext;
      return await (mc.executeTool ? mc.executeTool("run_relay_stress_test", { duration_ms: 300, target: "cooling_fan_relay" }) : mc.callTool("run_relay_stress_test", { duration_ms: 300, target: "cooling_fan_relay" }));
    })()`);
    await sleep(1200);
    await cdp1.captureScreenshot("13-verification-approval.png");

    // Approve verification test
    await cdp1.evaluate(`(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.toLowerCase().includes('approve'));
      if (btn) btn.click();
    })()`);
    const retestResult = await retestPromise;
    console.info("[Verification Retest Result]:", retestResult);
    // Conclude hypothesis & record conclusion
    console.info("Invoking confirm_hypothesis & record_conclusion...");
    await cdp1.evaluate(`(async () => {
      const mc = window.__agentModelContext || document.modelContext;
      try {
        await (mc.executeTool ? mc.executeTool("confirm_hypothesis", {
          hypothesis_id: "H-001",
          rationale: "Post-repair load test verified: supply rail remained at 3.18V and no brownout occurred.",
          verified_experiment_id: "exp_verification",
          evidence_ids: ["E-001", "E-002"]
        }) : null);

        await (mc.executeTool ? mc.executeTool("record_conclusion", {
          hypothesis_id: "H-001",
          root_cause: "Relay powered from shared 3.3V MCU rail causing brownout reset on energization.",
          summary: "Moved relay coil to independent 5V auxiliary supply. Verified with relay load stress test."
        }) : null);
      } catch (e) {
        console.warn("conclude failed:", e);
      }
    })()`);
    const finalAudit = await cdp1.evaluate(`({
      activeScene: document.querySelector('[data-scene]')?.getAttribute('data-scene'),
      heading: document.querySelector('main h1, main h2')?.innerText,
      mainText: document.querySelector('main')?.innerText?.slice(0, 600)
    })`);
    observations.finalScene = finalAudit;
    console.info("[Final Assessment Audit]:", finalAudit);

    // 5. Open WebMCP Instrument Drawer & Developer Inspector
    console.info("\n--- TESTING WEBMCP DRAWER & DEVELOPER INSPECTOR ---");
    const openDrawer = await cdp1.evaluate<boolean>(`(() => {
      const trigger = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('WebMCP') || b.innerText.includes('tools active') || b.innerText.includes('Instruments'));
      if (trigger) { trigger.click(); return true; }
      return false;
    })()`);
    console.info("[Opened WebMCP Drawer]:", openDrawer);
    await sleep(1000);
    await cdp1.captureScreenshot("16-webmcp-drawer.png");
    const drawerAudit = await cdp1.evaluate(`({
      drawerTitle: document.querySelector('[role="dialog"] h2, [role="dialog"] h3, aside h2')?.innerText,
      toolCategories: Array.from(document.querySelectorAll('h3, h4')).map(h => h.innerText.trim()).filter(Boolean),
      toolsListed: Array.from(document.querySelectorAll('code, .tool-name')).map(c => c.innerText.trim()).filter(Boolean).slice(0, 20)
    })`);
    observations.webmcpDrawer = drawerAudit;
    console.info("[WebMCP Drawer Audit]:", drawerAudit);

    // Open Developer Inspector via Keyboard shortcut Cmd+Shift+D / Ctrl+Shift+D
    console.info("Toggling Developer Inspector...");
    await cdp1.evaluate(`(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'D', code: 'KeyD', shiftKey: true, metaKey: true, bubbles: true }));
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'D', code: 'KeyD', shiftKey: true, ctrlKey: true, bubbles: true }));
    })()`);
    await sleep(1000);
    await cdp1.captureScreenshot("17-developer-inspector.png");

  } finally {
    console.info("\nConsole Errors logged in Session 1:", cdp1.consoleErrors);
    observations.session1Errors = cdp1.consoleErrors;
    await session1.cleanup();
  }

  // Session 2: Chrome with WebMCP Experimental flag enabled
  console.info("\n--- TEST SESSION 2: Chrome with WebMCP Experimental Flag Enabled ---");
  const session2 = await launchChrome(true, 1440, 900);
  const cdp2 = session2.client;
  try {
    await cdp2.send("Page.navigate", { url: PROD_URL });
    await sleep(2500);
    const nativeCheck = await cdp2.evaluate(`({
      documentModelContextPresent: Boolean(document.modelContext),
      windowModelContextPresent: Boolean(window.modelContext),
      webmcpMode: window.__webmcpMode,
      buildSha: window.__OHMNI_BUILD_SHA__
    })`);
    observations.session2WebMCPFlag = nativeCheck;
    console.info("[WebMCP Flag Session]:", nativeCheck);
    await cdp2.captureScreenshot("18-native-webmcp-landing.png");
  } finally {
    observations.session2Errors = cdp2.consoleErrors;
    await session2.cleanup();
  }

  // Write observations to temp audit file
  writeFileSync(join(AUDIT_DIR, "audit-observations.json"), JSON.stringify(observations, null, 2));
  console.info("\n[Audit Complete] Output saved to artifacts/audit/audit-observations.json");
}

runAudit().catch((err) => {
  console.error("Audit failed:", err);
  process.exit(1);
});
