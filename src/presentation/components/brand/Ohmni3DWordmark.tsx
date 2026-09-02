/**
 * OHMNI 3D Wordmark Component
 * Milestone 7.14 — Precision-Machined Typography & Clipped Specular Identity.
 *
 * Invariants:
 * 1. Precision Sizing: Reduced hero size (~35% reduction from 152px to ~98px) for cohesive balance.
 * 2. Tight Extrusion Depth: 50–65% reduced extrusion depth (tight 2–3 layer micro-machined shadow).
 * 3. Clipped Light Sweep: Light sweep is clipped strictly to letter faces with NO rectangular background spill.
 * 4. Micro-Parallax: Pointer tracking (±2.5° Y, ±1.5° X) returning smoothly to neutral.
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

  // Micro-parallax handler (±1.5deg X, ±2.8deg Y)
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

      const clampedX = Math.max(-1, Math.min(1, normX));
      const clampedY = Math.max(-1, Math.min(1, normY));

      setRotY(clampedX * (isHero ? 2.8 : 1.8));
      setRotX(-clampedY * (isHero ? 1.5 : 1.0));
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
    setLightSweepActive(true);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setLightSweepActive(false);
      onAnimationComplete?.();
    }, 1100);
    return () => clearTimeout(timer);
  }, [onAnimationComplete]);

  return (
    <div
      ref={sceneRef}
      data-testid="ohmni-3d-wordmark"
      id={isHero ? "landing-3d-wordmark" : "navbar-3d-wordmark"}
      className={`ohmni-3d-scene ${isHero ? "ohmni-3d-scene--hero" : "ohmni-3d-scene--compact"} ${className}`}
      onPointerMove={handlePointerMove}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
      style={{
        perspective: isHero ? "1000px" : "600px",
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
        animate={{
          rotateX: rotX,
          rotateY: rotY,
          scale: isHovered && isHero ? 1.01 : 1.0,
        }}
        transition={{
          type: "spring",
          stiffness: 160,
          damping: 24,
          mass: 0.5,
        }}
        style={{
          display: "inline-flex",
          alignItems: "center",
          transformStyle: "preserve-3d",
          position: "relative",
          letterSpacing: isHero ? "0.05em" : "0.04em",
          fontWeight: 900,
          lineHeight: 1,
        }}
      >
        {LETTERS.map((letter, idx) => {
          const delay = shouldReduceMotion ? 0 : idx * 0.055;

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
                      z: isHero ? -120 : -40,
                      rotateX: isHero ? 25 : 15,
                      y: isHero ? 10 : 3,
                    }
              }
              animate={{
                opacity: 1,
                z: 0,
                rotateX: 0,
                y: 0,
              }}
              transition={{
                duration: isHero ? 0.65 : 0.4,
                delay,
                ease: [0.16, 1, 0.3, 1],
              }}
              style={{
                display: "inline-block",
                position: "relative",
                transformStyle: "preserve-3d",
                fontFamily: "var(--font-sans)",
                fontSize: isHero ? "clamp(48px, 7.2vw, 102px)" : "22px",
                color: "#111318",
                textTransform: "uppercase",
                padding: isHero ? "0 0.025em" : "0 0.02em",
                willChange: "transform, opacity",
              }}
            >
              {/* Front Face Layer with Precision Extrusion Shadow */}
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
                      0 2px 0 #283777,
                      0 3px 0 #151D3F,
                      0 4px 10px rgba(10, 15, 35, 0.18)
                    `
                    : `
                      0 1px 0 #5570FF,
                      0 1.5px 0 #283777,
                      0 2px 4px rgba(10, 15, 35, 0.12)
                    `,
                }}
              >
                {letter}
              </span>

              {/* Reflective Specular Bevel Edge */}
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
                  WebkitTextStroke: isHero ? "0.75px rgba(85, 112, 255, 0.35)" : "0.5px rgba(85, 112, 255, 0.25)",
                  transform: "translateZ(1px)",
                }}
              >
                {letter}
              </span>

              {/* Specular Letter-Clipped Light Sweep */}
              {lightSweepActive && (
                <motion.span
                  aria-hidden="true"
                  className="ohmni-3d-letter-sweep"
                  initial={{ opacity: 0, scaleX: 0.8 }}
                  animate={{
                    opacity: [0, 0.85, 0],
                  }}
                  transition={{
                    duration: 0.6,
                    delay: delay + 0.3,
                    ease: "easeInOut",
                  }}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: "100%",
                    color: "transparent",
                    WebkitTextStroke: "1px rgba(255, 255, 255, 0.85)",
                    pointerEvents: "none",
                    zIndex: 4,
                    transform: "translateZ(2px)",
                  }}
                >
                  {letter}
                </motion.span>
              )}
            </motion.span>
          );
        })}
      </motion.div>
    </div>
  );
};
