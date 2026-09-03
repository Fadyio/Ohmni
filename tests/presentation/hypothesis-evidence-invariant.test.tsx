/**
 * Milestone 5 — Hypothesis Evidence Invariant Test.
 *
 * Requirements:
 * 1. Hypothesis cannot advance to physical repair while supportingEvidenceIds.length === 0.
 * 2. If supportingEvidenceIds.length === 0:
 *    - Renders "EVIDENCE NOT LINKED"
 *    - Disables or omits the active "proceed-to-repair-btn"
 * 3. If supportingEvidenceIds.length > 0:
 *    - Renders "GROUNDED BY N FACTS"
 *    - Renders the active "proceed-to-repair-btn"
 */

import React from "react";
import { describe, expect, it } from "bun:test";
import { renderToString } from "react-dom/server";
import { HypothesisScene } from "@/presentation/components/investigation-story/scenes/HypothesisScene";
import type { Hypothesis } from "@/domain/hypothesis/types";

describe("Milestone 5 — Hypothesis Evidence Invariant", () => {
  it("displays EVIDENCE NOT LINKED and blocks repair when supportingEvidenceIds is empty", () => {
    const ungroundedHypothesis: Hypothesis = {
      id: "H-001",
      title: "Relay-induced supply sag",
      description: "Coil load pulls down 3.3V rail",
      confidence: "MEDIUM",
      status: "ACTIVE",
      verificationStatus: "NOT_VERIFIED",
      evidenceLinks: [],
      supportingEvidenceIds: [],
      contradictingEvidenceIds: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      createdBy: "agent",
    };

    let proceedClicked = false;
    const html = renderToString(
      <HypothesisScene
        hypothesis={ungroundedHypothesis}
        onProceedToRepair={() => {
          proceedClicked = true;
        }}
      />
    );

    // 1. Must explicitly display "EVIDENCE NOT LINKED"
    expect(html).toContain("EVIDENCE NOT LINKED");
    expect(html).not.toContain("GROUNDED BY 0 FACTS");

    // 2. Must NOT render active proceed-to-repair-btn
    expect(html).not.toContain('id="proceed-to-repair-btn"');
    expect(html).toContain("proceed-to-repair-btn-disabled");
    expect(html).toContain("Diagnosis must cite supporting evidence before proceeding to repair");
    expect(proceedClicked).toBe(false);
  });

  it("displays GROUNDED BY N FACTS and enables repair when supportingEvidenceIds has citations", () => {
    const groundedHypothesis: Hypothesis = {
      id: "H-001",
      title: "Relay-induced MCU supply brownout due to shared 3.3V rail",
      description: "Coil inrush collapses MCU rail below 2.80V threshold",
      confidence: "MEDIUM",
      status: "ACTIVE",
      verificationStatus: "NOT_VERIFIED",
      evidenceLinks: [
        { evidenceId: "E-001", relationship: "SUPPORTS" },
        { evidenceId: "E-002", relationship: "SUPPORTS" },
        { evidenceId: "E-003", relationship: "SUPPORTS" },
      ],
      supportingEvidenceIds: ["E-001", "E-002", "E-003"],
      contradictingEvidenceIds: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      createdBy: "agent",
    };

    const html = renderToString(
      <HypothesisScene
        hypothesis={groundedHypothesis}
        onProceedToRepair={() => undefined}
      />
    );

    // 1. Must display GROUNDED BY 3 FACTS
    expect(html).toContain("GROUNDED BY 3 FACTS");
    expect(html).not.toContain("EVIDENCE NOT LINKED");

    // 2. Must render the active proceed-to-repair-btn
    expect(html).toContain('id="proceed-to-repair-btn"');
    expect(html).toContain("Proceed to physical verification &amp; repair");
    expect(html).toContain("TOKEN E-001");
    expect(html).toContain("TOKEN E-002");
    expect(html).toContain("TOKEN E-003");
  });
});
