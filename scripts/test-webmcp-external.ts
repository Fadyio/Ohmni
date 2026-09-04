import { spawn, type ChildProcess } from "node:child_process";
import { createServer, type Server } from "node:http";
import { existsSync, mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, normalize } from "node:path";

interface ChromeTarget {
  readonly type: string;
  readonly url: string;
  readonly webSocketDebuggerUrl: string;
}

interface RuntimeEvaluateResult<T> {
  readonly result: { readonly value?: T; readonly description?: string };
  readonly exceptionDetails?: { readonly text?: string; readonly exception?: { readonly description?: string } };
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`[Assertion failed] ${message}`);
}

function delay(ms: number): Promise<void> {
  const { promise, resolve } = Promise.withResolvers<void>();
  setTimeout(resolve, ms);
  return promise;
}

function findChromePath(): string | null {
  const configured = process.env.CHROME_BIN || process.env.GOOGLE_CHROME_PATH;
  const candidates = [
    configured,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium-browser",
    "/usr/bin/chromium",
  ];
  return candidates.find((candidate): candidate is string => Boolean(candidate && existsSync(candidate))) ?? null;
}

async function runCommand(command: string, args: string[]): Promise<void> {
  const child = spawn(command, args, { stdio: "inherit" });
  const { promise, resolve, reject } = Promise.withResolvers<void>();
  child.once("error", reject);
  child.once("close", (code) => {
    if (code === 0) resolve();
    else reject(new Error(`${command} ${args.join(" ")} exited with code ${code}`));
  });
  await promise;
}

async function startStaticServer(
  distDir: string,
  port: number,
): Promise<{ server: Server; url: string; getAgentRequestCount: () => number }> {
  let agentRequestCount = 0;
  const server = createServer(async (request, response) => {
    const requestUrl = new URL(request.url ?? "/", `http://127.0.0.1:${port}`);
    if (requestUrl.pathname.startsWith("/api/bench-agent")) {
      agentRequestCount += 1;
      response.writeHead(503, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ error: "The external-agent acceptance flow forbids provider calls" }));
      return;
    }

    const relativeAsset = requestUrl.pathname === "/" ? "index.html" : requestUrl.pathname.slice(1);
    const assetPath = normalize(join(distDir, relativeAsset));
    if (!assetPath.startsWith(normalize(distDir))) {
      response.writeHead(403);
      response.end("Forbidden");
      return;
    }

    try {
      const data = await readFile(assetPath);
      const extension = relativeAsset.split(".").pop() ?? "";
      const mimeTypes: Record<string, string> = {
        css: "text/css",
        html: "text/html; charset=utf-8",
        js: "application/javascript",
        json: "application/json",
        png: "image/png",
        svg: "image/svg+xml",
      };
      response.writeHead(200, {
        "Cache-Control": "no-store",
        "Content-Type": mimeTypes[extension] ?? "application/octet-stream",
      });
      response.end(data);
    } catch {
      const index = await readFile(join(distDir, "index.html"));
      response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      response.end(index);
    }
  });

  const serverReady = Promise.withResolvers<void>();
  server.once("error", serverReady.reject);
  server.listen(port, "127.0.0.1", serverReady.resolve);
  await serverReady.promise;
  return {
    server,
    url: `http://127.0.0.1:${port}/?scenario=brownout`,
    getAgentRequestCount: () => agentRequestCount,
  };
}

class CDPClient {
  private nextId = 1;
  private readonly pending = new Map<number, {
    resolve: (value: unknown) => void;
    reject: (error: Error) => void;
  }>();
  public readonly consoleErrors: string[] = [];

