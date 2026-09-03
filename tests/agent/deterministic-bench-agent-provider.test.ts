import { describe, expect, it } from "bun:test";
import { DeterministicBenchAgentProvider } from "@/infrastructure/bench-agent/deterministic-provider";
import type { AgentFunctionResult } from "@/infrastructure/bench-agent/types";

describe("Phase 2 & 5 — DeterministicBenchAgentProvider", () => {
  it("executes the complete brownout investigation reasoning loop purely from tool results", async () => {
    const provider = new DeterministicBenchAgentProvider();

    // Turn 1: Initial symptom input
    const turn1 = await provider.turn({
      input: "The controller restarts unexpectedly whenever the cooling fan relay turns on.",
      tools: [],
    });
    expect(turn1.functionCalls.length).toBe(1);
    expect(turn1.functionCalls[0].name).toBe("read_reset_history");

    // Turn 2: Reset history shows brownout
    const resetResult: AgentFunctionResult = {
      type: "function_result",
      name: "read_reset_history",
      call_id: turn1.functionCalls[0].id,
      result: [
        {
          type: "text",
          text: JSON.stringify({
            resets: [{ timestamp: 1000, reason: "BROWNOUT", message: "Supply voltage sagged to 2.72V" }],
            count: 1,
          }),
        },
      ],
    };
    const turn2 = await provider.turn({
      input: [resetResult],
      tools: [],
    });
    expect(turn2.functionCalls.length).toBe(1);
    expect(turn2.functionCalls[0].name).toBe("measure_supply_voltage");

    // Turn 3: Baseline voltage measured (nominal 3.31V)
    const voltageResult: AgentFunctionResult = {
      type: "function_result",
      name: "measure_supply_voltage",
      call_id: turn2.functionCalls[0].id,
      result: [
        {
          type: "text",
          text: JSON.stringify({ voltage: 3.31, unit: "V", status: "normal" }),
        },
      ],
    };
    const turn3 = await provider.turn({
      input: [voltageResult],
      tools: [],
    });
    expect(turn3.functionCalls.length).toBe(1);
    expect(turn3.functionCalls[0].name).toBe("run_relay_stress_test");

    // Turn 4: Stress test reproduced brownout
    const stressResult1: AgentFunctionResult = {
      type: "function_result",
      name: "run_relay_stress_test",
      call_id: turn3.functionCalls[0].id,
      result: [
        {
          type: "text",
          text: JSON.stringify({
            status: "failed",
            resetOccurred: true,
            faultReproduced: true,
            minVoltage: 2.72,
            unexpected_resets: 1,
          }),
        },
      ],
    };
    const turn4 = await provider.turn({
      input: [stressResult1],
      tools: [],
    });
    expect(turn4.functionCalls.length).toBe(1);
    expect(turn4.functionCalls[0].name).toBe("propose_hypothesis");
    expect((turn4.functionCalls[0].arguments as any).title).toContain("brownout");

    // Turn 5: Hypothesis created
    const hypResult: AgentFunctionResult = {
      type: "function_result",
      name: "propose_hypothesis",
      call_id: turn4.functionCalls[0].id,
      result: [
        {
          type: "text",
          text: JSON.stringify({
            hypothesis: { id: "HYP-001", title: "Relay-induced MCU supply brownout" },
          }),
        },
      ],
    };
    const turn5 = await provider.turn({
      input: [hypResult],
      tools: [],
    });
    expect(turn5.functionCalls.length).toBe(1);
    expect(turn5.functionCalls[0].name).toBe("request_human_intervention");
    expect((turn5.functionCalls[0].arguments as any).target).toBe("relay_power_jumper");

    // Turn 6: Human intervention acknowledged, agent standing by
    const interventionResult: AgentFunctionResult = {
      type: "function_result",
      name: "request_human_intervention",
      call_id: turn5.functionCalls[0].id,
      result: [
        {
          type: "text",
          text: JSON.stringify({ status: "REQUESTED", target: "relay_power_jumper" }),
        },
      ],
    };
    const turn6 = await provider.turn({
      input: [interventionResult],
      tools: [],
    });
    expect(turn6.functionCalls.length).toBe(0);
    expect(turn6.text).toContain("Waiting for human");

    // Turn 7: Human technician reports moving JP1 to 5V
    const turn7 = await provider.turn({
      input: "Human technician moved relay supply jumper JP1 from shared 3.3V to external 5V auxiliary rail.",
      tools: [],
    });
    expect(turn7.functionCalls.length).toBe(1);
    expect(turn7.functionCalls[0].name).toBe("run_relay_stress_test");

    // Turn 8: Post-repair stress test passes! (3.18V, zero resets)
    const stressResult2: AgentFunctionResult = {
      type: "function_result",
      name: "run_relay_stress_test",
      call_id: turn7.functionCalls[0].id,
      result: [
        {
          type: "text",
          text: JSON.stringify({
            status: "completed",
            experiment_id: "exp_verification_123",
            resetOccurred: false,
            faultReproduced: false,
            minVoltage: 3.18,
            unexpected_resets: 0,
          }),
        },
      ],
    };
    const turn8 = await provider.turn({
      input: [stressResult2],
      tools: [],
    });
    expect(turn8.functionCalls.length).toBe(1);
    expect(turn8.functionCalls[0].name).toBe("update_hypothesis");
    expect((turn8.functionCalls[0].arguments as any).hypothesis_id).toBe("HYP-001");
    expect((turn8.functionCalls[0].arguments as any).confidence).toBe("HIGH");

    // Turn 9: Confidence elevated to HIGH, provider calls confirm_hypothesis
    const updateResult: AgentFunctionResult = {
      type: "function_result",
      name: "update_hypothesis",
      call_id: turn8.functionCalls[0].id,
      result: [
        {
          type: "text",
          text: JSON.stringify({ ok: true, hypothesis: { id: "HYP-001", confidence: "HIGH" } }),
        },
      ],
    };
    const turn9 = await provider.turn({
      input: [updateResult],
      tools: [],
    });
    expect(turn9.functionCalls.length).toBe(1);
    expect(turn9.functionCalls[0].name).toBe("confirm_hypothesis");
    expect((turn9.functionCalls[0].arguments as any).hypothesis_id).toBe("HYP-001");
    expect((turn9.functionCalls[0].arguments as any).verified_experiment_id).toBe("exp_verification_123");

    // Turn 10: Confirmation recorded
    const confirmResult: AgentFunctionResult = {
      type: "function_result",
      name: "confirm_hypothesis",
      call_id: turn9.functionCalls[0].id,
      result: [
        {
          type: "text",
          text: JSON.stringify({ ok: true, hypothesisId: "HYP-001", status: "VERIFIED" }),
        },
      ],
    };
    const turn10 = await provider.turn({
      input: [confirmResult],
      tools: [],
    });
    expect(turn10.functionCalls.length).toBe(0);
    expect(turn10.text).toContain("Investigation complete");
  });

  it("passes canary check with deterministic-demo model", async () => {
    const provider = new DeterministicBenchAgentProvider();
    const canary = await provider.canary();
    expect(canary.ok).toBe(true);
    expect(canary.model).toBe("deterministic-demo");
  });
});
