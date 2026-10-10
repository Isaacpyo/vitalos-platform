import type { ComponentPropsWithoutRef } from "react";
import { cx } from "../primitives/_internal/cx";

export type RevealDelay = 0 | 1 | 2 | 3 | 4;

export interface RevealProps extends ComponentPropsWithoutRef<"div"> {
  as?: "div" | "li" | "section" | "article";
  /** Stagger step inside a group (80ms each). */
  delay?: RevealDelay;
}

const delays: Record<RevealDelay, string> = {
  0: "",
  1: "delay-80",
  2: "delay-160",
  3: "delay-240",
  4: "delay-320",
};

/**
 * Optional section entrance (Stage 9 section 11: 200 to 400ms, never gates content).
 *
 * Progressive by construction: the server renders the content fully visible, and nothing hides
 * it unless `RevealController` (one client island in the site shell) is running, motion is
 * allowed, and the element starts below the fold. Only then is it marked `pending` (clipped away
 * and lowered by 24px) until it scrolls into view, when it rises while a clip wipes it in.
 *
 * No opacity is animated: text is always drawn at full colour, so contrast holds in every frame
 * (automated checks that scroll elements into view never sample a half-faded state). The clip
 * extends 1rem beyond the box so focus outlines and hover lifts are not cut, and the controller
 * removes it once the entrance has finished.
 */
export function Reveal({ as = "div", delay = 0, className, ...props }: RevealProps) {
  const Tag = as as "div";
  return (
    <Tag
      data-reveal=""
      className={cx(
        "transition-[translate,clip-path] duration-(--duration-entrance) ease-(--ease-emphasis)",
        "data-[reveal-state=pending]:translate-y-6 data-[reveal-state=pending]:[clip-path:inset(-1rem_-1rem_100%_-1rem)]",
        "data-[reveal-state=shown]:[clip-path:inset(-1rem)]",
        delays[delay],
        className,
      )}
      {...props}
    />
  );
}
