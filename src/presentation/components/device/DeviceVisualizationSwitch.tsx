/**
 * Descriptor-Driven Hardware Visualization Switcher.
 *
 * Renders:
 * - Authored Interactive SVG PCB (`BoardSilhouette`) when running the known
 *   ESP32 Environmental Controller virtual demo challenge.
 * - Truthful Generic Hardware Inspector (`GenericDeviceVisualization`) when connected
 *   to real physical hardware over Web Serial or non-demo profiles.
 */

import React from "react";
import type { DeviceDescriptor } from "@/domain/device/descriptor";
import { BoardSilhouette } from "./BoardSilhouette";
import { GenericDeviceVisualization } from "./GenericDeviceVisualization";

export interface DeviceVisualizationSwitchProps {
  readonly descriptor?: DeviceDescriptor | null;
  readonly isConnected: boolean;
  readonly relayState: "open" | "closed";
  readonly statusVisual: "nominal" | "reset" | "disconnected";
  readonly diagnosticPhase?: "idle" | "sampling" | "brownout" | "verified";
  readonly railVoltage?: number;
  readonly resetCount?: number;
  readonly jumperPosition?: "3V3" | "5V";
  readonly className?: string;
  readonly activeCapabilityName?: string;
  readonly isActuating?: boolean;
  readonly isVerified?: boolean;
  readonly isBrownout?: boolean;
  readonly isSampling?: boolean;
}

export const DeviceVisualizationSwitch: React.FC<DeviceVisualizationSwitchProps> = ({
  descriptor = null,
  isConnected,
  relayState,
  statusVisual,
  diagnosticPhase,
  railVoltage = 3.31,
  resetCount = 0,
  jumperPosition = "3V3",
  className,
  activeCapabilityName,
  isActuating,
  isVerified,
  isBrownout,
  isSampling,
}) => {
  // When descriptor is omitted or null, default to the authored demo board
  // unless explicitly identified as a generic serial or physical device.
  const isAuthoredDemo =
    !descriptor ||
    descriptor.presentationProfile === "authored_esp32_demo" ||
    descriptor.id === "virtual-esp32s3-env" ||
    descriptor.transport === "Virtual Simulation";
  if (isAuthoredDemo) {
    return (
      <BoardSilhouette
        isConnected={isConnected}
        relayState={relayState}
        statusVisual={statusVisual}
        diagnosticPhase={diagnosticPhase}
        railVoltage={railVoltage}
        jumperPosition={jumperPosition}
        className={className}
      />
    );
  }

  return (
    <GenericDeviceVisualization
      descriptor={descriptor}
      isConnected={isConnected}
      relayState={relayState}
      railVoltage={railVoltage}
      resetCount={resetCount}
      statusVisual={statusVisual}
      activeCapabilityName={activeCapabilityName}
      isActuating={isActuating}
    />
  );
};
