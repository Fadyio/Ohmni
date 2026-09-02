/**
 * OHMNI 3D Wordmark Component
 * Milestone 7.13 — Visual Rescue: 3D OHMNI Identity
 *
 * Requirements:
 * - Real CSS 3D typographic brand object (NOT a flat static SVG / image).
 * - Individual letter DOM elements: O, H, M, N, I.
 * - Structure:
 *     <div className="ohmni-3d-scene">
 *       <div className="ohmni-3d-word">
 *         <span>O</span>
 *         <span>H</span>
 *         <span>M</span>
 *         <span>N</span>
 *         <span>I</span>
 *       </div>
 *     </div>
 * - CSS: perspective, transform-style: preserve-3d, translateZ, rotateX, rotateY.
 * - Machined aluminum + precision instrument aesthetic:
 *     Front face: #111318
 *     Extrusion: deep navy / indigo layers (#131926, #0D121D)
 *     Highlight edge: #5570FF (subtle reflective blue highlight)
 * - Intro animation:
 *     0ms: translateZ(-180px) rotateX(35deg) opacity 0
 *     0–700ms: translateZ(0) rotateX(0) opacity 1, staggered ~50-70ms
 *     Settling blue light sweep across face (~900ms total)
 * - Idle micro-parallax:
 *     Pointer tracking: rotateY ±4deg, rotateX ±2deg max with smooth spring
 *     Returns to neutral on pointer leave
 * - Supports variant="hero" (landing ~120–170px tall) and variant="compact" (navbar brand).
 */

import React, { useRef, useEffect, useState, useCallback } from "react";
import { motion, useReducedMotion } from "motion/react";

export interface Ohmni3DWordmarkProps {
  readonly variant?: "hero" | "compact";
  readonly className?: string;
  readonly style?: React.CSSProperties;
  readonly onAnimationComplete?: () => void;
  readonly interactive?: boolean;
}

const LETTERS = ["O", "H", "M", "N", "I"] as const;

