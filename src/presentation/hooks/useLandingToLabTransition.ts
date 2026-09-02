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

      const tl = gsap.timeline({
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
        wordmarkRef,
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
            ease: "power2.inOut",
          },
          0
        );
      }

      // Step 1: 0–250ms: Headline & copy exits BEFORE hardware crosses region
      if (heroTextRef.current) {
        tl.to(
          heroTextRef.current,
          {
            opacity: 0,
            x: -35,
            duration: 0.25,
            ease: "power2.inOut",
          },
          0
        );
      }

      // Step 2: 200–550ms: 3D Wordmark shrinks and travels to navbar brand position
      const wordmarkTarget = wordmarkRef?.current || "#landing-3d-wordmark";
      if (wordmarkTarget) {
        tl.to(
          wordmarkTarget,
          {
            scale: 0.26,
            x: "-38vw",
            y: "-33vh",
            opacity: 0.4,
            duration: 0.35,
            ease: "power3.inOut",
          },
          0.2
        );
      }

      // Step 3: 300–750ms: Hardware moves toward lab position
      const visualTarget = hardwareVisualRef.current || "#hero-hardware-wrapper";
      if (visualTarget) {
        tl.to(
          visualTarget,
          {
            scale: 1.15,
            x: "-10vw",
            duration: 0.45,
            ease: "power3.out",
          },
          0.3
        );
      }

      // 300–800ms: Cohesive light background interpolation
      if (rootContainerRef.current) {
        tl.to(
          rootContainerRef.current,
          {
            backgroundColor: "#F4F5F7",
            duration: 0.5,
            ease: "power2.out",
          },
          0.3
        );
      }

      // Step 4: 600–900ms: Lab appears
      if (labChromeRef.current) {
        tl.fromTo(
          labChromeRef.current,
          { opacity: 0, y: -15 },
          {
            opacity: 1,
            y: 0,
            duration: 0.3,
            ease: "power2.out",
          },
          0.6
        );
      }

      if (agentRailRef.current) {
        tl.fromTo(
          agentRailRef.current,
          { opacity: 0, x: 40 },
          {
            opacity: 1,
            x: 0,
            duration: 0.3,
            ease: "power2.out",
          },
          0.65
        );
      }

      if (labMainSceneRef.current) {
        tl.fromTo(
          labMainSceneRef.current,
          { opacity: 0 },
          {
            opacity: 1,
            duration: 0.3,
            ease: "power2.out",
          },
          0.65
        );
      }

      return tl;
    },
    []
  );

  return { playTransition, isTransitioningRef };
}
