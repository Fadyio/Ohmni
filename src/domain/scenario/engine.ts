/**
 * Mystery Scenario Engine.
 * Master Milestone 8 — Sealed Ground Truth & Random / Seeded Scenario Execution.
 */

import {
  ALL_SCENARIO_IDS,
  ENABLED_SCENARIO_IDS,
  SCENARIOS,
} from "./definitions";
import type {
  ScenarioDefinition,
  ScenarioGroundTruth,
  ScenarioId,
  ScenarioInterventionPoint,
  ScenarioSession,
  ScenarioVerificationCriteria,
} from "./types";
import type { VirtualDeviceConfig } from "../device/virtual-adapter";

export interface CreateScenarioOptions {
  readonly scenarioId?: ScenarioId;
  readonly seed?: number | string;
}

class ScenarioSessionImpl implements ScenarioSession {
  private readonly definition: ScenarioDefinition;
  public readonly sessionId: string;
  public readonly scenarioId: ScenarioId;
  public readonly publicSymptom: string;
  public readonly deviceModel: string;
  public readonly allowedInterventionPoints: readonly ScenarioInterventionPoint[];

  private _isSealed = true;
  private _isVerified = false;
  private _revealedAt?: number;

  constructor(definition: ScenarioDefinition, sessionId?: string) {
    this.definition = definition;
    this.scenarioId = definition.id;
    this.publicSymptom = definition.publicSymptom;
    this.deviceModel = definition.deviceModel;
    this.allowedInterventionPoints = definition.allowedInterventionPoints;
    this.sessionId =
      sessionId ??
      `MS-${Math.random().toString(36).slice(2, 6).toUpperCase()}-${Date.now().toString(36).slice(-4).toUpperCase()}`;
  }

  public get isSealed(): boolean {
    return this._isSealed;
  }

  public get isVerified(): boolean {
    return this._isVerified;
  }

  public get revealedAt(): number | undefined {
    return this._revealedAt;
  }

  public markVerified(): void {
    this._isVerified = true;
  }

  public revealGroundTruth(options?: { allowIncomplete?: boolean }): ScenarioGroundTruth {
    if (!this._isVerified && !options?.allowIncomplete) {
      throw new Error(
        "Cannot reveal sealed scenario ground truth before verification without explicit allowIncomplete authorization."
      );
    }

    this._isSealed = false;
    this._revealedAt = Date.now();
    return this.definition.groundTruth;
  }

  public getVerificationCriteria(): ScenarioVerificationCriteria {
    return this.definition.verificationCriteria;
  }

  public getInitialDeviceConfig(): VirtualDeviceConfig {
    return this.definition.initialDeviceConfig;
  }
}

/**
 * Deterministically pick an index given a string or number seed.
 */
function pickWithSeed(seed: number | string, arrayLength: number): number {
  let hash = 0;
  const seedStr = String(seed);
  for (let i = 0; i < seedStr.length; i++) {
    hash = (hash << 5) - hash + seedStr.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) % arrayLength;
}

/**
 * Cryptographically random pick from an array.
 */
function pickRandom(arrayLength: number): number {
  const buffer = new Uint32Array(1);
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    crypto.getRandomValues(buffer);
    return buffer[0] % arrayLength;
  }
  return Math.floor(Math.random() * arrayLength);
}

export function createScenarioSession(options: CreateScenarioOptions = {}): ScenarioSession {
  let scenarioId = options.scenarioId;

  if (!scenarioId) {
    const candidates = ENABLED_SCENARIO_IDS.length > 0 ? ENABLED_SCENARIO_IDS : ALL_SCENARIO_IDS;
    if (options.seed !== undefined) {
      const index = pickWithSeed(options.seed, candidates.length);
      scenarioId = candidates[index];
    } else {
      const index = pickRandom(candidates.length);
      scenarioId = candidates[index];
    }
  }

  const definition = SCENARIOS[scenarioId];
  if (!definition) {
    throw new Error(`Unknown scenario id: ${scenarioId}`);
  }

  return new ScenarioSessionImpl(definition);
}

export function startMysteryScenario(options: CreateScenarioOptions = {}): ScenarioSession {
  return createScenarioSession(options);
}

export interface DiagnosisMatchResult {
  readonly isMatch: boolean;
  readonly matchedTags: readonly string[];
  readonly score: number;
  readonly reason: string;
}

/**
 * Deterministically evaluates whether an agent diagnosis matches ground truth
 * using root cause category and expected causal tags without LLM self-grading.
 */
export function matchDiagnosis(
  groundTruth: ScenarioGroundTruth,
  hypothesisTitle: string,
  hypothesisDescription: string,
  rootCauseCategory?: string
): DiagnosisMatchResult {
  const combinedText = `${hypothesisTitle} ${hypothesisDescription}`.toLowerCase();
  const matchedTags: string[] = [];

  for (const tag of groundTruth.expectedRootCauseTags) {
    const normalizedTag = tag.replace(/_/g, " ").toLowerCase();
    if (combinedText.includes(normalizedTag) || combinedText.includes(tag.toLowerCase())) {
      matchedTags.push(tag);
    }
  }

  const categoryMatch =
    rootCauseCategory !== undefined &&
    rootCauseCategory.toLowerCase() === groundTruth.rootCauseCategory.toLowerCase();

  const isMatch = categoryMatch || matchedTags.length >= 1;
  const score = Math.min(1.0, (matchedTags.length * 0.4) + (categoryMatch ? 0.6 : 0.2));

  return {
    isMatch,
    matchedTags,
    score,
    reason: isMatch
      ? "Agent diagnosis accurately confirmed the device-level root cause."
      : "Agent diagnosis did not match the hidden root cause.",
  };
}
