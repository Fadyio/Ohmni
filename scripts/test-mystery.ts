/**
 * Phase 13 — Mystery Fault Test Matrix Runner.
 * Executes the complete blind investigation matrix across all 3 canonical scenarios:
 *
 * - Scenario A: Relay Supply Brownout (ESP32-S3 shared 3.3V rail collapse)
 * - Scenario B: I2C Address Mismatch (Sensor responding at 0x77 vs firmware polling 0x76)
 * - Scenario C: Physical SDA Line Fault (Open contact / unseated bus continuity)
 *
 * Verifies:
 * - Sealed ground-truth firewall (zero hidden state leaked to agent)
 * - Autonomous empirical measurement & observation
 * - Physical human intervention execution & immutable observation ledger
 * - Post-repair verification rerun
 * - Deterministic semantic diagnosis matching without LLM self-grading
 *
 * NOTE: The test execution uses a DETERMINISTIC TEST AGENT to prove protocol
 * semantics and domain contracts. Live Gemini reasoning is validated separately.
 */

import { spawnSync } from "node:child_process";

console.info("==================================================================");
console.info("   OHMNI — PHASE 13: MYSTERY FAULT TEST MATRIX GATE              ");
console.info("   DETERMINISTIC TEST AGENT: 3/3 Blind Hardware Investigation Scenarios");
console.info("==================================================================\n");

console.info("Executing Scenario Matrix:");
console.info("  1. Scenario A: Relay Supply Brownout (Shared 3.3V rail -> 5V intervention)");
console.info("  2. Scenario B: I2C Address Mismatch (0x77 vs 0x76 -> DIP selector intervention)");
console.info("  3. Scenario C: Physical SDA Continuity Fault (Floating SDA -> reseat wire intervention)\n");

const result = spawnSync("bun", ["test", "tests/scenario/mystery-matrix.test.ts", "tests/security/scenario-hidden-state-audit.test.ts"], {
  stdio: "inherit",
});

if (result.status !== 0) {
  console.error("\n❌ MYSTERY MATRIX FAILED: One or more scenario verification pipelines failed.");
  process.exit(result.status ?? 1);
}

console.info("\n==================================================================");
console.info("🎉 ALL 3 MYSTERY SCENARIOS & HIDDEN-STATE AUDITS PASSED CLEANLY!  ");
console.info("==================================================================");
