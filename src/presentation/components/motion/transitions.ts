/**
 * OHMNI Reusable Motion Primitives & Transition Configs
 * Precise technical instrument motion. Every animation communicates an observable state change.
 */

import type { Variants, Transition } from "motion/react";

// Standard Motion Durations (in seconds)
export const MOTION_DURATIONS = {
  micro: 0.15,      // 150ms
  panel: 0.24,      // 240ms
  contextual: 0.38, // 380ms
  toolStagger: 0.09,// 90ms stagger
} as const;

export const MOTION_EASINGS = {
  workbench: [0.16, 1, 0.3, 1] as const, // crisp deceleration
  linear: "linear" as const,
  pulse: [0.4, 0, 0.6, 1] as const,
} as const;

export const panelTransition: Transition = {
  duration: MOTION_DURATIONS.panel,
  ease: MOTION_EASINGS.workbench,
};

export const microTransition: Transition = {
  duration: MOTION_DURATIONS.micro,
  ease: MOTION_EASINGS.workbench,
};

// Panel Enter/Exit Variants
export const panelFadeVariants: Variants = {
  hidden: { opacity: 0, y: 6 },
  visible: {
    opacity: 1,
    y: 0,
    transition: panelTransition,
  },
  exit: {
    opacity: 0,
    y: -4,
    transition: { duration: MOTION_DURATIONS.micro, ease: MOTION_EASINGS.workbench },
  },
};

// WebMCP Staggered Tool Discovery Variants (80-120ms stagger, vertical translation, no bounce)
export const toolContainerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: MOTION_DURATIONS.toolStagger,
      delayChildren: 0.05,
    },
  },
  exit: {
    opacity: 0,
    transition: {
      staggerChildren: 0.04,
      staggerDirection: -1,
      duration: MOTION_DURATIONS.micro,
    },
  },
};

export const toolItemVariants: Variants = {
  hidden: { opacity: 0, y: -6 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: MOTION_DURATIONS.panel,
      ease: MOTION_EASINGS.workbench,
    },
  },
  exit: {
    opacity: 0,
    y: -4,
    transition: {
      duration: MOTION_DURATIONS.micro,
    },
  },
};

// Controlled Fault Flash / Reset Transition for Device Status
export const faultFlashVariants: Variants = {
  nominal: {
    backgroundColor: "rgba(16, 185, 129, 0.12)",
    borderColor: "rgba(16, 185, 129, 0.3)",
    color: "#10b981",
  },
  reset: {
    backgroundColor: "rgba(239, 68, 68, 0.25)",
    borderColor: "rgba(239, 68, 68, 0.8)",
    color: "#ef4444",
    transition: { duration: 0.08 },
  },
  disconnected: {
    backgroundColor: "rgba(100, 116, 139, 0.1)",
    borderColor: "rgba(100, 116, 139, 0.2)",
    color: "#94a3b8",
  },
};

// Metric Change Highlight Variant
export const metricHighlightVariants: Variants = {
  initial: { opacity: 0.8, scale: 0.98 },
  animate: { opacity: 1, scale: 1, transition: { duration: 0.18 } },
};
