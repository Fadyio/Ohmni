import { describe, expect, it } from "bun:test";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import React from "react";
import { renderToString } from "react-dom/server";
import { VirtualDeviceAdapter } from "@/domain/device/virtual-adapter";
import { InMemoryModelContext } from "@/infrastructure/webmcp/in-memory-model-context";
import { DeviceToolRegistrar } from "@/infrastructure/webmcp/device-tool-registrar";
import { CapabilityRegistry } from "@/infrastructure/webmcp/capability-registry";
import { InMemoryEvidenceStore } from "@/domain/evidence/store";
import { registerEvidenceTools } from "@/infrastructure/webmcp/evidence-tools";
import { InMemoryHypothesisStore } from "@/domain/hypothesis/store";
import { registerHypothesisTools } from "@/infrastructure/webmcp/hypothesis-tools";
import { DeterministicBenchAgentProvider } from "@/infrastructure/bench-agent/deterministic-provider";
import { SerialDeviceAdapter } from "@/infrastructure/serial/serial-device-adapter";
import { LoopbackSerialTransport } from "@/infrastructure/serial/loopback-serial-transport";
import { ReferenceSerialDeviceSimulator } from "@/infrastructure/serial/reference-simulator";
import { App } from "@/presentation/App";

describe("Architecture Protection & Regression Suite", () => {
  it("Test A: Repository and client source contains no Groq runtime implementation", () => {
    // 1. Deleted files and folders must not exist
    expect(existsSync(join(process.cwd(), "api"))).toBe(false);
    expect(existsSync(join(process.cwd(), "server"))).toBe(false);
    expect(
      existsSync(
        join(process.cwd(), "src", "infrastructure", "bench-agent", "http-provider.ts")
      )
    ).toBe(false);
    expect(
      existsSync(
        join(process.cwd(), "src", "presentation", "components", "agent")
      )
    ).toBe(false);

    // 2. Scan all TypeScript source files under src/ for Groq runtime code
    const srcDir = join(process.cwd(), "src");
    const scanDir = (dir: string): string[] => {
      const found: string[] = [];
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const fullPath = join(dir, entry.name);
        if (entry.isDirectory()) {
          found.push(...scanDir(fullPath));
        } else if (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) {
          const content = readFileSync(fullPath, "utf8");
          // Check for Groq provider classes, Groq API endpoints, or gsk tokens
          if (content.includes("GroqBenchAgentProvider")) {
            found.push(`GroqBenchAgentProvider found in ${entry.name}`);
          }
          if (content.includes("api.groq.com")) {
            found.push(`api.groq.com found in ${entry.name}`);
          }
          if (/gsk_[0-9A-Za-z_-]{15,}/.test(content)) {
            found.push(`gsk_* token found in ${entry.name}`);
          }
        }
      }
      return found;
    };

    const violations = scanDir(srcDir);
    expect(violations).toEqual([]);
  });

  it("Test B: No GROQ_API_KEY runtime dependency exists", () => {
    const srcDir = join(process.cwd(), "src");
    const violations: string[] = [];

    const scanDir = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const fullPath = join(dir, entry.name);
        if (entry.isDirectory()) {
          scanDir(fullPath);
        } else if (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) {
          const content = readFileSync(fullPath, "utf8");
          if (content.includes("GROQ_API_KEY")) {
            violations.push(`GROQ_API_KEY reference in ${entry.name}`);
          }
        }
      }
    };

    scanDir(srcDir);
    const viteConfig = readFileSync(join(process.cwd(), "vite.config.ts"), "utf8");
    if (viteConfig.includes("GROQ_API_KEY")) {
      violations.push("GROQ_API_KEY in vite.config.ts");
    }

    expect(violations).toEqual([]);
  });

  it("Test C: No GEMINI_API_KEY runtime dependency exists", () => {
    const srcDir = join(process.cwd(), "src");
    const violations: string[] = [];

    const scanDir = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const fullPath = join(dir, entry.name);
        if (entry.isDirectory()) {
          scanDir(fullPath);
        } else if (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) {
          const content = readFileSync(fullPath, "utf8");
          if (content.includes("GEMINI_API_KEY")) {
            violations.push(`GEMINI_API_KEY reference in ${entry.name}`);
          }
        }
      }
    };

    scanDir(srcDir);
    const viteConfig = readFileSync(join(process.cwd(), "vite.config.ts"), "utf8");
    if (viteConfig.includes("GEMINI_API_KEY")) {
      violations.push("GEMINI_API_KEY in vite.config.ts");
    }

    expect(violations).toEqual([]);
  });

  it("Test D: Core app initializes without an AI-provider environment variable", () => {
    // Delete any ambient environment variables
    const originalGroq = process.env.GROQ_API_KEY;
    const originalGemini = process.env.GEMINI_API_KEY;
    delete process.env.GROQ_API_KEY;
    delete process.env.GEMINI_API_KEY;

    try {
      const adapter = new VirtualDeviceAdapter();
      const html = renderToString(<App deviceAdapter={adapter} />);
      expect(html).toContain("OHMNI");
      expect(html).toContain("Virtual reference device");
      expect(html.toLowerCase()).not.toContain("groq");
      expect(html.toLowerCase()).not.toContain("gemini");
    } finally {
      if (originalGroq !== undefined) process.env.GROQ_API_KEY = originalGroq;
      if (originalGemini !== undefined) process.env.GEMINI_API_KEY = originalGemini;
    }
  });

  it("Test E: External WebMCP tools still register on document.modelContext", async () => {
    const modelContext = new InMemoryModelContext();
    const adapter = new VirtualDeviceAdapter();
    await adapter.connect();

    const registrar = new DeviceToolRegistrar(modelContext, new CapabilityRegistry());
    await registrar.registerDevice(adapter);

    const evidenceStore = new InMemoryEvidenceStore();
    await registerEvidenceTools(modelContext, evidenceStore);

    const hypothesisStore = new InMemoryHypothesisStore();
    await registerHypothesisTools(modelContext, hypothesisStore);

    const tools = await modelContext.getTools();
    expect(tools.length).toBe(19);

    const toolNames = tools.map((t) => t.name);
    expect(toolNames).toContain("read_reset_history");
    expect(toolNames).toContain("measure_supply_voltage");
    expect(toolNames).toContain("run_relay_stress_test");
    expect(toolNames).toContain("list_evidence");
    expect(toolNames).toContain("propose_hypothesis");
    expect(toolNames).toContain("request_human_intervention");
    expect(toolNames).toContain("confirm_hypothesis");

    // Execute read-only tool
    const resetHistory = await modelContext.executeTool("read_reset_history", {});
    expect(resetHistory).toBeDefined();

    const voltage = await modelContext.executeTool("measure_supply_voltage", {});
    expect(voltage).toBeDefined();
  });

  it("Test F: Deterministic guided demo still works without network access", async () => {
    const demoProvider = new DeterministicBenchAgentProvider();

    // Turn 1: Initial symptom
    const turn1 = await demoProvider.turn({
      input: "The controller restarts when the fan turns on.",
      tools: [],
    });
    expect(turn1.functionCalls.length).toBe(1);
    expect(turn1.functionCalls[0].name).toBe("read_reset_history");

    // Turn 2: Provide reset history
    const turn2 = await demoProvider.turn({
      input: [
        {
          type: "function_result",
          name: "read_reset_history",
          call_id: turn1.functionCalls[0].id,
          result: [
            {
              type: "text",
              text: JSON.stringify({
                resets: [{ reason: "BROWNOUT", message: "Voltage sagged" }],
                count: 1,
              }),
            },
          ],
        },
      ],
      tools: [],
    });
    expect(turn2.functionCalls.length).toBe(1);
    expect(turn2.functionCalls[0].name).toBe("measure_supply_voltage");

    // Turn 3: Baseline voltage
    const turn3 = await demoProvider.turn({
      input: [
        {
          type: "function_result",
          name: "measure_supply_voltage",
          call_id: turn2.functionCalls[0].id,
          result: [{ type: "text", text: JSON.stringify({ voltage: 3.31, unit: "V" }) }],
        },
      ],
      tools: [],
    });
    expect(turn3.functionCalls.length).toBe(1);
    expect(turn3.functionCalls[0].name).toBe("run_relay_stress_test");

    // Canary check works offline
    const canary = await demoProvider.canary();
    expect(canary.ok).toBe(true);
    expect(canary.model).toBe("deterministic-demo");
  });

  it("Test G: Web Serial adapter initializes independently of any AI provider code", async () => {
    const [host, peer] = LoopbackSerialTransport.createPair();
    const sim = new ReferenceSerialDeviceSimulator(peer);
    const adapter = new SerialDeviceAdapter(host);
    expect(adapter).toBeDefined();
    expect(adapter.isConnected()).toBe(false);

    await adapter.connect();
    expect(adapter.isConnected()).toBe(true);

    const desc = adapter.getDescriptor();
    expect(desc).toBeDefined();
    expect(desc.id).toBe("esp32s3-ref-001");
    expect(desc.capabilities.length).toBeGreaterThan(0);

    sim.destroy();
    await adapter.disconnect();
    expect(adapter.isConnected()).toBe(false);
  });
});
