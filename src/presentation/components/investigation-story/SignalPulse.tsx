/**
 * Signal Pulse Animation Component.
 *
 * Requirements:
 * An electric-blue pulse that travels from the Agent Rail across to the Target Instrument / Hardware
 * when Gemini executes a tool call, and returns with the measured result.
 * Implements real physical travel across the screen using dynamic viewport coordinates.
 */

import React, { useEffect, useState } from "react";
import { motion, useReducedMotion } from "motion/react";

export interface SignalPulseProps {
  readonly isActive: boolean;
  readonly direction?: "agent-to-device" | "device-to-agent";
  readonly color?: string;
  readonly label?: string;
}

export const SignalPulse: React.FC<SignalPulseProps> = ({
  isActive,
  direction = "agent-to-device",
  color = "#45B8FF",
  label,
}) => {
  const [coords, setCoords] = useState<{
    startX: number;
    startY: number;
    endX: number;
    endY: number;
  } | null>(null);
  useEffect(() => {
    if (!isActive) return;

    const updateCoords = () => {
      const agentEl =
        document.querySelector("#lab-agent-rail") ||
        document.querySelector("[data-testid='lab-agent-rail']");
      const targetEl =
        document.querySelector("#lab-main-scene") ||
        document.querySelector("#hardware-illustration") ||
        document.querySelector("[data-testid='hardware-illustration']");

      if (agentEl && targetEl) {
        const agentRect = agentEl.getBoundingClientRect();
        const targetRect = targetEl.getBoundingClientRect();
        setCoords({
          startX: agentRect.left + agentRect.width * 0.4,
          startY: agentRect.top + Math.min(220, agentRect.height * 0.3),
          endX: targetRect.left + targetRect.width * 0.45,
          endY: targetRect.top + targetRect.height * 0.4,
        });
      } else if (typeof window !== "undefined") {
        setCoords({
          startX: window.innerWidth * 0.82,
          startY: window.innerHeight * 0.35,
          endX: window.innerWidth * 0.28,
          endY: window.innerHeight * 0.45,
        });
      }
    };

    updateCoords();
    window.addEventListener("resize", updateCoords);
    return () => window.removeEventListener("resize", updateCoords);
  }, [isActive]);

  if (!isActive) return null;

  const defaultStartX = typeof window !== "undefined" ? window.innerWidth * 0.82 : 1150;
  const defaultStartY = typeof window !== "undefined" ? window.innerHeight * 0.35 : 300;
  const defaultEndX = typeof window !== "undefined" ? window.innerWidth * 0.28 : 380;
  const defaultEndY = typeof window !== "undefined" ? window.innerHeight * 0.45 : 380;

  const fromX = coords
    ? direction === "agent-to-device"
      ? coords.startX
      : coords.endX
    : direction === "agent-to-device"
    ? defaultStartX
    : defaultEndX;

  const fromY = coords
    ? direction === "agent-to-device"
      ? coords.startY
      : coords.endY
    : direction === "agent-to-device"
    ? defaultStartY
    : defaultEndY;

  const toX = coords
    ? direction === "agent-to-device"
      ? coords.endX
      : coords.startX
    : direction === "agent-to-device"
    ? defaultEndX
    : defaultStartX;

  const toY = coords
    ? direction === "agent-to-device"
      ? coords.endY
      : coords.startY
    : direction === "agent-to-device"
    ? defaultEndY
    : defaultStartY;

  return (
    <motion.div
      data-testid="signal-pulse"
      id="signal-pulse"
      initial={{
        x: fromX,
        y: fromY,
        opacity: 0,
        scale: 0.6,
      }}
      animate={{
        x: [fromX, toX],
        y: [fromY, toY],
        opacity: [0, 1, 1, 0.8],
        scale: [0.6, 1.2, 1, 0.8],
      }}
      transition={{
        duration: 1.1,
        repeat: Infinity,
        ease: [0.16, 1, 0.3, 1],
      }}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "16px",
        height: "16px",
        borderRadius: "50%",
        background: color,
        boxShadow: `0 0 20px ${color}, 0 0 40px ${color}`,
        pointerEvents: "none",
        zIndex: 9999,
        willChange: "transform, opacity",
      }}
    />
  );
};
