import type React from "react";

export interface SignalPulseProps {
  readonly isActive: boolean;
  readonly direction?: "agent-to-device" | "device-to-agent";
  readonly color?: string;
  readonly label?: string;
}

export const SignalPulse: React.FC<SignalPulseProps> = () => null;
