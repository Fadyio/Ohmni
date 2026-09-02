import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { VirtualDeviceAdapter } from "@/domain/device/virtual-adapter";
import { runBenchAgent } from "@/infrastructure/bench-agent/run-bench-agent";
import type {
  AgentFunctionResult,
  AgentTurnRequest,
  AgentTurnResult,
  BenchAgentProvider,
} from "@/infrastructure/bench-agent/types";
import { InMemoryModelContext } from "@/infrastructure/webmcp/in-memory-model-context";
import { DeviceToolRegistrar } from "@/infrastructure/webmcp/device-tool-registrar";

interface TurnOptions {
  readonly signal?: AbortSignal;
}

type ProviderTurn =
  | AgentTurnResult
  | ((
      request: AgentTurnRequest,
      options?: TurnOptions
    ) => AgentTurnResult | Promise<AgentTurnResult>);

let providers: DeterministicProvider[];

class DeterministicProvider implements BenchAgentProvider {
  public readonly requests: AgentTurnRequest[] = [];
  private turnIndex = 0;

  public constructor(private readonly turns: readonly ProviderTurn[]) {
    providers.push(this);
  }

  public async turn(
    request: AgentTurnRequest,
    options?: TurnOptions
  ): Promise<AgentTurnResult> {
    this.requests.push(structuredClone(request));

    const turn = this.turns[this.turnIndex];
    this.turnIndex += 1;
    if (!turn) {
      throw new Error(`Unexpected provider turn ${this.turnIndex}`);
    }

    return typeof turn === "function" ? turn(request, options) : turn;
  }
}

function resultInput(request: AgentTurnRequest): readonly AgentFunctionResult[] {
  expect(Array.isArray(request.input)).toBe(true);
  return request.input as readonly AgentFunctionResult[];
}

function expectStructuredError(
  result: AgentFunctionResult,
  expected: { callId: string; name: string; message: RegExp }
): void {
  expect(result).toMatchObject({
    type: "function_result",
    name: expected.name,
    call_id: expected.callId,
    is_error: true,
  });
  expect(result.result).toHaveLength(1);
  expect(result.result[0].type).toBe("text");

  const payload: unknown = JSON.parse(result.result[0].text);
  expect(payload).not.toBeNull();
  expect(typeof payload).toBe("object");
  expect(JSON.stringify(payload)).toMatch(expected.message);
}

