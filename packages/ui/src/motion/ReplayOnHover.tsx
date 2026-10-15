"use client";

import type { PointerEvent, ReactNode } from "react";

export interface ReplayOnHoverProps {
  /** CSS animation names to restart; any other animation inside (an idle loop) is left alone. */
  names: readonly string[];
  /**
   * Where the replay starts, in ms of the original timeline. Entrance delays count from page
   * load, so starting part-way skips the wait the first paint needed.
   */
  fromMs?: number | undefined;
  className?: string | undefined;
  children: ReactNode;
}

/**
 * Replays a CSS entrance sequence when the pointer enters (a small client island). It rewinds the
 * named animations inside it to `fromMs` with the Web Animations API, so the sequence plays
 * again from where its first step begins. It never calls `play()`, so a held animation (the
 * MotionPause switch) stays held, and under reduced motion there are no animations to rewind.
 * Without JavaScript nothing replays; the first-paint sequence is unchanged.
 */
export function ReplayOnHover({ names, fromMs = 0, className, children }: ReplayOnHoverProps) {
  const onPointerEnter = (event: PointerEvent<HTMLDivElement>) => {
    const wanted = new Set(names);
    for (const animation of event.currentTarget.getAnimations({ subtree: true })) {
      if (animation instanceof CSSAnimation && wanted.has(animation.animationName)) {
        animation.currentTime = fromMs;
      }
    }
  };
  return (
    <div className={className} onPointerEnter={onPointerEnter}>
      {children}
    </div>
  );
}