export const Ohmni3DWordmark: React.FC<Ohmni3DWordmarkProps> = ({
  variant = "hero",
  className = "",
  style,
  onAnimationComplete,
  interactive = true,
}) => {
  const isHero = variant === "hero";
  const shouldReduceMotion = useReducedMotion();
  const sceneRef = useRef<HTMLDivElement | null>(null);
  const wordRef = useRef<HTMLDivElement | null>(null);

  // Parallax rotation state
  const [rotX, setRotX] = useState<number>(0);
  const [rotY, setRotY] = useState<number>(0);
  const [isHovered, setIsHovered] = useState<boolean>(false);
  const [lightSweepActive, setLightSweepActive] = useState<boolean>(true);

  // Micro-parallax handler (±2deg X, ±4deg Y)
  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!interactive || shouldReduceMotion) return;
      const el = sceneRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const normX = (e.clientX - centerX) / (rect.width / 2);
      const normY = (e.clientY - centerY) / (rect.height / 2);

      // Clamped micro-parallax
      const clampedX = Math.max(-1, Math.min(1, normX));
      const clampedY = Math.max(-1, Math.min(1, normY));

      setRotY(clampedX * (isHero ? 4.0 : 2.5));
      setRotX(-clampedY * (isHero ? 2.2 : 1.5));
    },
    [interactive, shouldReduceMotion, isHero]
  );

  const handlePointerLeave = useCallback(() => {
    setRotX(0);
    setRotY(0);
    setIsHovered(false);
  }, []);

  const handlePointerEnter = useCallback(() => {
    setIsHovered(true);
    // Trigger subtle light sweep on hover if enough time elapsed
    setLightSweepActive(true);
  }, []);

  // Deactivate light sweep after intro duration
  useEffect(() => {
    const timer = setTimeout(() => {
      setLightSweepActive(false);
      onAnimationComplete?.();
    }, 1200);
    return () => clearTimeout(timer);
  }, [onAnimationComplete]);

  return (
    <div
      ref={sceneRef}
      data-testid="ohmni-3d-wordmark"
      className={`ohmni-3d-scene ${isHero ? "ohmni-3d-scene--hero" : "ohmni-3d-scene--compact"} ${className}`}
      onPointerMove={handlePointerMove}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
      style={{
        perspective: isHero ? "1200px" : "800px",
        perspectiveOrigin: "50% 50%",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: isHero ? "center" : "flex-start",
        position: "relative",
        userSelect: "none",
        cursor: interactive ? "default" : "inherit",
        ...style,
      }}
    >
      <motion.div
        ref={wordRef}
        className="ohmni-3d-word"
        layoutId={isHero ? "ohmni-brand-hero" : undefined}
        animate={{
          rotateX: rotX,
          rotateY: rotY,
          scale: isHovered && isHero ? 1.015 : 1.0,
        }}
        transition={{
          type: "spring",
          stiffness: 140,
          damping: 22,
          mass: 0.6,
        }}
        style={{
          display: "inline-flex",
          alignItems: "center",
          transformStyle: "preserve-3d",
          position: "relative",
          letterSpacing: isHero ? "0.06em" : "0.05em",
          fontWeight: 900,
          lineHeight: 1,
        }}
      >
        {LETTERS.map((letter, idx) => {
          const delay = shouldReduceMotion ? 0 : idx * 0.065;

          return (
            <motion.span
              key={letter}
              data-letter={letter}
              data-testid={`ohmni-letter-${letter}`}
              className="ohmni-3d-letter"
              initial={
                shouldReduceMotion
                  ? { opacity: 1 }
                  : {
                      opacity: 0,
                      z: isHero ? -180 : -60,
                      rotateX: isHero ? 35 : 20,
                      y: isHero ? 14 : 4,
                    }
              }
              animate={{
                opacity: 1,
                z: 0,
                rotateX: 0,
                y: 0,
              }}
              transition={{
                duration: isHero ? 0.72 : 0.45,
                delay,
                ease: [0.16, 1, 0.3, 1], // fluid cubic ease-out
              }}
              style={{
                display: "inline-block",
                position: "relative",
                transformStyle: "preserve-3d",
                fontFamily: "var(--font-sans)",
                fontSize: isHero ? "clamp(72px, 11vw, 152px)" : "22px",
                color: "var(--ohmni-brand-front, #111318)",
                textTransform: "uppercase",
                padding: isHero ? "0 0.03em" : "0 0.02em",
                willChange: "transform, opacity",
              }}
            >
              {/* Front Face Layer */}
              <span
                className="ohmni-3d-face"
                style={{
                  display: "block",
                  position: "relative",
                  zIndex: 2,
                  color: "#111318",
                  textShadow: isHero
                    ? `
                      0 1px 0 #5570FF,
                      0 2px 0 #394FA8,
                      0 3px 0 #283777,
                      0 4px 0 #1D2857,
                      0 5px 0 #151D3F,
                      0 6px 1px rgba(17, 24, 52, 0.6),
                      0 10px 24px rgba(10, 15, 35, 0.22),
                      0 20px 48px rgba(10, 15, 35, 0.14)
                    `
                    : `
                      0 1px 0 #5570FF,
                      0 1.5px 0 #283777,
                      0 2px 4px rgba(10, 15, 35, 0.18)
                    `,
                }}
              >
                {letter}
              </span>

              {/* Reflective Specular Blue Bevel Edge */}
              <span
                aria-hidden="true"
                className="ohmni-3d-bevel"
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  height: "100%",
                  color: "transparent",
                  pointerEvents: "none",
                  zIndex: 3,
                  WebkitTextStroke: isHero ? "1px rgba(85, 112, 255, 0.38)" : "0.5px rgba(85, 112, 255, 0.3)",
                  transform: "translateZ(1px)",
                }}
              >
                {letter}
              </span>
            </motion.span>
          );
        })}

        {/* Dynamic Blue Light Sweep */}
        {lightSweepActive && (
          <motion.div
            aria-hidden="true"
            className="ohmni-3d-light-sweep"
            initial={{ x: "-120%", opacity: 0 }}
            animate={{ x: "220%", opacity: [0, 0.95, 0.95, 0] }}
            transition={{
              duration: 0.95,
              delay: isHero ? 0.42 : 0.2,
              ease: "easeInOut",
            }}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "60%",
              height: "100%",
              background:
                "linear-gradient(105deg, transparent 15%, rgba(85, 112, 255, 0.15) 35%, rgba(136, 172, 255, 0.75) 50%, rgba(255, 255, 255, 0.95) 53%, rgba(85, 112, 255, 0.25) 65%, transparent 85%)",
              mixBlendMode: "overlay",
              pointerEvents: "none",
              zIndex: 4,
              transform: "skewX(-24deg)",
            }}
          />
        )}
      </motion.div>
    </div>
  );
};
