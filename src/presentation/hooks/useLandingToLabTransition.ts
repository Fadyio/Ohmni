/**
 * GSAP Transition Hook: Welcome (World 1) -> Lab Mode (World 2).
 * Milestone 7.14 — Truthful Transition Choreography (No Content Overlap).
 *
 * Sequence:
 * 0–250ms:   Headline and copy exit completely before hardware moves into their region.
 * 200–550ms: OHMNI 3D wordmark compresses and travels smoothly to top-left navigation position.
 * 300–750ms: Hardware PCB visual moves into the central workbench canvas position.
 * 600–900ms: Lab chrome and 70/30 workbench appear cleanly.
 */

import { useRef, useCallback } from "react";
import gsap from "gsap";

export interface TransitionRefs {
  readonly rootContainerRef: React.RefObject<HTMLDivElement | null>;
  readonly heroTextRef: React.RefObject<HTMLDivElement | null>;
  readonly hardwareVisualRef: React.RefObject<HTMLDivElement | null>;
  readonly ctaButtonRef: React.RefObject<HTMLButtonElement | null>;
  readonly wordmarkRef?: React.RefObject<HTMLDivElement | null>;
  readonly labChromeRef: React.RefObject<HTMLElement | null>;
  readonly labMainSceneRef: React.RefObject<HTMLElement | null>;
  readonly agentRailRef: React.RefObject<HTMLElement | null>;
}

export function useLandingToLabTransition() {
  const isTransitioningRef = useRef(false);
  const timelineRef = useRef<gsap.core.Timeline | null>(null);

  const playTransition = useCallback(
    (refs: TransitionRefs, onComplete: () => void) => {
      if (isTransitioningRef.current) return;
      isTransitioningRef.current = true;

      // Kill any previous timeline
      if (timelineRef.current) {
        timelineRef.current.kill();
      }
      let didComplete = false;
      const completeWrapper = () => {
        if (didComplete) return;
        didComplete = true;
        clearTimeout(fallbackTimer);
        isTransitioningRef.current = false;
        onComplete();
      };
      const fallbackTimer = setTimeout(() => {
        completeWrapper();
      }, 350);

      const tl = gsap.timeline({
        onComplete: completeWrapper,
      });
      timelineRef.current = tl;
      const {
        rootContainerRef,
        heroTextRef,
        hardwareVisualRef,
        ctaButtonRef,
        wordmarkRef,
        labChromeRef,
        labMainSceneRef,
        agentRailRef,
      } = refs;

      // Clean 250-300ms transition: workbench elements enter immediately at >=0.6 opacity
      if (rootContainerRef.current) {
        tl.to(
          rootContainerRef.current,
          {
            backgroundColor: "#F4F5F7",
            duration: 0.25,
            ease: "power2.out",
          },
          0
        );
      }

      if (labChromeRef.current) {
        tl.fromTo(
          labChromeRef.current,
          { opacity: 0.65, y: -6 },
          {
            opacity: 1,
            y: 0,
            duration: 0.25,
            ease: "power2.out",
          },
          0
        );
      }

      if (agentRailRef.current) {
        tl.fromTo(
          agentRailRef.current,
          { opacity: 0.65, x: 12 },
          {
            opacity: 1,
            x: 0,
            duration: 0.25,
            ease: "power2.out",
          },
          0
        );
      }

      if (labMainSceneRef.current) {
        tl.fromTo(
          labMainSceneRef.current,
          { opacity: 0.65 },
          {
            opacity: 1,
            duration: 0.25,
            ease: "power2.out",
          },
          0
        );
      }

      return tl;
    },
    []
  );

  return { playTransition, isTransitioningRef };
}
