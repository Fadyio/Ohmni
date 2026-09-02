import { describe, it, expect } from "bun:test";
import {
  DefaultToolSafetyPolicy,
  classifyTool,
  requiresHumanApproval,
  type ToolExecutionClass,
} from "@/domain/safety/tool-safety-policy";

describe("ToolSafetyPolicy (Milestone 7.14)", () => {
  const policy = new DefaultToolSafetyPolicy();

  describe("Observe tools (read-only telemetry & inspection)", () => {
    const observeTools = [
      "read_device_info",
      "read_reset_history",
      "read_system_health",
      "measure_supply_voltage",
      "scan_i2c_bus",
      "list_evidence",
      "get_evidence",
      "list_hypotheses",
      "get_hypothesis",
    ];

    for (const tool of observeTools) {
      it(`classifies '${tool}' as 'observe' and does not require human approval`, () => {
        expect(policy.classify(tool)).toBe("observe");
        expect(policy.requiresHumanApproval(tool)).toBe(false);
        expect(classifyTool(tool)).toBe("observe");
        expect(requiresHumanApproval(tool)).toBe(false);
      });
    }
  });

  describe("Reason tools (software investigation & hypothesis state)", () => {
    const reasonTools = [
      "propose_hypothesis",
      "update_hypothesis",
      "link_evidence",
      "reject_hypothesis",
      "confirm_hypothesis",
      "record_conclusion",
    ];

    for (const tool of reasonTools) {
      it(`classifies '${tool}' as 'reason' and does NOT require human approval`, () => {
        expect(policy.classify(tool)).toBe("reason");
        expect(policy.requiresHumanApproval(tool)).toBe(false);
        expect(classifyTool(tool)).toBe("reason");
        expect(requiresHumanApproval(tool)).toBe(false);
      });
    }
  });

  describe("Physical tools (hardware actuation & physical intervention)", () => {
    const physicalTools = [
      "run_relay_stress_test",
      "request_human_intervention",
    ];

    for (const tool of physicalTools) {
      it(`classifies '${tool}' as 'physical' and REQUIRES human approval`, () => {
        expect(policy.classify(tool)).toBe("physical");
        expect(policy.requiresHumanApproval(tool)).toBe(true);
        expect(classifyTool(tool)).toBe("physical");
        expect(requiresHumanApproval(tool)).toBe(true);
      });
    }
  });

  describe("Unknown tools & annotations fallback", () => {
    it("classifies unknown tools with readOnlyHint: true as 'observe'", () => {
      expect(policy.classify("custom_telemetry_probe", { readOnlyHint: true })).toBe("observe");
      expect(policy.requiresHumanApproval("custom_telemetry_probe", { readOnlyHint: true })).toBe(false);
    });

    it("defaults unknown non-read-only tools to 'physical' (safe failure)", () => {
      expect(policy.classify("unknown_actuator_call", { readOnlyHint: false })).toBe("physical");
      expect(policy.requiresHumanApproval("unknown_actuator_call", { readOnlyHint: false })).toBe(true);
      expect(policy.classify("unannotated_custom_call")).toBe("physical");
      expect(policy.requiresHumanApproval("unannotated_custom_call")).toBe(true);
    });
  });
});
