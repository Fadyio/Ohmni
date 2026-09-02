# 0003. Immutable Auto-Logged Evidence Ledger and Agent-Driven Hypothesis Synthesis

Date: 2026-09-02

## Status

Accepted

## Context

A hardware diagnostic workbench must maintain rigorous scientific credibility. If the AI agent is allowed to fabricate or edit raw measurement facts, the investigation becomes untrustworthy. Conversely, if a client-side rule engine pre-determines hypotheses from simulator internals or displays fake numerical probabilities (e.g. "Power problem 87.4%"), the AI's actual reasoning leverage is hollowed out.

## Decision

We will implement a **Hybrid Investigation Architecture** enforcing a strict boundary between objective empirical facts and subjective diagnostic interpretation:

1. **Immutable, Auto-Logged Evidence Records (`E-xxx`):** Every diagnostic tool execution (`ExperimentRunner`) automatically produces immutable evidence records containing the observed measurement facts (e.g. minimum voltage, reset cause, delay timings). Neither human nor agent can edit or delete these facts.
2. **First-Class Human Observations:** Physical observations reported by the user (e.g. "Relay is wired to 3.3V rail") are ingested into the ledger as first-class `EvidenceRecord` items with `provenance: "human"`.
3. **Agent-Authored Hypotheses (`H-xxx`):** The agent creates, links, supports, contradicts, and rejects hypotheses using dedicated WebMCP synthesis tools (`propose_hypothesis`, `update_hypothesis`, `link_evidence`, `request_human_intervention`, `record_conclusion`).
4. **Qualitative Confidence Tiers:** Confidence is expressed through qualitative stages (`UNTESTED`, `LOW`, `MEDIUM`, `HIGH`, `VERY_HIGH`, `REJECTED`, `CONFIRMED`). Updating confidence requires explicit citations to supporting/contradicting evidence IDs.
5. **No Simulator Leakage:** The application never pre-populates hypotheses from hidden simulator fault knowledge. Hypotheses emerge purely through agent analysis of collected evidence.

```text
  DEVICE / SIMULATOR
         │
         ▼
  DIAGNOSTIC TOOL
         │
         ├──────────────► Immutable Evidence Ledger (E-xxx)
         │                    (Factual Observations)
         │
         ▼
  AGENT receives structured result
         │
         ▼
  Investigation WebMCP Tools (propose_hypothesis, link_evidence...)
         │
         ▼
  Active Hypotheses Board (H-xxx)
```

## Consequences

### Positive
- **Scientific Rigor:** Measurements are untamperable; reasoning is traceable through explicit evidence-link citations.
- **Visual Clarity:** The UI can dynamically animate evidence linking and confidence transitions (e.g. `MEDIUM → HIGH` with supporting evidence tags).
- **WebMCP Leverage:** WebMCP tool surface includes both physical instruments and scientific investigation tools.

### Negative / Tradeoffs
- Requires the agent to make occasional synthesis calls (`propose_hypothesis`, `link_evidence`) alongside diagnostic runs to keep the visual board synchronized.