  private constructor(private readonly socket: WebSocket) {
    socket.onmessage = (event) => {
      const message = JSON.parse(String(event.data)) as {
        id?: number;
        result?: unknown;
        error?: { message: string };
        method?: string;
        params?: {
          type?: string;
          args?: Array<{ value?: string; description?: string }>;
          exceptionDetails?: { text?: string; exception?: { description?: string } };
        };
      };
      if (typeof message.id === "number") {
        const pending = this.pending.get(message.id);
        if (!pending) return;
        this.pending.delete(message.id);
        if (message.error) pending.reject(new Error(message.error.message));
        else pending.resolve(message.result);
        return;
      }
      if (message.method === "Runtime.consoleAPICalled" && message.params) {
        const { type, args } = message.params;
        if (type === "error" && args) {
          const msg = args.map((a) => a.value || a.description || JSON.stringify(a)).join(" ");
          this.consoleErrors.push(msg);
        }
      } else if (message.method === "Runtime.exceptionThrown" && message.params) {
        const desc = message.params.exceptionDetails?.exception?.description || message.params.exceptionDetails?.text;
        this.consoleErrors.push(`Uncaught Exception: ${desc}`);
      }
    };
  }

  public static async connect(url: string): Promise<CDPClient> {
    const socket = new WebSocket(url);
    const connected = Promise.withResolvers<void>();
    socket.onopen = () => connected.resolve();
    socket.onerror = () => connected.reject(new Error("Chrome DevTools WebSocket connection failed"));
    await connected.promise;
    return new CDPClient(socket);
  }

  public async send<T>(method: string, params: Record<string, unknown> = {}): Promise<T> {
    const id = this.nextId++;
    const response = Promise.withResolvers<unknown>();
    this.pending.set(id, { resolve: response.resolve, reject: response.reject });
    this.socket.send(JSON.stringify({ id, method, params }));
    return response.promise as Promise<T>;
  }

  public async evaluate<T>(expression: string): Promise<T> {
    const evaluation = await this.send<RuntimeEvaluateResult<T>>("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (evaluation.exceptionDetails) {
      throw new Error(
        evaluation.exceptionDetails.exception?.description ??
          evaluation.exceptionDetails.text ??
          "Browser evaluation failed",
      );
    }
    return evaluation.result.value as T;
  }

  public async captureScreenshot(outputPath: string): Promise<void> {
    const raw = await this.send<{ data: string }>("Page.captureScreenshot", { format: "png" });
    const buffer = Buffer.from(raw.data, "base64");
    writeFileSync(outputPath, buffer);
  }

  public close(): void {
    this.socket.close();
  }
}

async function waitFor<T>(
  client: CDPClient,
  expression: string,
  description: string,
  timeoutMs = 10_000,
): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  let lastValue: T | undefined;
  while (Date.now() < deadline) {
    lastValue = await client.evaluate<T>(expression);
    if (lastValue) return lastValue;
    await delay(100);
  }
  throw new Error(`Timed out waiting for ${description}; last value: ${JSON.stringify(lastValue)}`);
}

async function click(client: CDPClient, selector: string): Promise<void> {
  const clicked = await client.evaluate<boolean>(`(() => {
    const element = document.querySelector(${JSON.stringify(selector)});
    if (!(element instanceof HTMLElement)) return false;
    element.click();
    return true;
  })()`);
  assert(clicked, `Expected clickable element ${selector}`);
}

async function invokeTool<T>(
  client: CDPClient,
  name: string,
  input: Record<string, unknown> = {},
): Promise<T> {
  return client.evaluate<T>(`(async () => {
    const context = document.modelContext;
    if (!context || typeof context.executeTool !== "function") {
      throw new Error("document.modelContext.executeTool is unavailable");
    }
    const output = await context.executeTool(
      ${JSON.stringify(name)},
      ${JSON.stringify(input)},
      { origin: "external" },
    );
    return typeof output === "string" ? JSON.parse(output) : output;
  })()`);
}

async function beginPendingStress(client: CDPClient, slot: "first" | "retest"): Promise<void> {
  await client.evaluate(`(() => {
    window.__externalAgentResults ??= {};
    window.__externalAgentResults[${JSON.stringify(slot)}] = undefined;
    window.__externalAgentResults[${JSON.stringify(`${slot}Settled`)}] = false;
    window.__externalAgentResults[${JSON.stringify(`${slot}Promise`)}] = (async () => {
      const output = await document.modelContext.executeTool(
        "run_relay_stress_test",
        { cycles: 1, duration_ms: 10 },
        { origin: "external" },
      );
      const parsed = typeof output === "string" ? JSON.parse(output) : output;
      window.__externalAgentResults[${JSON.stringify(slot)}] = parsed;
      return parsed;
    })().finally(() => {
      window.__externalAgentResults[${JSON.stringify(`${slot}Settled`)}] = true;
    });
  })()`);
}

