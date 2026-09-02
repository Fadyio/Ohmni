/**
 * WebMCP Tool Surface Test Suite & Protocol Golden-Path Regression Tests.
 *
 * Tests:
 * - Dynamic tool lifecycle (connect -> register -> getTools -> disconnect -> unregister)
 * - Protocol golden-path execution through modelContext.executeTool()
 * - Deterministic brownout reproduction via WebMCP execution
 * - Tool metadata, JSON schemas, and readOnlyHint annotations
 * - Registration and execution AbortSignal cancellation
 * - Unknown capability security filtering (capability firewall)
 * - toolchange event emission on registration and teardown
 */

import { describe, it, expect, beforeEach } from "bun:test";
import { VirtualDeviceAdapter } from "@/domain/device/virtual-adapter";
import type { DeviceAdapter } from "@/domain/device/adapter";
import type { DeviceDescriptor } from "@/domain/device/descriptor";
import { InMemoryModelContext } from "@/infrastructure/webmcp/in-memory-model-context";
import { CapabilityRegistry } from "@/infrastructure/webmcp/capability-registry";
import { DeviceToolRegistrar } from "@/infrastructure/webmcp/device-tool-registrar";
import type { RegisteredTool } from "@/infrastructure/webmcp/types";

describe("WebMCP Tool Surface — Protocol & Security Regression Tests", () => {
  let modelContext: InMemoryModelContext;
  let registry: CapabilityRegistry;
  let registrar: DeviceToolRegistrar;
  let adapter: VirtualDeviceAdapter;

  beforeEach(() => {
    modelContext = new InMemoryModelContext();
    registry = new CapabilityRegistry();
    registrar = new DeviceToolRegistrar(modelContext, registry);
    adapter = new VirtualDeviceAdapter();
  });

  describe("Dynamic Tool Lifecycle & Protocol Golden Path (Task K)", () => {
    it("golden path: virtual device dynamically exposes executable WebMCP tools and removes them on disconnect", async () => {
      // 1. Before connection: no tools exist
      const initialTools = await modelContext.getTools();
      expect(initialTools.length).toBe(0);

      // 2. Connect device & register tools
      await adapter.connect();
      const session = await registrar.registerDevice(adapter);
      expect(session.registeredToolNames).toEqual([
        "read_device_info",
        "read_reset_history",
        "read_system_health",
        "measure_supply_voltage",
        "run_relay_stress_test",
      ]);

      // 3. Discover registered tools via WebMCP getTools()
      const registeredTools = await modelContext.getTools();
      expect(registeredTools.length).toBe(5);

      const toolNames = registeredTools.map((t) => t.name);
      expect(toolNames).toContain("read_device_info");
      expect(toolNames).toContain("read_reset_history");
      expect(toolNames).toContain("read_system_health");
      expect(toolNames).toContain("measure_supply_voltage");
      expect(toolNames).toContain("run_relay_stress_test");

      // 4. Locate and execute read_reset_history via WebMCP executeTool() with JSON string (Chrome standard)
      const resetHistoryTool = registeredTools.find((t) => t.name === "read_reset_history");
      expect(resetHistoryTool).toBeDefined();

      const resetHistoryRaw = await modelContext.executeTool(
        resetHistoryTool as RegisteredTool,
        "{}"
      );
      const resetHistory = JSON.parse(resetHistoryRaw) as {
        resets: Array<{ reason: string }>;
        count: number;
      };

      expect(resetHistory.count).toBeGreaterThanOrEqual(1);
      expect(resetHistory.resets[0].reason).toBe("POWER_ON");

      // Also verify object input form works for backwards/dual-mode compatibility
      const resetHistoryRawObj = await modelContext.executeTool(
        resetHistoryTool as RegisteredTool,
        {}
      );
      expect(JSON.parse(resetHistoryRawObj).count).toBeGreaterThanOrEqual(1);

      // 5. Locate and execute run_relay_stress_test through WebMCP with JSON string
      const stressTestTool = registeredTools.find((t) => t.name === "run_relay_stress_test");
      expect(stressTestTool).toBeDefined();

      const stressResultRaw = await modelContext.executeTool(
        stressTestTool as RegisteredTool,
        JSON.stringify({ cycles: 3, duration_ms: 50 })
      );
      const stressResult = JSON.parse(stressResultRaw) as {
        success: boolean;
        faultReproduced: boolean;
        resetOccurred: boolean;
        resetReason: string;
        minVoltage: number;
      };

      // Proves brownout fault reproduced through WebMCP execution path
      expect(stressResult.success).toBe(false);
      expect(stressResult.faultReproduced).toBe(true);
      expect(stressResult.resetOccurred).toBe(true);
      expect(stressResult.resetReason).toBe("BROWNOUT");
      expect(stressResult.minVoltage).toBeLessThan(2.80);
      await adapter.disconnect();
      registrar.unregisterDevice(adapter);

      // 7. Assert all device tools are removed from ModelContext
      const finalTools = await modelContext.getTools();
      expect(finalTools.length).toBe(0);
    });
  });

  describe("Tool Metadata & Annotations (Task L)", () => {
    it("verifies accurate tool metadata, explicit JSON schemas, and safety hints", async () => {
      await adapter.connect();
      await registrar.registerDevice(adapter);

      const tools = await modelContext.getTools();

      // Check read_reset_history metadata
      const resetTool = tools.find((t) => t.name === "read_reset_history");
      expect(resetTool).toBeDefined();
      expect(resetTool?.description).toContain("reset causes");
      expect(resetTool?.annotations?.readOnlyHint).toBe(true);
      expect(resetTool?.inputSchema).toMatchObject({
        type: "object",
        additionalProperties: false,
      });

      // Check read_device_info metadata
      const infoTool = tools.find((t) => t.name === "read_device_info");
      expect(infoTool?.annotations?.readOnlyHint).toBe(true);

      // Check measure_supply_voltage metadata
      const voltageTool = tools.find((t) => t.name === "measure_supply_voltage");
      expect(voltageTool?.annotations?.readOnlyHint).toBe(true);

      // Check read_system_health metadata
      const healthTool = tools.find((t) => t.name === "read_system_health");
      expect(healthTool?.annotations?.readOnlyHint).toBe(true);

      // Check run_relay_stress_test metadata (Amber / side-effect test)
      const stressTool = tools.find((t) => t.name === "run_relay_stress_test");
      expect(stressTool).toBeDefined();
      expect(stressTool?.annotations?.readOnlyHint).toBe(false);
      expect(stressTool?.inputSchema).toMatchObject({
        type: "object",
        properties: {
          cycles: { type: "integer" },
          duration_ms: { type: "integer" },
        },
        additionalProperties: false,
      });
    });
  });

  describe("Registration Abort Lifecycle (Task M)", () => {
    it("registration AbortSignal unregisters device tools immediately", async () => {
      await adapter.connect();
      const session = await registrar.registerDevice(adapter);

      const toolsBefore = await modelContext.getTools();
      expect(toolsBefore.length).toBe(5);

      // Aborting the session registration controller tears down the tools
      session.abortController.abort();

      const toolsAfter = await modelContext.getTools();
      expect(toolsAfter.length).toBe(0);
    });
  });

  describe("Execution Abort Propagation (Task N)", () => {
    it("propagates pre-aborted execution AbortSignal and restores hardware to safe state", async () => {
      await adapter.connect();
      await registrar.registerDevice(adapter);

      const tools = await modelContext.getTools();
      const stressTool = tools.find((t) => t.name === "run_relay_stress_test");
      expect(stressTool).toBeDefined();

      const executionController = new AbortController();
      executionController.abort();

      const promise = modelContext.executeTool(
        stressTool as RegisteredTool,
        JSON.stringify({ cycles: 10, duration_ms: 100 }),
        { signal: executionController.signal }
      );

      await expect(promise).rejects.toThrow(/aborted/i);
      expect(adapter.getRelayState()).toBe("open");
    });

    it("cancels mid-flight execution when AbortSignal triggers during async operation", async () => {
      adapter.setInterventionPoint("JP1", "5V_EXT"); // 5V rail prevents instant brownout Sag, allowing multi-cycle delay
      await adapter.connect();
      await registrar.registerDevice(adapter);

      const tools = await modelContext.getTools();
      const stressTool = tools.find((t) => t.name === "run_relay_stress_test");
      expect(stressTool).toBeDefined();

      const executionController = new AbortController();
      const promise = modelContext.executeTool(
        stressTool as RegisteredTool,
        JSON.stringify({ cycles: 5, duration_ms: 100 }),
        { signal: executionController.signal }
      );

      // Trigger abort while running
      setTimeout(() => executionController.abort(), 20);

      await expect(promise).rejects.toThrow(/aborted/i);
      expect(adapter.getRelayState()).toBe("open");
    });

    it("rejects invalid JSON string input with informative error", async () => {
      await adapter.connect();
      await registrar.registerDevice(adapter);

      const tools = await modelContext.getTools();
      const infoTool = tools.find((t) => t.name === "read_device_info");
      expect(infoTool).toBeDefined();

      const promise = modelContext.executeTool(
        infoTool as RegisteredTool,
        "{ invalid-json"
      );

      await expect(promise).rejects.toThrow(/Invalid JSON input string/i);
    });
  });

  describe("Capability Firewall & Security (Task O)", () => {
    it("refuses to register unknown, unvetted, or dangerous device capabilities", async () => {
      // Create a mock adapter reporting dangerous and unvetted capabilities
      const rogueAdapter: DeviceAdapter = {
        connect: async () => {},
        disconnect: async () => {},
        isConnected: () => true,
        getDescriptor: (): DeviceDescriptor => ({
          id: "rogue-device",
          name: "Rogue Controller",
          firmwareVersion: "0.0.1",
          protocolVersion: 1,
          capabilities: [
            {
              name: "read_device_info",
              description: "Read device info",
              safety: "green",
              readOnly: true,
            },
            {
              name: "arbitrary_serial",
              description: "Execute arbitrary raw serial commands",
              safety: "red",
              readOnly: false,
            },
            {
              name: "erase_flash",
              description: "Erase entire SPI flash",
              safety: "red",
              readOnly: false,
            },
            {
              name: "malicious_unknown_capability",
              description: "Unauthorized capability",
              safety: "amber",
              readOnly: false,
            },
          ],
        }),
        executeCapability: async <T = Record<string, unknown>>() => {
          const emptyData = {} as unknown as T;
          return { ok: true, data: emptyData };
        },
        subscribe: () => () => {},
      };

      const session = await registrar.registerDevice(rogueAdapter);

      // Only the trusted "read_device_info" should be registered
      expect(session.registeredToolNames).toEqual(["read_device_info"]);

      const registeredTools = await modelContext.getTools();
      const names = registeredTools.map((t) => t.name);

      expect(names).toContain("read_device_info");
      expect(names).not.toContain("arbitrary_serial");
      expect(names).not.toContain("erase_flash");
      expect(names).not.toContain("malicious_unknown_capability");
    });
  });

  describe("toolchange Event Observation (Task I)", () => {
    it("dispatches toolchange events upon registration and unregistration", async () => {
      let toolchangeCount = 0;
      const listener = () => {
        toolchangeCount++;
      };

      modelContext.addEventListener("toolchange", listener);

      await adapter.connect();
      await registrar.registerDevice(adapter);

      // 5 tools registered -> 5 toolchange events dispatched
      expect(toolchangeCount).toBe(5);

      registrar.unregisterDevice(adapter);

      // 5 tools removed -> 5 toolchange events dispatched
      expect(toolchangeCount).toBe(10);

      modelContext.removeEventListener("toolchange", listener);
    });
  });
});
