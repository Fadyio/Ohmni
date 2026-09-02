/**
 * GSAP Transition Hook: Welcome (World 1) -> Lab Mode (World 2).
 *
 * Sequence:
 * 0ms:      User clicks Diagnose
 * 0–150ms:  CTA compresses / tactile response
 * 100–400ms: Hero text fades & translates left
 * 150–650ms: Hardware visual scales 1.0 -> 1.4 and moves toward center
 * 300–850ms: Page background interpolates light (#F7F7F5) -> dark (#090B10)
 * 500–900ms: Lab chrome appears
 * 650–1000ms: Agent rail slides/fades in
 * 750–1100ms: Device status performs boot sequence
 */

import { useRef, useCallback } from "react";
import gsap from "gsap";

export interface TransitionRefs {
  readonly rootContainerRef: React.RefObject<HTMLDivElement | null>;
  readonly heroTextRef: React.RefObject<HTMLDivElement | null>;
  readonly hardwareVisualRef: React.RefObject<HTMLDivElement | null>;
  readonly ctaButtonRef: React.RefObject<HTMLButtonElement | null>;
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

      const tl = gsap.timeline({
        defaults: { ease: "power2.out" },
        onComplete: () => {
          isTransitioningRef.current = false;
          onComplete();
        },
      });
      timelineRef.current = tl;

      const {
        rootContainerRef,
        heroTextRef,
        hardwareVisualRef,
        ctaButtonRef,
        labChromeRef,
        labMainSceneRef,
        agentRailRef,
      } = refs;

      // 0–150ms: CTA tactile compression
      if (ctaButtonRef.current) {
        tl.to(
          ctaButtonRef.current,
          {
            scale: 0.94,
            duration: 0.15,
            ease: "power1.inOut",
          },
          0
        );
      }

      // 100–400ms: Hero text fades & translates left
      if (heroTextRef.current) {
        tl.to(
          heroTextRef.current,
          {
            opacity: 0,
            x: -40,
            duration: 0.3,
            ease: "power2.in",
          },
          0.1
        );
      }

      // 50–650ms: Hardware visual scales 1.0 -> 1.4 and moves toward center
      if (hardwareVisualRef.current) {
        tl.to(
          hardwareVisualRef.current,
          {
            scale: 1.4,
            x: -60,
            y: 20,
            duration: 0.55,
            ease: "power2.inOut",
          },
          0.05
        );
      }

      // 300–850ms: Page background interpolates light -> dark
      if (rootContainerRef.current) {
        tl.to(
          rootContainerRef.current,
          {
            backgroundColor: "#090B10",
            duration: 0.55,
            ease: "power2.inOut",
          },
          0.3
        );
      }

      // 500–900ms: Lab chrome appears
      if (labChromeRef.current) {
        tl.fromTo(
          labChromeRef.current,
          { opacity: 0, y: -20 },
          { opacity: 1, y: 0, duration: 0.4, ease: "power2.out" },
          0.5
        );
      }

      // 650–1000ms: Agent rail slides/fades in
      if (agentRailRef.current) {
        tl.fromTo(
          agentRailRef.current,
          { opacity: 0, x: 50 },
          { opacity: 1, x: 0, duration: 0.35, ease: "power2.out" },
          0.65
        );
      }

      // 750–1100ms: Main lab scene settles
      if (labMainSceneRef.current) {
        tl.fromTo(
          labMainSceneRef.current,
          { opacity: 0, scale: 0.96 },
          { opacity: 1, scale: 1, duration: 0.35, ease: "power2.out" },
          0.75
        );
      }

      return tl;
    },
    []
  );

  return { playTransition, isTransitioningRef };
}