async function readPendingStress<T>(client: CDPClient, slot: "first" | "retest"): Promise<T> {
  await waitFor<boolean>(
    client,
    `window.__externalAgentResults?.[${JSON.stringify(`${slot}Settled`)}] === true`,
    `${slot} stress result`,
    15_000,
  );
  return client.evaluate<T>(`window.__externalAgentResults[${JSON.stringify(slot)}]`);
}

async function runExternalAgentBrowserFlow(): Promise<void> {
  const chromePath = findChromePath();
  if (!chromePath) throw new Error("Google Chrome or Chromium was not found");

  console.info("Building the production browser bundle...");
  await runCommand("bun", ["run", "build"]);

  const screenshotsDir = join(process.cwd(), "artifacts", "screenshots");
  mkdirSync(screenshotsDir, { recursive: true });

  const serverPort = Number(process.env.WEBMCP_EXTERNAL_PORT ?? 5181);
  const debugPort = Number(process.env.WEBMCP_EXTERNAL_CDP_PORT ?? 9238);
  const { server, url, getAgentRequestCount } = await startStaticServer(join(process.cwd(), "dist"), serverPort);
  const profile = mkdtempSync(join(tmpdir(), "ohmni-webmcp-external-"));
  const chrome: ChildProcess = spawn(
    chromePath,
    [
      `--remote-debugging-port=${debugPort}`,
      `--user-data-dir=${profile}`,
      "--headless=new",
      "--no-default-browser-check",
      "--no-first-run",
      "--window-size=1440,900",
      url,
    ],
    { stdio: "pipe" },
  );
  let client: CDPClient | undefined;

  try {
    for (let attempt = 0; attempt < 50; attempt += 1) {
      try {
        const response = await fetch(`http://127.0.0.1:${debugPort}/json/version`);
        if (response.ok) break;
      } catch {}
      if (attempt === 49) throw new Error("Chrome DevTools endpoint did not become ready");
      await delay(200);
    }

    let target: ChromeTarget | undefined;
    for (let attempt = 0; attempt < 30 && !target; attempt += 1) {
      const response = await fetch(`http://127.0.0.1:${debugPort}/json/list`);
      const targets = await response.json() as ChromeTarget[];
      target = targets.find((candidate) => candidate.type === "page" && candidate.url.includes(`127.0.0.1:${serverPort}`));
      if (!target) await delay(100);
    }
    assert(target, "Application tab was not exposed through Chrome DevTools");

    client = await CDPClient.connect(target.webSocketDebuggerUrl);
    await client.send("Runtime.enable");
    await client.send("Page.enable");

    await waitFor<boolean>(
      client,
      `Boolean(document.querySelector("#start-mystery-btn"))`,
      "agent-ready landing action",
    );

    // Screenshot 00: Landing
    await client.captureScreenshot(join(screenshotsDir, "00-landing.png"));

    const landingOverflow = await client.evaluate<number>(
      `document.documentElement.scrollWidth - window.innerWidth`
    );
    assert(landingOverflow <= 0, `Landing page must have zero horizontal overflow, found: ${landingOverflow}px`);

    await click(client, "#start-mystery-btn");
    await waitFor<boolean>(
      client,
      `Boolean(document.querySelector("[data-testid='ready-scene']")) &&
       Boolean(document.querySelector("[data-testid='agent-ready-prompt']")) &&
       Boolean(document.modelContext && typeof document.modelContext.getTools === "function") &&
       Boolean(window.__virtualDevice?.isConnected()) &&
       window.__benchAgentState?.agentMode === "external"`,
      "connected agent-ready virtual workbench",
      15_000,
    );

    const workbenchOverflow = await client.evaluate<number>(
      `document.documentElement.scrollWidth - window.innerWidth`
    );
    assert(workbenchOverflow <= 0, `Workbench must have zero horizontal overflow, found: ${workbenchOverflow}px`);
    const readyUi = await client.evaluate<{
      heading: string;
      prompt: string;
      copyLabel: string;
      hasBuiltInDemo: boolean;
      agentMode?: string;
      hasGroqBadge: boolean;
    }>(`({
      heading: document.querySelector("[data-testid='agent-ready-prompt']")?.textContent ?? "",
      prompt: document.querySelector("[data-testid='suggested-agent-prompt']")?.textContent ?? "",
      copyLabel: document.querySelector("[data-testid='copy-agent-prompt']")?.textContent ?? "",
      hasBuiltInDemo: Boolean(document.querySelector("[data-testid='try-built-in-demo']")),
      agentMode: window.__benchAgentState?.agentMode,
      hasGroqBadge: Boolean(document.querySelector("[data-testid='groq-provider-badge']")),
    })`);
    assert(readyUi.heading.includes("READY FOR YOUR AGENT"), "Workbench should announce external-agent readiness");
    const canonicalPrompt =
      "There is a problem with this controller: it resets when the cooling fan turns on. Investigate the root cause using the available hardware instruments. Gather evidence before proposing a diagnosis. You may use read-only measurements autonomously, but ask for my approval before any actuation or physical change. If you identify a repair, ask me to perform it and then experimentally verify that the problem is fixed.";
    assert(
      readyUi.prompt.includes(canonicalPrompt),
      "Workbench should show the canonical suggested external-agent prompt",
    );
    assert(readyUi.copyLabel.includes("Copy prompt"), "Workbench should expose prompt copy action");
    assert(readyUi.hasBuiltInDemo, "Built-in demo should remain an explicit optional action");
    assert(readyUi.agentMode === "external", "Default workbench mode should belong to the external agent");
    assert(!readyUi.hasGroqBadge, "Default workbench must not present Groq as the active provider");

    // Screenshot 01: Ready scene
    await client.captureScreenshot(join(screenshotsDir, "01-ready.png"));

    const toolNames = await client.evaluate<string[]>(
      `(async () => (await document.modelContext.getTools()).map((tool) => tool.name))()`,
    );
    for (const required of [
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
      "request_human_intervention",
      "confirm_hypothesis",
    ]) {
      assert(toolNames.includes(required), `Expected registered tool ${required}`);
    }
    for (const forbidden of ["erase_flash", "arbitrary_serial", "arbitrary_gpio_write", "write_firmware"]) {
      assert(!toolNames.includes(forbidden), `Red capability ${forbidden} must not be exposed`);
    }

    const deviceInfo = await invokeTool<{ mcu: string }>(client, "read_device_info");
    assert(Boolean(deviceInfo), "Device info must be returned");

    const resetHistory = await invokeTool<{ count: number; resets: unknown[] }>(client, "read_reset_history");
    assert(resetHistory.count >= 1 && (resetHistory.resets[0] as { reason?: string })?.reason === "POWER_ON", "Initial reset history should show normal cold boot");

    // Screenshot 02: Reset history scene
    await client.captureScreenshot(join(screenshotsDir, "02-reset-history.png"));

    const voltage = await invokeTool<{ voltage: number; status: string }>(client, "measure_supply_voltage");
    assert(Math.abs(voltage.voltage - 3.31) < 0.02, "Initial supply voltage should be 3.31 V");

    await waitFor<boolean>(
      client,
      `(() => {
        const history = Array.from(document.querySelectorAll("[data-testid='bench-agent-activity-row']"))
          .map((node) => node.textContent ?? "").join(" ");
        const summaries = document.querySelectorAll("[data-testid='tool-result-summary']");
        return history.includes("read_reset_history") &&
          history.includes("measure_supply_voltage") &&
          summaries.length >= 2 &&
          document.body.innerText.includes("3.31");
      })()`,
      "read history and voltage update in the workbench UI",
    );

    await beginPendingStress(client, "first");
    await waitFor<boolean>(
      client,
      `Boolean(document.querySelector("[data-testid='bench-agent-approval']"))`,
      "Amber approval request",
    );
    const pendingSafety = await client.evaluate<{
      settled: boolean;
      relay: string;
      pendingTool?: string;
      approvalText: string;
    }>(`({
      settled: window.__externalAgentResults.firstSettled,
      relay: window.__virtualDevice.getRelayState(),
      pendingTool: window.__toolApprovalGate.getPendingApproval()?.toolName,
      approvalText: document.querySelector("[data-testid='bench-agent-approval']")?.textContent ?? "",
    })`);
    assert(!pendingSafety.settled, "Amber tool promise must remain pending before approval");
    assert(pendingSafety.relay === "open", "Relay must remain open before approval");
    assert(pendingSafety.pendingTool === "run_relay_stress_test", "Gate should identify the pending tool");
    assert(/authoriz|approval|energize/i.test(pendingSafety.approvalText), "Approval UI must explain the authorization");

    // Screenshot 03: Amber Approval scene
    await client.captureScreenshot(join(screenshotsDir, "03-approval.png"));

    await click(client, "[data-testid='bench-agent-approve']");
    // Screenshot 04: Load test running scene (with active relay actuation)
    await client.captureScreenshot(join(screenshotsDir, "04-load-test-running.png"));
    const failedStress = await readPendingStress<{
      experiment_id: string;
      unexpected_resets: number;
      supply_voltage: { minimum_v: number };
      evidence_ids: string[];
    }>(client, "first");
    assert(failedStress.unexpected_resets > 0, "Approved test should reproduce a reset");
    assert(failedStress.supply_voltage.minimum_v < 2.8, "Approved test should capture the voltage sag");
    assert(failedStress.evidence_ids.length > 0, "Approved test should create evidence");

    const relayAfterTest = await client.evaluate<string>("window.__virtualDevice.getRelayState()");
    assert(relayAfterTest === "open", "Relay must safely return to open state after test");

    await waitFor<boolean>(
      client,
      `document.body.innerText.includes("2.72") &&
       document.body.innerText.includes("FAULT REPRODUCED") &&
       window.__evidenceStore.count() > 0`,
      "sag and fault reproduced in the workbench UI",
      15_000,
    );

    // Screenshot 05: Fault Reproduced
    await client.captureScreenshot(join(screenshotsDir, "05-fault-reproduced.png"));

    const proposal = await invokeTool<{ hypothesis: { id: string } }>(client, "propose_hypothesis", {
      title: "Relay-induced MCU supply brownout",
      description: "Relay coil inrush on the shared 3.3 V rail collapses MCU voltage below the reset threshold.",
      confidence: "MEDIUM",
      rationale: "The controlled relay test reproduced the reset and measured the causal voltage sag.",
      evidence_ids: failedStress.evidence_ids,
    });
    await invokeTool(client, "update_hypothesis", {
      hypothesis_id: proposal.hypothesis.id,
      confidence: "HIGH",
      evidence_ids: failedStress.evidence_ids,
      reason: "The relay test captured a sub-threshold sag and matching brownout reset.",
    });
    await waitFor<boolean>(
      client,
      `Boolean(document.querySelector("[data-testid='hypothesis-card']")) &&
       (document.querySelector("[data-testid='hypothesis-card']")?.textContent?.includes("Relay-induced") ||
        document.querySelector("[data-testid='hypothesis-scene']")?.textContent?.includes("Relay-induced")) === true`,
      "grounded hypothesis UI",
    );

    // Screenshot 06: Working Diagnosis
    await client.captureScreenshot(join(screenshotsDir, "06-diagnosis.png"));

    await invokeTool(client, "request_human_intervention", {
      target: "relay_power_jumper",
      instruction: "Move the relay supply from the shared 3.3 V MCU rail to the independent 5 V supply.",
      rationale: "This isolates the relay load from the controller's sensitive supply rail.",
      evidence_ids: failedStress.evidence_ids,
    });
    await waitFor<boolean>(
      client,
      `Boolean(document.querySelector("[data-testid='simulate-jp1-btn']"))`,
      "human repair UI",
    );

    // Screenshot 07: Human Repair
    await client.captureScreenshot(join(screenshotsDir, "07-human-repair.png"));

    const evidenceBeforeRepair = await client.evaluate<number>("window.__evidenceStore.count()");
    await click(client, "[data-testid='simulate-jp1-btn']");
    assert(
      await client.evaluate("window.__virtualDevice.getInterventionPoint('relay_power_jumper') === '5v'"),
      "The jumper must change through the UI",
    );
    await waitFor<boolean>(
      client,
      `window.__evidenceStore.count() > ${evidenceBeforeRepair} &&
       window.__evidenceStore.getAll().some((record) => record.source === "human")`,
      "human repair observation evidence",
    );

    await beginPendingStress(client, "retest");
    await waitFor<boolean>(
      client,
      `Boolean(document.querySelector("[data-testid='repair-approve-btn'], [data-testid='bench-agent-approve']"))`,
      "verification approval",
    );
    const retestPending = await client.evaluate<{ settled: boolean; relay: string }>(`({
      settled: window.__externalAgentResults.retestSettled,
      relay: window.__virtualDevice.getRelayState(),
    })`);
    assert(!retestPending.settled, "Retest promise must remain pending before approval");
    assert(retestPending.relay === "open", "Relay must remain open before retest approval");

    const repairApprovalVisible = await client.evaluate<boolean>(
      `Boolean(document.querySelector("[data-testid='repair-approve-btn']"))`,
    );
    await click(client, repairApprovalVisible ? "[data-testid='repair-approve-btn']" : "[data-testid='bench-agent-approve']");

    const stableStress = await readPendingStress<{
      experiment_id: string;
      unexpected_resets: number;
      supply_voltage: { minimum_v: number };
      evidence_ids: string[];
    }>(client, "retest");
    assert(stableStress.unexpected_resets === 0, "Post-repair retest should have no reset");
    assert(stableStress.supply_voltage.minimum_v >= 3.18, "Post-repair MCU rail should remain stable");

    const finalRelayState = await client.evaluate<string>("window.__virtualDevice.getRelayState()");
    assert(finalRelayState === "open", "Relay must safely return to open state after verification retest");

    await waitFor<boolean>(
      client,
      `document.body.innerText.includes("3.18") &&
       (document.body.innerText.includes("Stable · No reset") || document.body.innerText.includes("Retest passed"))`,
      "verification test scene",
    );

    // Assert STATE A invariants before calling confirm_hypothesis
    const stateA = await client.evaluate<{
      hasRetestPassed: boolean;
      hasAwaitingConfirmation: boolean;
      hasPrematureVerified: boolean;
      hasBenchAgentCopy: boolean;
    }>(`(() => {
      const body = document.body.innerText;
      return {
        hasRetestPassed: body.includes("Retest passed"),
        hasAwaitingConfirmation: body.includes("Awaiting agent confirmation"),
        hasPrematureVerified: body.includes("REPAIR VERIFIED"),
        hasBenchAgentCopy: body.toLowerCase().includes("bench agent") || body.includes("Empirically Verified"),
      };
    })()`);

    assert(stateA.hasRetestPassed, "State A: UI must display 'Retest passed'");
    assert(stateA.hasAwaitingConfirmation, "State A: UI must display 'Awaiting agent confirmation'");
    assert(!stateA.hasPrematureVerified, "State A: UI MUST NOT display 'REPAIR VERIFIED' before confirm_hypothesis");
    assert(!stateA.hasBenchAgentCopy, "State A: UI MUST NOT display 'Bench Agent' or 'Empirically Verified'");

    // Screenshot 08: Verification Test
    await client.captureScreenshot(join(screenshotsDir, "08-verification-test.png"));

    await invokeTool(client, "confirm_hypothesis", {
      hypothesis_id: proposal.hypothesis.id,
      rationale: "The approved post-repair relay experiment completed with no resets and a stable MCU rail.",
      evidence_ids: stableStress.evidence_ids,
      verified_experiment_id: stableStress.experiment_id,
    });
    await invokeTool(client, "record_conclusion", {
      hypothesis_id: proposal.hypothesis.id,
      root_cause: "Relay coil powered from the shared MCU 3.3 V rail",
      summary: "Moving JP1 to isolated 5 V removed the supply sag; the approved retest completed without resets.",
      verification_evidence_ids: stableStress.evidence_ids,
    });

    await waitFor<boolean>(
      client,
      `Boolean(document.querySelector("[data-testid='ground-truth-reveal-scene'], [data-testid='completion-scene']"))`,
      "verified final UI",
      15_000,
    );

    // Screenshot 09: Repair Verified
    await client.captureScreenshot(join(screenshotsDir, "09-repair-verified.png"));

    const finalState = await client.evaluate<{
      hypothesisStatus?: string;
      verificationStatus?: string;
      intervention?: string;
      relay: string;
      latestResets?: number;
      everyInvocationExternal: boolean;
      isVerified: boolean;
      hasGroundTruthHeading: boolean;
      hasActualHardwareFault: boolean;
      hasContradictoryLabels: boolean;
    }>(`(() => {
      const hypothesis = window.__hypothesisStore.get(${JSON.stringify(proposal.hypothesis.id)});
      const experiments = window.__experimentStore.getExperiments();
      const latest = experiments[experiments.length - 1];
      const body = document.body.innerText;
      const contradictory =
        (body.includes("DIAGNOSIS MATCH ✓") && (body.includes("NOT_VERIFIED") || body.includes("UNVERIFIED"))) ||
        (body.includes("Repair verified") && body.includes("INVESTIGATION INCOMPLETE")) ||
        (body.includes("REPAIR VERIFIED") && body.includes("VERIFICATION PENDING")) ||
        body.toLowerCase().includes("bench agent") ||
        body.includes("ACTUAL HARDWARE FAULT");
      return {
        hypothesisStatus: hypothesis?.status,
        verificationStatus: hypothesis?.verificationStatus,
        intervention: window.__virtualDevice.getInterventionPoint("relay_power_jumper"),
        relay: window.__virtualDevice.getRelayState(),
        latestResets: latest?.summary?.unexpected_resets,
        everyInvocationExternal: window.__toolLedger.getEntries().every((entry) => entry.origin === "external"),
        isVerified: body.includes("REPAIR VERIFIED"),
        hasGroundTruthHeading: body.includes("SEALED VIRTUAL GROUND TRUTH"),
        hasActualHardwareFault: body.includes("ACTUAL HARDWARE FAULT"),
        hasContradictoryLabels: contradictory,
      };
    })()`);
    assert(finalState.hypothesisStatus === "CONFIRMED", "Final hypothesis should be confirmed");
    assert(finalState.verificationStatus === "VERIFIED", "Final hypothesis should be verified");
    assert(finalState.intervention === "5v", "Final jumper state should remain on isolated 5 V");
    assert(finalState.relay === "open", "Final relay state should be safely open");
    assert(finalState.latestResets === 0, "Final experiment should be stable");
    assert(finalState.everyInvocationExternal, "Every direct invocation should be attributed to the external agent");
    assert(finalState.isVerified, "Final UI must announce REPAIR VERIFIED");
    assert(finalState.hasGroundTruthHeading, "Final UI must display SEALED VIRTUAL GROUND TRUTH");
    assert(!finalState.hasActualHardwareFault, "Final UI must NOT display ACTUAL HARDWARE FAULT");
    assert(!finalState.hasContradictoryLabels, "Final screen must not contain contradictory status labels");
    assert(getAgentRequestCount() === 0, "The external-agent flow must never call Groq or another built-in provider");

    assert(
      client.consoleErrors.length === 0,
      `Detected ${client.consoleErrors.length} unexpected console error(s):\n${client.consoleErrors.join("\n")}`,
    );

    console.info("External WebMCP browser flow passed.");
  } finally {
    client?.close();
    chrome.kill();
    const serverClosed = Promise.withResolvers<void>();
    server.close(() => serverClosed.resolve());
    await serverClosed.promise;
    rmSync(profile, { recursive: true, force: true });
  }
}

runExternalAgentBrowserFlow().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});