function deferred<T>(): {
  readonly promise: Promise<T>;
  readonly resolve: (value: T) => void;
} {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

beforeEach(() => {
  providers = [];
});

afterEach(() => {
  for (const provider of providers) {
    const serializedRequests = JSON.stringify(provider.requests);
    expect(serializedRequests).not.toContain("relay_power");
    expect(serializedRequests).not.toContain("hiddenFault");
    expect(serializedRequests).not.toContain("expectedFix");
    expect(serializedRequests).not.toContain("faultScenarioName");
  }
});

describe("runBenchAgent", () => {
  it("serializes only the registered virtual device public tool contract", async () => {
    const modelContext = new InMemoryModelContext();
    const adapter = new VirtualDeviceAdapter();
    adapter.setInterventionPoint("hiddenFault", "expectedFix");
    adapter.setInterventionPoint("faultScenarioName", "relay_power");
    const registrar = new DeviceToolRegistrar(modelContext);

    await adapter.connect();
    try {
      await registrar.registerDevice(adapter);

      const provider = new DeterministicProvider([
        {
          interactionId: "interaction-public-device-tools",
          functionCalls: [],
          text: "The public device tool contract is available.",
        },
      ]);

      const terminal = await runBenchAgent({
        goal: "Inspect the public device tool contract",
        modelContext,
        provider,
        requestApproval: async () => true,
        onEvent: () => undefined,
      });

      expect(terminal).toMatchObject({ status: "completed" });
      expect(provider.requests).toHaveLength(1);

      const serializedPayload = JSON.stringify(provider.requests[0]);
      expect(JSON.parse(serializedPayload)).toMatchObject({
        input: "Inspect the public device tool contract",
        tools: [
          {
            type: "function",
            name: "read_device_info",
            description:
              "Read hardware identity, firmware build metadata, MCU architecture, and MAC address from the connected device.",
            parameters: {
              type: "object",
              properties: {},
              additionalProperties: false,
            },
          },
          {
            type: "function",
            name: "read_reset_history",
            description:
              "Retrieve the hardware boot and reset event history log to identify past brownouts, watchdogs, software resets, and reset causes.",
            parameters: {
              type: "object",
              properties: {},
              additionalProperties: false,
            },
          },
          {
            type: "function",
            name: "read_system_health",
            description:
              "Read current operational diagnostics: heap memory, internal core temperature, and system uptime.",
            parameters: {
              type: "object",
              properties: {},
              additionalProperties: false,
            },
          },
          {
            type: "function",
            name: "measure_supply_voltage",
            description:
              "Sample the internal analog-to-digital converter (ADC) to measure instantaneous VDD rail voltage.",
            parameters: {
              type: "object",
              properties: {},
              additionalProperties: false,
            },
          },
          {
            type: "function",
            name: "run_relay_stress_test",
            description:
              "Actuate the onboard relay under inrush load to test power supply rail stability and detect load-induced brownout resets.",
            parameters: {
              type: "object",
              properties: {
                cycles: {
                  type: "integer",
                  minimum: 1,
                  maximum: 10,
                  description: "Number of relay activation cycles (default 3)",
                },
                duration_ms: {
                  type: "integer",
                  minimum: 10,
                  maximum: 500,
                  description:
                    "Duration in milliseconds for each relay cycle (default 50)",
                },
              },
              additionalProperties: false,
            },
          },
        ],
      });
      expect(serializedPayload).not.toContain("relay_power");
      expect(serializedPayload).not.toContain("hiddenFault");
      expect(serializedPayload).not.toContain("expectedFix");
      expect(serializedPayload).not.toContain("faultScenarioName");
    } finally {
      registrar.unregisterDevice(adapter);
      await adapter.disconnect();
    }
  });

  it("rediscovers and resends only the current registered tools on every provider turn", async () => {
    const modelContext = new InMemoryModelContext();
    const firstRegistration = new AbortController();
    const executions: string[] = [];

    await modelContext.registerTool(
      {
        name: "read_first_probe",
        description: "Read the first public probe.",
        inputSchema: { type: "object", additionalProperties: false },
        annotations: { readOnlyHint: true },
        execute: async () => {
          executions.push("read_first_probe");
          firstRegistration.abort();
          await modelContext.registerTool({
            name: "read_second_probe",
            description: "Read the second public probe.",
            inputSchema: { type: "object", additionalProperties: false },
            annotations: { readOnlyHint: true },
            execute: async () => ({ value: 2 }),
          });
          return { value: 1 };
        },
      },
      { signal: firstRegistration.signal }
    );

    const provider = new DeterministicProvider([
      {
        interactionId: "interaction-1",
        functionCalls: [
          { id: "call-first", name: "read_first_probe", arguments: {} },
        ],
      },
      {
        interactionId: "interaction-2",
        functionCalls: [],
        text: "The current probe inventory is ready.",
      },
    ]);
    const events: unknown[] = [];

    const terminal = await runBenchAgent({
      goal: "Inspect the available probes",
      modelContext,
      provider,
      requestApproval: async () => true,
      onEvent: (event) => events.push(event),
    });

    expect(provider.requests).toHaveLength(2);
    expect(provider.requests[0]).toMatchObject({
      input: "Inspect the available probes",
      tools: [{ type: "function", name: "read_first_probe" }],
    });
    expect(provider.requests[1].tools.map((tool) => tool.name)).toEqual([
      "read_second_probe",
    ]);
    expect(provider.requests[1].previousInteractionId).toBe("interaction-1");
    expect(executions).toEqual(["read_first_probe"]);
    expect(JSON.stringify(events)).toContain("call-first");
    expect(JSON.stringify(events)).toContain("read_first_probe");
    expect(terminal).toMatchObject({ status: "completed" });
    expect(JSON.stringify(terminal)).toContain(
      "The current probe inventory is ready."
    );
  });

  it("correlates multiple function-result turns before returning final text", async () => {
    const modelContext = new InMemoryModelContext();
    const executionEffects: Array<{ name: string; input: Record<string, unknown> }> = [];

    await modelContext.registerTool({
      name: "read_counter",
      description: "Read and advance a deterministic counter.",
      inputSchema: {
        type: "object",
        properties: { delta: { type: "number" } },
        required: ["delta"],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true },
      execute: async (input) => {
        executionEffects.push({ name: "read_counter", input });
        return { total: input.delta };
      },
    });
    await modelContext.registerTool({
      name: "read_label",
      description: "Read a deterministic public label.",
      inputSchema: {
        type: "object",
        properties: { label: { type: "string" } },
        required: ["label"],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true },
      execute: async (input) => {
        executionEffects.push({ name: "read_label", input });
        return { label: input.label };
      },
    });

    const provider = new DeterministicProvider([
      {
        interactionId: "interaction-a",
        functionCalls: [
          {
            id: "call-counter",
            name: "read_counter",
            arguments: { delta: 2 },
          },
        ],
      },
      {
        interactionId: "interaction-b",
        functionCalls: [
          {
            id: "call-label",
            name: "read_label",
            arguments: { label: "stable" },
          },
        ],
      },
      {
        interactionId: "interaction-c",
        functionCalls: [],
        text: "Both observations are correlated.",
      },
    ]);
    const events: unknown[] = [];

    const terminal = await runBenchAgent({
      goal: "Collect two observations",
      modelContext,
      provider,
      requestApproval: async () => true,
      onEvent: (event) => events.push(event),
    });

    expect(provider.requests).toHaveLength(3);
    expect(provider.requests[0].input).toBe("Collect two observations");
    expect(provider.requests[0].previousInteractionId).toBeUndefined();

    const firstResults = resultInput(provider.requests[1]);
    expect(provider.requests[1].previousInteractionId).toBe("interaction-a");
    expect(firstResults).toHaveLength(1);
    expect(firstResults[0]).toMatchObject({
      type: "function_result",
      name: "read_counter",
      call_id: "call-counter",
    });
    expect(JSON.parse(firstResults[0].result[0].text)).toEqual({ total: 2 });

    const secondResults = resultInput(provider.requests[2]);
    expect(provider.requests[2].previousInteractionId).toBe("interaction-b");
    expect(secondResults).toHaveLength(1);
    expect(secondResults[0]).toMatchObject({
      type: "function_result",
      name: "read_label",
      call_id: "call-label",
    });
    expect(JSON.parse(secondResults[0].result[0].text)).toEqual({
      label: "stable",
    });
    expect(provider.requests.every((request) => request.tools.length === 2)).toBe(
      true
    );
    expect(executionEffects).toEqual([
      { name: "read_counter", input: { delta: 2 } },
      { name: "read_label", input: { label: "stable" } },
    ]);
    expect(JSON.stringify(events)).toContain("call-counter");
    expect(JSON.stringify(events)).toContain("call-label");
    expect(terminal).toMatchObject({ status: "completed" });
    expect(JSON.stringify(terminal)).toContain("Both observations are correlated.");
  });

  it("rejects the unknown exact name erase_flash without executing or requesting approval", async () => {
    const modelContext = new InMemoryModelContext();
    let executions = 0;
    let approvalRequests = 0;

    await modelContext.registerTool({
      name: "read_flash_status",
      description: "Read public flash status without modifying it.",
      inputSchema: { type: "object", additionalProperties: false },
      annotations: { readOnlyHint: true },
      execute: async () => {
        executions += 1;
        return { status: "ready" };
      },
    });

    const provider = new DeterministicProvider([
      {
        interactionId: "interaction-unknown",
        functionCalls: [
          { id: "call-erase", name: "erase_flash", arguments: {} },
        ],
      },
      {
        interactionId: "interaction-recovered",
        functionCalls: [],
        text: "I will use only available tools.",
      },
    ]);
    const events: unknown[] = [];

    const terminal = await runBenchAgent({
      goal: "Inspect flash status",
      modelContext,
      provider,
      requestApproval: async () => {
        approvalRequests += 1;
        return true;
      },
      onEvent: (event) => events.push(event),
    });

    expect(executions).toBe(0);
    expect(approvalRequests).toBe(0);
    const unavailable = resultInput(provider.requests[1]);
    expect(unavailable).toHaveLength(1);
    expectStructuredError(unavailable[0], {
      callId: "call-erase",
      name: "erase_flash",
      message: /erase_flash.*unavailable|unavailable.*erase_flash/i,
    });
    expect(JSON.stringify(events)).toContain("call-erase");
    expect(JSON.stringify(events)).toMatch(/unavailable/i);
    expect(terminal).toMatchObject({ status: "completed" });
  });

  it("does not execute a tool unregistered after the model turn and returns a correlated unavailable result", async () => {
    const modelContext = new InMemoryModelContext();
    const registration = new AbortController();
    let executions = 0;

    await modelContext.registerTool(
      {
        name: "read_ephemeral_probe",
        description: "Read an ephemeral public probe.",
        inputSchema: { type: "object", additionalProperties: false },
        annotations: { readOnlyHint: true },
        execute: async () => {
          executions += 1;
          return { value: 7 };
        },
      },
      { signal: registration.signal }
    );

    const provider = new DeterministicProvider([
      (request) => {
        expect(request.tools.map((tool) => tool.name)).toEqual([
          "read_ephemeral_probe",
        ]);
        registration.abort();
        return {
          interactionId: "interaction-stale",
          functionCalls: [
            {
              id: "call-stale",
              name: "read_ephemeral_probe",
              arguments: {},
            },
          ],
        };
      },
      {
        interactionId: "interaction-after-stale",
        functionCalls: [],
        text: "The stale probe was skipped.",
      },
    ]);
    const events: unknown[] = [];

    const terminal = await runBenchAgent({
      goal: "Read the ephemeral probe",
      modelContext,
      provider,
      requestApproval: async () => true,
      onEvent: (event) => events.push(event),
    });

    expect(executions).toBe(0);
    expect(provider.requests[1].tools).toEqual([]);
    const unavailable = resultInput(provider.requests[1]);
    expect(unavailable).toHaveLength(1);
    expectStructuredError(unavailable[0], {
      callId: "call-stale",
      name: "read_ephemeral_probe",
      message: /read_ephemeral_probe.*unavailable|unavailable.*read_ephemeral_probe/i,
    });
    expect(JSON.stringify(events)).toContain("call-stale");
    expect(JSON.stringify(events)).toMatch(/unavailable/i);
    expect(terminal).toMatchObject({ status: "completed" });
  });

  it("returns stopped without calling the provider or tools when pre-aborted", async () => {
    const modelContext = new InMemoryModelContext();
    const controller = new AbortController();
    const events: unknown[] = [];
    let executions = 0;

    await modelContext.registerTool({
      name: "read_never_started",
      description: "Read a value only if the run starts.",
      inputSchema: { type: "object", additionalProperties: false },
      annotations: { readOnlyHint: true },
      execute: async () => {
        executions += 1;
        return { started: true };
      },
    });
    const provider = new DeterministicProvider([
      {
        interactionId: "interaction-never-started",
        functionCalls: [],
        text: "This must not be requested.",
      },
    ]);
    controller.abort();

    const terminal = await runBenchAgent({
      goal: "Do not start",
      modelContext,
      provider,
      requestApproval: async () => true,
      onEvent: (event) => events.push(event),
      signal: controller.signal,
    });

    expect(provider.requests).toHaveLength(0);
    expect(executions).toBe(0);
    expect(events).toEqual([]);
    expect(terminal).toMatchObject({ status: "stopped" });
  });

  it("stops a mid-loop tool execution through the run AbortSignal", async () => {
    const modelContext = new InMemoryModelContext();
    const controller = new AbortController();
    const events: unknown[] = [];
    let executionStarts = 0;

    await modelContext.registerTool({
      name: "read_slow_probe",
      description: "Read a probe that waits for cancellation.",
      inputSchema: { type: "object", additionalProperties: false },
      annotations: { readOnlyHint: true },
      execute: async (_input, options) => {
        executionStarts += 1;
        expect(options?.signal).toBe(controller.signal);
        controller.abort();
        throw new DOMException("Run stopped", "AbortError");
      },
    });
    const provider = new DeterministicProvider([
      {
        interactionId: "interaction-slow",
        functionCalls: [
          { id: "call-slow", name: "read_slow_probe", arguments: {} },
        ],
      },
    ]);

    const terminal = await runBenchAgent({
      goal: "Start then stop",
      modelContext,
      provider,
      requestApproval: async () => true,
      onEvent: (event) => events.push(event),
      signal: controller.signal,
    });

    expect(provider.requests).toHaveLength(1);
    expect(executionStarts).toBe(1);
    expect(JSON.stringify(events)).toContain("call-slow");
    expect(terminal).toMatchObject({ status: "stopped" });
  });

  it("keeps an amber call pending for approval and then executes that exact current tool", async () => {
    const modelContext = new InMemoryModelContext();
    const approval = deferred<boolean>();
    const approvalRequested = deferred<void>();
    const executions: Record<string, unknown>[] = [];
    const events: unknown[] = [];

    await modelContext.registerTool({
      name: "run_calibration_cycle",
      description: "Run a calibration cycle with observable device activity.",
      inputSchema: {
        type: "object",
        properties: { cycles: { type: "integer" } },
        required: ["cycles"],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false },
      execute: async (input) => {
        executions.push(input);
        return { completed: true, cycles: input.cycles };
      },
    });

    const provider = new DeterministicProvider([
      {
        interactionId: "interaction-amber",
        functionCalls: [
          {
            id: "call-amber",
            name: "run_calibration_cycle",
            arguments: { cycles: 3 },
          },
        ],
      },
      {
        interactionId: "interaction-approved",
        functionCalls: [],
        text: "Calibration completed after approval.",
      },
    ]);

    const run = runBenchAgent({
      goal: "Calibrate safely",
      modelContext,
      provider,
      requestApproval: () => {
        approvalRequested.resolve();
        return approval.promise;
      },
      onEvent: (event) => events.push(event),
    });

    await approvalRequested.promise;
    expect(executions).toEqual([]);
    expect(provider.requests).toHaveLength(1);
    expect(JSON.stringify(events)).toContain("call-amber");
    expect(JSON.stringify(events)).toContain("run_calibration_cycle");

    approval.resolve(true);
    const terminal = await run;

    expect(executions).toEqual([{ cycles: 3 }]);
    const approvedResult = resultInput(provider.requests[1]);
    expect(approvedResult[0]).toMatchObject({
      call_id: "call-amber",
      name: "run_calibration_cycle",
    });
    expect(JSON.parse(approvedResult[0].result[0].text)).toEqual({
      completed: true,
      cycles: 3,
    });
    expect(terminal).toMatchObject({ status: "completed" });
  });

  it("returns a correlated structured denial and lets the provider finish", async () => {
    const modelContext = new InMemoryModelContext();
    const events: unknown[] = [];
    let executions = 0;

    await modelContext.registerTool({
      name: "run_load_cycle",
      description: "Run a load cycle with observable device activity.",
      inputSchema: { type: "object", additionalProperties: false },
      execute: async () => {
        executions += 1;
        return { completed: true };
      },
    });

    const provider = new DeterministicProvider([
      {
        interactionId: "interaction-denied",
        functionCalls: [
          { id: "call-denied", name: "run_load_cycle", arguments: {} },
        ],
      },
      {
        interactionId: "interaction-adapted",
        functionCalls: [],
        text: "The load cycle was not run.",
      },
    ]);

    const terminal = await runBenchAgent({
      goal: "Run only with approval",
      modelContext,
      provider,
      requestApproval: async () => false,
      onEvent: (event) => events.push(event),
    });

    expect(executions).toBe(0);
    expect(provider.requests).toHaveLength(2);
    const denied = resultInput(provider.requests[1]);
    expect(denied).toHaveLength(1);
    expectStructuredError(denied[0], {
      callId: "call-denied",
      name: "run_load_cycle",
      message: /denied|denial/i,
    });
    expect(JSON.stringify(events)).toContain("call-denied");
    expect(JSON.stringify(events)).toMatch(/denied|denial/i);
    expect(terminal).toMatchObject({ status: "completed" });
    expect(JSON.stringify(terminal)).toContain("The load cycle was not run.");
  });

  it("uses the default 12-step limit and never executes a thirteenth call", async () => {
    const modelContext = new InMemoryModelContext();
    const events: unknown[] = [];
    const executedIndexes: number[] = [];

    await modelContext.registerTool({
      name: "read_step",
      description: "Read one deterministic loop step.",
      inputSchema: {
        type: "object",
        properties: { index: { type: "integer" } },
        required: ["index"],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true },
      execute: async (input) => {
        executedIndexes.push(input.index as number);
        return { index: input.index };
      },
    });

    const provider = new DeterministicProvider([
      {
        interactionId: "interaction-limit",
        functionCalls: Array.from({ length: 13 }, (_, index) => ({
          id: `call-${index + 1}`,
          name: "read_step",
          arguments: { index: index + 1 },
        })),
      },
    ]);

    const terminal = await runBenchAgent({
      goal: "Exercise the bounded loop",
      modelContext,
      provider,
      requestApproval: async () => true,
      onEvent: (event) => events.push(event),
    });

    expect(executedIndexes).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(executedIndexes).not.toContain(13);
    expect(provider.requests).toHaveLength(1);
    expect(JSON.stringify(events)).toContain("call-12");
    expect(terminal).toMatchObject({ status: "step-limit" });
  });

  it("returns an explicit failed terminal result when the provider throws", async () => {
    const modelContext = new InMemoryModelContext();
    const events: unknown[] = [];
    const provider = new DeterministicProvider([
      async () => {
        throw new Error("deterministic provider failure");
      },
    ]);

    const terminal = await runBenchAgent({
      goal: "Handle a provider failure",
      modelContext,
      provider,
      requestApproval: async () => true,
      onEvent: (event) => events.push(event),
    });

    expect(provider.requests).toHaveLength(1);
    expect(events).toEqual([]);
    expect(terminal).toMatchObject({ status: "failed" });
    expect(JSON.stringify(terminal)).toContain("deterministic provider failure");
  });

  it("preserves previousInteractionId and returns interactionId across multi-turn human observation continuation", async () => {
    const modelContext = new InMemoryModelContext();
    const events: unknown[] = [];
    let toolCallCount = 0;

    await modelContext.registerTool({
      name: "run_retest",
      description: "Run empirical retest.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      annotations: { readOnlyHint: false },
      execute: async () => {
        toolCallCount += 1;
        return { success: true, voltage: 3.18 };
      },
    });

    const provider = new DeterministicProvider([
      // Turn 1: Initial diagnosis
      {
        interactionId: "interaction-initial-diag",
        functionCalls: [],
        text: "Diagnosis: Move relay jumper to 5V rail.",
      },
      // Turn 2: Retest after human observation
      {
        interactionId: "interaction-retest-step",
        functionCalls: [
          {
            id: "call-retest-1",
            name: "run_retest",
            arguments: {},
          },
        ],
      },
      // Turn 3: Confirmation
      {
        interactionId: "interaction-confirmed",
        functionCalls: [],
        text: "Empirical verification complete: nominal 3.18V verified.",
      },
    ]);

    // Run 1: Initial turn
    const result1 = await runBenchAgent({
      goal: "Diagnose unexpected brownout reset",
      modelContext,
      provider,
      requestApproval: async () => true,
      onEvent: (event) => events.push(event),
    });

    expect(result1.status).toBe("completed");
    expect(result1.interactionId).toBe("interaction-initial-diag");
    expect(provider.requests[0]?.previousInteractionId).toBeUndefined();

    // Run 2: Continuation with human observation
    const result2 = await runBenchAgent({
      goal: "Human observation: Relay power jumper moved from shared 3.3V rail to external 5V rail.",
      previousInteractionId: result1.interactionId,
      modelContext,
      provider,
      requestApproval: async () => true,
      onEvent: (event) => events.push(event),
    });

    expect(result2.status).toBe("completed");
    expect(result2.interactionId).toBe("interaction-confirmed");
    expect(toolCallCount).toBe(1);
    expect(provider.requests[1]?.previousInteractionId).toBe("interaction-initial-diag");
    expect(provider.requests[2]?.previousInteractionId).toBe("interaction-retest-step");
  });
});
