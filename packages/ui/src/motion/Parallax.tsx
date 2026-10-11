"use client";

import { useEffect, type ReactNode } from "react";
import { useMotionValue } from "motion/react";
import * as m from "motion/react-m";
import { MotionIsland, useMotionAllowed } from "./_internal/island";

export interface ParallaxProps {
  /** Travel in px over the first `distance` px of page scroll (negative moves up). */
  travel?: number;
  distance?: number;
  className?: string | undefined;
  children?: ReactNode;
}

/**
 * A gentle scroll-linked shift for ONE decorative element per page (Stage 9 sections 2 and 11:
 * no parallax overload; ADR-024). Follows normal page scrolling (no hijacking), moves by a few
 * pixels, and is static on the server, without JavaScript and under reduced motion. Never wrap
 * content in it: decorative, `aria-hidden` layers only.
 *
 * A passive scroll listener (one update per frame) feeds a Motion value, which writes the
 * transform without re-rendering React; Motion's scroll-timeline engine is not needed for this.
 */
export function Parallax(props: ParallaxProps) {
  return (
    <MotionIsland>
      <ParallaxInner {...props} />
    </MotionIsland>
  );
}

function ParallaxInner({ travel = -24, distance = 600, className, children }: ParallaxProps) {
  const allowed = useMotionAllowed();
  const y = useMotionValue(0);

  useEffect(() => {
    if (!allowed) {
      y.set(0);
      return;
    }
    let frame = 0;
    const update = () => {
      frame = 0;
      const progress = Math.min(1, Math.max(0, window.scrollY / distance));
      y.set(progress * travel);
    };
    const onScroll = () => {
      if (frame === 0) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame !== 0) cancelAnimationFrame(frame);
    };
  }, [allowed, distance, travel, y]);

  return (
    <m.div aria-hidden="true" style={{ y }} {...(className ? { className } : {})}>
      {children}
    </m.div>
  );
}
