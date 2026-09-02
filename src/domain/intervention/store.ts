/**
 * Human Intervention Store & Management.
 * Coordinates agent intervention requests, human physical manipulations,
 * immutable human evidence ingestion, and agent continuation prompting.
 */

import type { DeviceAdapter } from "../device/adapter";
import type { EvidenceStore } from "../evidence/store";
import type { EvidenceRecord } from "../evidence/types";
import type {
  HumanInterventionRequest,
  HumanObservationRecord,
  InterventionPoint,
} from "./types";

export const DEFAULT_INTERVENTION_POINTS: readonly InterventionPoint[] = [
  {
    id: "relay_power_jumper",
    label: "Relay Power Source (JP1)",
    description: "Configures whether the cooling fan relay coil is powered from the shared 3.3V MCU rail or an isolated 5V external rail.",
    possibleStates: [
      { value: "3v3", label: "3.3V (Shared MCU Rail)", description: "Draws coil inrush current from 3.3V power rail." },
      { value: "5v", label: "5.0V (Isolated Ext Rail)", description: "Powers coil from isolated 5V supply rail." },
    ],
    currentState: "3v3",
    visualAnchor: "jp1_relay_power",
  },
  {
    id: "sensor_address_selector",
    label: "Sensor I2C Address (SW1)",
    description: "Configures the 7-bit I2C bus address of the environmental sensor between 0x76 and 0x77 via SDO strapping.",
    possibleStates: [
      { value: "0x76", label: "0x76 (SDO Low)", description: "Standard default firmware target address." },
      { value: "0x77", label: "0x77 (SDO High)", description: "Alternate hardware address." },
    ],
    currentState: "0x76",
    visualAnchor: "sw1_sensor_address",
  },
  {
    id: "sda_connection",
    label: "I2C SDA Connector Header (J2)",
    description: "Physical jumper wire connecting MCU GPIO 8 (SDA) to the environmental sensor breakout.",
    possibleStates: [
      { value: "unseated", label: "Unseated / Disconnected", description: "Connector pin loose / floating bus." },
      { value: "connected", label: "Connected / Seated", description: "Secure physical contact on GPIO 8." },
    ],
    currentState: "connected",
    visualAnchor: "j2_sda_header",
  },
];

export class InterventionStore {
  private readonly points = new Map<string, InterventionPoint>();
  private activeRequest: HumanInterventionRequest | null = null;
  private readonly listeners = new Set<() => void>();
  private readonly history: HumanObservationRecord[] = [];

  constructor(initialPoints: readonly InterventionPoint[] = DEFAULT_INTERVENTION_POINTS) {
    for (const point of initialPoints) {
      this.points.set(point.id, { ...point });
    }
  }

  public getPoints(): readonly InterventionPoint[] {
    return Array.from(this.points.values());
  }

  public getPoint(id: string): InterventionPoint | undefined {
    return this.points.get(id);
  }

  public getActiveRequest(): HumanInterventionRequest | null {
    return this.activeRequest;
  }

  public setActiveRequest(request: HumanInterventionRequest | null): void {
    this.activeRequest = request;
    this.notify();
  }

  public getHistory(): readonly HumanObservationRecord[] {
    return this.history;
  }

  public setPointState(id: string, state: string): void {
    const point = this.points.get(id);
    if (point) {
      this.points.set(id, { ...point, currentState: state });
      this.notify();
    }
  }

  /**
   * Applies a human physical intervention:
   * 1. Updates local point state
   * 2. Updates physical/virtual DeviceAdapter
   * 3. Appends an immutable EvidenceRecord with source: "human"
   * 4. Clears the active request
   */
  public applyIntervention(
    target: string,
    newState: string,
    options?: {
      adapter?: DeviceAdapter;
      evidenceStore?: EvidenceStore;
    }
  ): { observation: HumanObservationRecord; evidence?: EvidenceRecord } {
    const point = this.points.get(target);
    const previousState = point?.currentState ?? "unknown";
    const label = point?.label ?? target;

    // Update store state
    if (point) {
      this.points.set(target, { ...point, currentState: newState });
    }

    // Update hardware adapter
    if (options?.adapter && typeof options.adapter.setInterventionPoint === "function") {
      options.adapter.setInterventionPoint(target, newState);
    }

    const summary = `Human physical intervention on ${label}: Changed state from "${previousState}" to "${newState}".`;
    const observation: HumanObservationRecord = {
      interventionPointId: target,
      previousState,
      newState,
      summary,
      timestamp: Date.now(),
    };

    this.history.push(observation);
    this.activeRequest = null;

    let evidence: EvidenceRecord | undefined;
    if (options?.evidenceStore) {
      evidence = options.evidenceStore.createAndAdd({
        type: "human_observation",
        summary,
        source: "human",
        provenance: {
          origin: "human",
          interventionPoint: target,
          previousState,
          newState,
        },
        data: {
          target,
          previousState,
          newState,
          label,
        },
      });
    }

    this.notify();
    return { observation, evidence };
  }

  public createContinuationPrompt(observation: HumanObservationRecord): string {
    return `Human completed physical intervention: ${observation.summary}

A reported physical intervention is not proof that the fault is fixed. Use available diagnostic instruments to verify the repair experimentally before marking any hypothesis confirmed.`;
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }
}
