"use client";

import { useEffect, useState, type ReactNode } from "react";
import { LazyMotion, MotionConfig, domAnimation } from "motion/react";

/**
 * Root of every Motion island (ADR-024). `LazyMotion` with the `domAnimation` feature set (no
 * drag, no layout animation) keeps the shared runtime small, and `strict` makes a stray full
 * `motion.*` component (which would pull every feature in) fail loudly; islands use `m.*`.
 * `MotionConfig reducedMotion="user"` is the backstop under each component's own reduced-motion
 * check. Nesting islands is cheap: the feature bundle is loaded once.
 */
export function MotionIsland({ children }: { children: ReactNode }) {
  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </LazyMotion>
  );
}

/**
 * True only after hydration, when the visitor has not asked for reduced motion. The first render
 * (server and hydration) is always `false`, so the server HTML and the hydrated markup are the
 * same static, fully visible state; movement can only begin afterwards.
 */
export function useMotionAllowed(): boolean {
  // Live: follows the visitor changing the system setting while the page is open.
  const [allowed, setAllowed] = useState(false);
  useEffect(() => {
    const update = () => setAllowed(!prefersReducedMotion());
    update();
    if (typeof window.matchMedia !== "function") return;
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (typeof query.addEventListener !== "function") return;
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return allowed;
}

/** Direct media-query read, for event handlers and effects. */
export function prefersReducedMotion(): boolean {
  return (
    typeof window === "undefined" ||
    typeof window.matchMedia !== "function" ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/** The emphasis easing token (`--ease-emphasis`) as a Motion cubic bezier. */
export const EASE_EMPHASIS = [0.22, 1, 0.36, 1] as const;
/** Duration tokens in seconds (Stage 9 section 11; mirrored from @vitalos/design-tokens). */
export const SECONDS = {
  feedback: 0.14,
  reveal: 0.2,
  disclosure: 0.22,
  entrance: 0.4,
  diagram: 0.6,
} as const;
