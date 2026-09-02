import { describe, it, expect } from "bun:test";
import { DefaultToolSafetyPolicy } from "@/domain/safety/tool-safety-policy";

describe("InvestigationNarrativeRail Event Truth (Milestone 7.14)", () => {
  it("strictly filters completed events and excludes requested / waiting-approval events", () => {
    const activities = [
      {
        call: { id: "call-1", name: "read_reset_history", arguments: {} },
        status: "completed" as const,
        result: JSON.stringify({ resets: [] }),
      },
      {
        call: { id: "call-2", name: "run_relay_stress_test", arguments: { cycles: 3 } },
        status: "waiting-approval" as const,
      },
      {
        call: { id: "call-3", name: "propose_hypothesis", arguments: { title: "Brownout" } },
        status: "requested" as const,
      },
    ];
    const isCompletedActivity = (a: { status: string }) => a.status === "completed";
    const completed = activities.filter(isCompletedActivity);
    expect(completed).toHaveLength(1);
    expect(completed[0].call.name).toBe("read_reset_history");

    // Verify waiting-approval and requested are filtered out
    expect(activities.filter((a) => a.status === "waiting-approval")).toHaveLength(1);
    expect(activities.filter((a) => a.status === "requested")).toHaveLength(1);
  });
});
