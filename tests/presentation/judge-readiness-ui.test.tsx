import React from "react";
import { describe, expect, it } from "bun:test";
import { renderToString } from "react-dom/server";
import { WelcomeView } from "@/presentation/components/welcome/WelcomeView";
import { RepairVerificationScene } from "@/presentation/components/repair/RepairVerificationScene";
import { VirtualDeviceAdapter } from "@/domain/device/virtual-adapter";
import {
  buildToolReceipt,
  type BenchAgentActivity,
} from "@/presentation/hooks/useBenchAgent";

describe("production judge-readiness UI", () => {
  it("uses truthful virtual-device product copy", () => {
    const html = renderToString(<WelcomeView onStartDemo={() => undefined} />);

    expect(html).toContain("Give your AI agent instruments for the physical world.");
    expect(html).toContain("Open agent-ready workbench");
  });

  it("does not mutate virtual JP1 while merely rendering the intervention request", () => {
    const adapter = new VirtualDeviceAdapter();
    expect(adapter.getInterventionPoint("relay_power_jumper")).toBe("3v3");

    const html = renderToString(
      <RepairVerificationScene
        deviceAdapter={adapter}
        onReturnToInvestigation={() => undefined}
      />,
    );

    expect(adapter.getInterventionPoint("relay_power_jumper")).toBe("3v3");
    expect(html).toContain("Virtual DUT intervention required");
    expect(html).toContain("Simulate moving JP1");
  });

  it("derives visible receipts only from actual call arguments and results", () => {
    const activity: BenchAgentActivity = {
      call: {
        id: "call-1",
        name: "run_relay_stress_test",
        arguments: { relay: "cooling_fan", duration_ms: 3000, apiKey: "secret" },
      },
      status: "completed",
      result: JSON.stringify({
        experiment_id: "exp_abc123",
        evidence_ids: ["E-002", "E-003"],
        resetOccurred: true,
        supply_voltage: { minimum_v: 2.72 },
      }),
    };

    const receipt = buildToolReceipt(activity);
    expect(receipt.toolName).toBe("run_relay_stress_test");
    expect(receipt.argumentsText).toContain("cooling_fan");
    expect(receipt.argumentsText).toContain("[REDACTED]");
    expect(receipt.argumentsText).not.toContain("secret");
    expect(receipt.resultText).toContain("2.72");
    expect(receipt.experimentId).toBe("exp_abc123");
    expect(receipt.evidenceIds).toEqual(["E-002", "E-003"]);
  });
});
