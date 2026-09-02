/**
 * GSAP Transition Hook: Welcome (World 1) -> Lab Mode (World 2).
 * Milestone 7.13 — Visual Rescue: 3D OHMNI Identity + Cohesive Product UI
 *
 * Sequence:
 * 0ms:        User clicks [ Diagnose the demo device ]
 * 0–150ms:    CTA compresses / tactile response
 * 0–250ms:    OHMNI 3D wordmark slightly rotates toward camera & elevates
 * 150–650ms:  Wordmark letters compress horizontally, scales down & travels to top-left navigation
 * 100–450ms:  Hero text fades & translates left
 * 150–700ms:  Hardware visual centers and transitions into Workbench canvas
 * 300–800ms:  Cohesive background transition
 * 500–900ms:  Lab chrome (with navbar brand) appears smoothly
 * 600–1000ms: Agent column slides and settles into 30% right rail
 * 700–1100ms: Board boot sequence triggers
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

      // 0–750ms: 3D Wordmark morph & travel to navbar position
      const wordmarkTarget = wordmarkRef?.current || "#landing-3d-wordmark";
      if (wordmarkTarget) {
        // Step 1: Rotate toward camera & brief initial lift
        tl.to(
          wordmarkTarget,
          {
            scale: 1.05,
            rotationX: 14,
            y: -10,
            duration: 0.22,
            ease: "power2.out",
          },
          0
        );

        // Step 2: Compress and travel to top-left navbar destination
        tl.to(
          wordmarkTarget,
          {
            scale: 0.24,
            x: "-38vw",
            y: "-32vh",
            opacity: 0.3,
            duration: 0.62,
            ease: "power3.inOut",
          },
          0.18
        );
      }

      // 100–450ms: Hero text fades & translates left
      if (heroTextRef.current) {
        tl.to(
          heroTextRef.current,
          {
            opacity: 0,
            x: -40,
            duration: 0.35,
            ease: "power2.inOut",
          },
          0.1
        );
      }

      // 0–600ms: Hardware visual centers and scales into workbench canvas
      const visualTarget = hardwareVisualRef.current || "#hero-hardware-wrapper";
      if (visualTarget) {
        tl.to(
          visualTarget,
          {
            scale: 1.25,
            x: "-12vw",
            duration: 0.6,
            ease: "power3.out",
          },
          0
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

      // 500–900ms: Lab chrome appears
      if (labChromeRef.current) {
        tl.fromTo(
          labChromeRef.current,
          { opacity: 0, y: -20 },
          {
            opacity: 1,
            y: 0,
            duration: 0.4,
            ease: "power2.out",
          },
          0.5
        );
      }

      // 600–1000ms: Agent rail slides/fades in
      if (agentRailRef.current) {
        tl.fromTo(
          agentRailRef.current,
          { opacity: 0, x: 50 },
          {
            opacity: 1,
            x: 0,
            duration: 0.4,
            ease: "power2.out",
          },
          0.6
        );
      }

      // 700–1100ms: Main lab scene settles
      if (labMainSceneRef.current) {
        tl.fromTo(
          labMainSceneRef.current,
          { opacity: 0 },
          {
            opacity: 1,
            duration: 0.4,
            ease: "power2.out",
          },
          0.7
        );
      }

      return tl;
    },
    []
  );

  return { playTransition, isTransitioningRef };
}
