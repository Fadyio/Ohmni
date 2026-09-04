/**
 * src/presentation/copy/copy.ts
 *
 * Centralized Copy Dictionary & Canonical Domain Nomenclature.
 * Section 8 & Section 28 of OHMNI Product Design Specification.
 *
 * Rules:
 * 1. USER LANGUAGE first, technical name second.
 * 2. Standardized canonical hardware terms:
 *    - "Independent 5 V supply" (NEVER "Aux Rail", "5V Aux", "External Supply")
 *    - "2.80 V reset threshold" (NEVER "BOD LIMIT", "BOD SAG")
 *    - "Brownout reset" (NEVER "BOD RESET", "brownout fault sag")
 *    - "Controlled load test" (NEVER "Physical Actuation Matrix")
 *    - "Virtual ESP32 reference device"
 * 3. External-agent-first prompt and activity messages.
 */

export const OHMNI_COPY = {
  brand: {
    name: "OHMNI",
    tagline: "Instruments for AI agents in the physical world",
    defaultDeviceName: "Virtual ESP32 reference device",
    physicalDevicePrefix: "USB Serial device",
  },

  workflowStages: ["OBSERVE", "TEST", "DIAGNOSE", "REPAIR", "VERIFY"] as const,

  landing: {
    heroHeadline: "Give your AI agent instruments for the physical world.",
    heroSubline:
      "Ohmni exposes safe hardware measurements and controlled experiments as WebMCP tools, so ChatGPT, Codex, or another compatible agent can operate the hardware workbench directly. The browser keeps physical side effects under your control.",
    proofLine: "WebMCP tools · Human-gated actuation · Web Serial",
    primaryCta: "Open agent-ready workbench",
    secondaryCta: "Connect hardware",
    tertiaryCta: "Try built-in demo →",
    deviceBadge: "Virtual ESP32 reference device",
  },

  externalAgent: {
    railTitle: "YOUR AGENT",
    railSubtitle: "Ready for a WebMCP-capable agent",
    suggestedPromptTitle: "Suggested prompt",
    suggestedPrompt:
      "Investigate why this controller resets when the fan turns on. Use the available instruments. Gather evidence before proposing a cause. Do not perform physical actuation without my approval.",
    copyPromptCta: "Copy prompt",
    copiedPrompt: "Copied to clipboard",
    useBuiltInDemo: "Use built-in demo agent",
    currentActionTitle: "CURRENT ACTION",
    investigationLogTitle: "INVESTIGATION LOG",
    waitingForApproval: "Waiting for approval",
    toolCompleted: "Tool completed",
  },

  readyScene: {
    headline: "Hardware workbench ready",
    subline: "Your agent can now inspect this device using the instruments exposed by Ohmni.",
    quiescentStatus: "3.31 V supply · Relay open · No experiment running",
  },

  observeScene: {
    headline: "Reset history",
    subline: "Diagnostic registers read via read_reset_history.",
    brownoutLabel: "Brownout resets",
    watchdogLabel: "Watchdog resets",
    softwareLabel: "Software crashes",
    interpretation:
      "Recent resets were caused by the power rail falling below the MCU's operating threshold.",
    baselineNotice: "Baseline supply: 3.31 V · 2.80 V reset threshold armed",
  },

  measureScene: {
    headline: "Supply voltage measurement",
    subline: "Direct passive reading from the MCU power rail.",
    nominalLabel: "MCU supply rail",
    statusNormal: "Within expected range (3.3 V nominal)",
  },

  approvalScene: {
    headline: "Your agent wants to run a controlled load test",
    purposeLabel: "Purpose",
    purposeText: "See whether relay activation collapses the MCU supply.",
    whatWillHappenLabel: "What will happen",
    whatWillHappenItems: [
      "Relay energizes briefly",
      "Supply voltage is measured",
      "Test stops immediately if the MCU resets",
    ],
    safetyEnvelopeLabel: "Safety envelope",
    safetyEnvelopeItems: [
      "Maximum actuation: 500 ms",
      "Relay returns open automatically",
    ],
    approveButton: "Approve test",
    denyButton: "Deny",
    technicalToolLabel: "run_relay_stress_test",
  },

  runningScene: {
    runningHeadline: "LOAD TEST RUNNING",
    faultHeadline: "FAULT REPRODUCED",
    relayActive: "ENERGIZED",
    relayOpen: "Safely open",
    resetDetected: "Brownout reset occurred",
    frozenWaveformTitle: "Captured supply collapse",
  },

  evidenceScene: {
    headline: "Evidence collected",
    subline: "Empirical facts recorded by Ohmni during hardware inspection.",
    viewDetails: "View evidence details",
  },

  diagnosisScene: {
    headline: "Working diagnosis",
    primaryDiagnosis: "Relay activation is collapsing the MCU supply rail.",
    confidenceLabel: "Confidence",
    confidenceValue: "High",
    supportedByLabel: "Supported by",
    supportedByItems: [
      "Supply fell to 2.72 V",
      "Brownout reset occurred",
      "Failure reproduced during relay activation",
    ],
    statusLabel: "Status",
    statusValue: "Needs physical verification",
    verifyCta: "Verify with hardware change",
  },

  repairScene: {
    headline: "Your agent needs your hands",
    instruction:
      "Move the relay supply from the shared 3.3 V MCU rail to the independent 5 V supply.",
    statusChanged: "Hardware configuration changed",
    retestRequired: "Retest required to verify repair",
    tellAgentCta: "Tell agent I've changed it",
    jumperCurrentShared: "Shared 3.3 V MCU rail",
    jumperIndependent: "Independent 5 V supply",
  },

  verifyScene: {
    headline: "Verify the repair",
    subline: "Run the same load test again and compare the result.",
    beforeLabel: "BEFORE",
    beforeDetails: "2.72 V · Brownout reset",
    afterLabel: "AFTER",
    afterDetails: "3.18 V · Stable",
  },

  resultScene: {
    headline: "Repair verified",
    agentDiagnosisLabel: "Agent diagnosis",
    agentDiagnosisValue: "Relay-induced supply brownout",
    groundTruthLabel: "Ground truth",
    groundTruthValue: "Relay powered from shared MCU rail",
    matchBadge: "DIAGNOSIS MATCH",
    secondaryStats: "1 human intervention · 2 controlled experiments",
  },

  webmcp: {
    inspectorTitle: "WebMCP Instrument Inspector",
    inspectorSubtitle: "19 instruments registered with document.modelContext",
    footerNotice: "These instruments are available to the agent currently viewing this page.",
    categories: {
      observe: "OBSERVE",
      controlledTest: "CONTROLLED TEST",
      evidence: "EVIDENCE",
      reasoning: "REASONING",
      human: "HUMAN",
    },
  },

  errors: {
    modelUnavailable: {
      title: "Model temporarily unavailable",
      body: "The external agent remains usable. You can also run the deterministic guided demo.",
      retry: "Retry",
      useExternal: "Use external agent",
      useDemo: "Use deterministic demo",
    },
    serialDisconnected: {
      title: "Hardware disconnected",
      body: "Hardware was disconnected. Investigation history and evidence were preserved.",
      reconnect: "Reconnect",
      useVirtual: "Switch to virtual device",
    },
    unsupportedBrowser: {
      title: "Unsupported browser for Web Serial",
      body: "Web Serial requires desktop Chromium. You can continue with the virtual reference device.",
      continueVirtual: "Continue with virtual device",
    },
    toolFailed: {
      title: "Instrument could not complete",
      body: "The requested instrument did not complete. No hardware changes were made.",
      retry: "Retry",
    },
  },
} as const;

export type WorkflowStage = (typeof OHMNI_COPY.workflowStages)[number];
