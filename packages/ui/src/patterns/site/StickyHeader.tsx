"use client";

import { useEffect, useState, type ReactNode } from "react";
import { cx } from "../../primitives/_internal/cx";

/** Scroll distance after which the header condenses, and below which it expands again. */
const CONDENSE_AT = 32;
const EXPAND_AT = 8;

export interface StickyHeaderProps {
  children: ReactNode;
  className?: string | undefined;
  /** Render condensed on first paint (Storybook, documentation). */
  defaultCondensed?: boolean | undefined;
}

/**
 * The sticky `<header>` element with its scroll state (Stage 9 section 12: "gains a subtle
 * background or border when content scrolls beneath").
 *
 * - Server HTML and no-JS: the full-height, opaque header (the final state at the top of a page).
 * - Once the page scrolls, `data-condensed` is set: the bar shrinks from 72 to 56px (less than a
 *   third), the surface turns 92% opaque with a backdrop blur, and the header's bottom margin
 *   grows by exactly the height it lost, with the same duration and easing, so the content below
 *   never moves (no layout shift, no scroll jump).
 * - The children read the current bar height from `--header-h` (menus size themselves with it).
 * - A passive scroll listener batched to one check per frame; no Motion runtime. Under reduced
 *   motion the global rule makes the change instant.
 */
export function StickyHeader({ children, className, defaultCondensed }: StickyHeaderProps) {
  const [condensed, setCondensed] = useState(defaultCondensed === true);

  useEffect(() => {
    if (defaultCondensed) return;
    let frame = 0;
    const check = () => {
      frame = 0;
      const y = window.scrollY;
      setCondensed((current) => (current ? y > EXPAND_AT : y > CONDENSE_AT));
    };
    const onScroll = () => {
      if (frame === 0) frame = requestAnimationFrame(check);
    };
    check();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame !== 0) cancelAnimationFrame(frame);
    };
  }, [defaultCondensed]);

  return (
    <header
      {...(condensed ? { "data-condensed": "" } : {})}
      className={cx(
        "sticky top-0 z-40 border-b border-tone-border bg-tone-bg text-tone-text",
        "[--header-h:var(--size-header)] data-condensed:[--header-h:var(--size-header-condensed)]",
        "data-condensed:mb-[calc(var(--size-header)-var(--size-header-condensed))]",
        "data-condensed:bg-tone-bg/92 data-condensed:backdrop-blur-md",
        "transition-[margin,background-color] duration-(--duration-reveal) ease-(--ease-standard)",
        className,
      )}
    >
      {children}
    </header>
  );
}
