/**
 * Hook to capture chronological semantic events and experiment state from TelemetryEventBus.
 */

import { useState, useEffect, useRef } from "react";
import type { ITelemetryEventBus } from "@/domain/telemetry/bus";
import type { DeviceEvent, ResetReason } from "@/domain/device/events";
import type { ExperimentStatus, ExperimentSummary, VoltageSummary } from "@/domain/experiment/types";

export interface TimelineEventItem {
  readonly id: string;
  readonly timestamp: number;
  readonly relativeMs: number;
  readonly title: string;
  readonly type: "start" | "relay" | "threshold" | "brownout" | "reset" | "complete" | "abort";
  readonly details?: string;
  readonly isFault?: boolean;
}

export interface WebMCPCallInfo {
  readonly toolName: string;
  readonly experimentId: string;
  readonly durationMs: number;
  readonly status: ExperimentStatus;
  readonly summary?: ExperimentSummary;
}

export interface ExperimentTimelineState {
  readonly activeExperimentId: string | null;
  readonly experimentStatus: ExperimentStatus | "idle";
  readonly events: readonly TimelineEventItem[];
  readonly lastCallInfo: WebMCPCallInfo | null;
  readonly voltageSummary: VoltageSummary | null;
  readonly requestedCycles: number;
  readonly completedCycles: number;
  readonly faultReproduced: boolean;
  readonly resetOccurred: boolean;
  readonly resetReason: ResetReason | null;
  readonly clearTimeline: () => void;
  readonly recordWebMCPStart: (toolName: string, expId: string, cycles: number) => void;
  readonly recordWebMCPComplete: (summary: ExperimentSummary, durationMs: number) => void;
}

