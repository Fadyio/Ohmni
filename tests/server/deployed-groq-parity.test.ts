import { describe, expect, it } from "bun:test";
import {
  GROQ_MAX_COMPLETION_TOKENS as deployedMaxTokens,
  isGroqVerificationWorkflow as deployedIsVerification,
  selectGroqToolChoice as deployedToolChoice,
  translateToolsToGroq as deployedTranslateTools,
} from "../../api/bench-agent";
import type { AgentTurnRequest as DeployedAgentTurnRequest } from "../../api/bench-agent";
import {
  GROQ_MAX_COMPLETION_TOKENS as moduleMaxTokens,
  isGroqVerificationWorkflow as moduleIsVerification,
  selectGroqToolChoice as moduleToolChoice,
  translateToolsToGroq as moduleTranslateTools,
} from "../../server/bench-agent/groq-provider";
import type { AgentTurnRequest, AgentToolDeclaration } from "../../src/infrastructure/bench-agent/types";

describe("deployed Groq adapter parity", () => {
  const marker =
    "Human observation: JP1 moved. The requested intervention is complete. Re-run run_relay_stress_test with the same parameters now.";
  const retestResult: AgentTurnRequest["input"] = [
    {
      type: "function_result",
      call_id: "call-retest",
      name: "run_relay_stress_test",
      result: [
        {
          type: "text",
          text: '{"experiment_id":"exp-002","unexpected_resets":0,"evidence_ids":["E-010"]}',
        },
      ],
    },
  ];
  const verboseTool: AgentToolDeclaration = {
    type: "function",
    name: "confirm_hypothesis",
    description: "x".repeat(400),
    parameters: {
      type: "object",
      properties: {
        hypothesis_id: { type: "string", description: "Verbose schema prose" },
      },
    },
  };

  it("keeps the Vercel function's bounded verification policy in sync with the tested module", () => {
    const request: AgentTurnRequest = {
      input: retestResult,
      tools: [verboseTool],
      history: [{ role: "user", content: marker }],
    };
    const deployedRequest = request as unknown as DeployedAgentTurnRequest;
    const deployedRetestResult = retestResult as DeployedAgentTurnRequest["input"];

    expect(deployedMaxTokens).toBe(moduleMaxTokens);
    expect(deployedIsVerification(deployedRequest)).toBe(moduleIsVerification(request));
    expect(deployedToolChoice(marker)).toEqual(moduleToolChoice(marker));
    expect(deployedToolChoice(deployedRetestResult, true)).toEqual(
      moduleToolChoice(retestResult, true),
    );
    expect(deployedTranslateTools([verboseTool])).toEqual(
      moduleTranslateTools([verboseTool]),
    );
  });
});
