/**
 * Phase 12 — Resilience & Chaos Test Suite Runner.
 * Executes the complete chaos test suite covering all 14 failure scenarios:
 *
 * 1. Gemini unavailable (503)
 * 2. Gemini 429 rate limit
 * 3. Gemini 500 server error
 * 4. Gemini timeout
 * 5. Malformed response
 * 6. Tool hallucination
 * 7. Device disconnect mid-tool
 * 8. Tool cancellation
 * 9. Approval denied
 * 10. Approval timeout
 * 11. Emergency stop
 * 12. Bad I2C response / NACK
 * 13. Duplicate tool call ID
 * 14. Step limit enforced
 */

import { spawnSync } from "node:child_process";

console.info("==================================================================");
console.info("   OHMNI — PHASE 12: RESILIENCE & CHAOS TEST SUITE GATE           ");
console.info("   All 14 Failure Modes: Network, Model, Tool & Safety Faults     ");
console.info("==================================================================\n");

const result = spawnSync("bun", ["test", "tests/resilience/chaos-suite.test.ts"], {
  stdio: "inherit",
});

if (result.status !== 0) {
  console.error("\n❌ CHAOS SUITE FAILED: One or more resilience scenarios failed.");
  process.exit(result.status ?? 1);
}

console.info("\n==================================================================");
console.info("🎉 ALL 14 RESILIENCE & CHAOS SCENARIOS PASSED WITH ZERO LEAKS!    ");
console.info("==================================================================");