export function useExperimentTimeline(eventBus?: ITelemetryEventBus): ExperimentTimelineState {
  const [activeExperimentId, setActiveExperimentId] = useState<string | null>(null);
  const [experimentStatus, setExperimentStatus] = useState<ExperimentStatus | "idle">("idle");
  const [events, setEvents] = useState<TimelineEventItem[]>([]);
  const [lastCallInfo, setLastCallInfo] = useState<WebMCPCallInfo | null>(null);
  const [voltageSummary, setVoltageSummary] = useState<VoltageSummary | null>(null);
  const [requestedCycles, setRequestedCycles] = useState<number>(3);
  const [completedCycles, setCompletedCycles] = useState<number>(0);
  const [faultReproduced, setFaultReproduced] = useState<boolean>(false);
  const [resetOccurred, setResetOccurred] = useState<boolean>(false);
  const [resetReason, setResetReason] = useState<ResetReason | null>(null);

  const experimentStartRef = useRef<number | null>(null);
  const thresholdLoggedRef = useRef<boolean>(false);
  const minVoltageRef = useRef<number>(3.31);

  const clearTimeline = () => {
    setEvents([]);
    setLastCallInfo(null);
    setVoltageSummary(null);
    setExperimentStatus("idle");
    setActiveExperimentId(null);
    setCompletedCycles(0);
    setFaultReproduced(false);
    setResetOccurred(false);
    setResetReason(null);
    experimentStartRef.current = null;
    thresholdLoggedRef.current = false;
    minVoltageRef.current = 3.31;
  };

  const recordWebMCPStart = (toolName: string, expId: string, cycles: number) => {
    const now = Date.now();
    experimentStartRef.current = now;
    thresholdLoggedRef.current = false;
    minVoltageRef.current = 3.31;

    setActiveExperimentId(expId);
    setExperimentStatus("running");
    setRequestedCycles(cycles);
    setCompletedCycles(0);
    setFaultReproduced(false);
    setResetOccurred(false);
    setResetReason(null);
    setVoltageSummary(null);

    const startEvent: TimelineEventItem = {
      id: `evt_${now}_start`,
      timestamp: now,
      relativeMs: 0,
      title: "Experiment started",
      type: "start",
      details: `${toolName} (${expId})`,
    };

    setEvents([startEvent]);
  };

  const recordWebMCPComplete = (summary: ExperimentSummary, durationMs: number) => {
    const now = Date.now();
    const start = experimentStartRef.current ?? now;
    const relMs = Math.max(0, now - start);

    setExperimentStatus(summary.status);
    setLastCallInfo({
      toolName: summary.test || "run_relay_stress_test",
      experimentId: summary.experiment_id,
      durationMs,
      status: summary.status,
      summary,
    });

    if (summary.supply_voltage) {
      setVoltageSummary(summary.supply_voltage);
    }

    if (typeof summary.cyclesCompleted === "number") {
      setCompletedCycles(summary.cyclesCompleted);
    }

    if (summary.faultReproduced || summary.resetOccurred) {
      setFaultReproduced(true);
      setResetOccurred(true);
      setResetReason((summary.resetReason as ResetReason) || "BROWNOUT");
    }

    const completeEvent: TimelineEventItem = {
      id: `evt_${now}_complete`,
      timestamp: now,
      relativeMs: relMs,
      title: summary.status === "completed" ? "Experiment completed" : `Experiment ${summary.status}`,
      type: summary.status === "aborted" ? "abort" : "complete",
      details: summary.message as string | undefined,
      isFault: Boolean(summary.faultReproduced),
    };

    setEvents((prev) => [...prev, completeEvent]);
  };

  useEffect(() => {
    if (!eventBus) return;

    const unsubscribe = eventBus.subscribe((event: DeviceEvent, expId?: string) => {
      const now = Date.now();
      if (expId) {
        if (experimentStartRef.current === null) {
          experimentStartRef.current = now;
          setActiveExperimentId(expId);
          setExperimentStatus("running");
        }
      }
      const start = experimentStartRef.current ?? now;
      const relMs = Math.max(0, now - start);
      if (event.type === "voltage_sample") {
        if (event.voltage < minVoltageRef.current) {
          minVoltageRef.current = event.voltage;
        }

        // Detect safe limit crossing (2.80V)
        if (event.voltage < 2.80 && !thresholdLoggedRef.current) {
          thresholdLoggedRef.current = true;
          const thresholdEvent: TimelineEventItem = {
            id: `evt_${now}_threshold`,
            timestamp: now,
            relativeMs: relMs,
            title: `Supply crossed 2.80 V (${event.voltage.toFixed(2)} V)`,
            type: "threshold",
            isFault: true,
          };
          const brownoutEvent: TimelineEventItem = {
            id: `evt_${now}_brownout`,
            timestamp: now + 4,
            relativeMs: relMs + 4,
            title: "Brownout detected",
            type: "brownout",
            isFault: true,
          };
          setEvents((prev) => [...prev, thresholdEvent, brownoutEvent]);
        }
      } else if (event.type === "relay_state") {
        if (event.state === "closed") {
          setExperimentStatus("running");
        } else if (event.state === "open") {
          setExperimentStatus("idle");
          experimentStartRef.current = null;
        }
        const relayEvent: TimelineEventItem = {
          id: `evt_${now}_relay`,
          timestamp: now,
          relativeMs: relMs,
          title: `Relay ${event.state.toUpperCase()}`,
          type: "relay",
          details: `Pin ${event.pin}`,
        };
        setEvents((prev) => [...prev, relayEvent]);
      } else if (event.type === "reset") {
        setExperimentStatus("idle");
        experimentStartRef.current = null;
        const resetEvent: TimelineEventItem = {
          id: `evt_${now}_reset`,
          timestamp: now,
          relativeMs: relMs,
          title: `Device reset (${event.reason})`,
          type: "reset",
          isFault: true,
          details: `Reset cause: ${event.reason}`,
        };
        setResetOccurred(true);
        setResetReason(event.reason);
        setFaultReproduced(event.reason === "BROWNOUT");
        setEvents((prev) => [...prev, resetEvent]);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [eventBus]);

  return {
    activeExperimentId,
    experimentStatus,
    events,
    lastCallInfo,
    voltageSummary,
    requestedCycles,
    completedCycles,
    faultReproduced,
    resetOccurred,
    resetReason,
    clearTimeline,
    recordWebMCPStart,
    recordWebMCPComplete,
  };
}
