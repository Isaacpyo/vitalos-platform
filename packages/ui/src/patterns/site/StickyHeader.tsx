"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { cx } from "../../primitives/_internal/cx";

/** Scroll distance after which the header condenses, and below which it expands again. */
const CONDENSE_AT = 32;
const EXPAND_AT = 8;

export interface StickyHeaderProps {
  children: ReactNode;
  className?: string | undefined;
  /** Render condensed on first paint (Storybook, documentation). */
  defaultCondensed?: boolean | undefined;
  /**
   * Sit over a dark first band (the homepage hero): at the top of the page, with no menu open,
   * the bar is transparent and on the dark tone; once the page scrolls or a menu opens it takes
   * its usual light surface. The band underneath must start under the bar.
   */
  overlay?: boolean | undefined;
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
 * - With `overlay`, the expanded bar is clear (transparent, `data-tone="dark"`) until the page
 *   scrolls or a menu inside it opens (a `details[open]` or an `aria-expanded="true"` trigger,
 *   watched with a MutationObserver), so open menus always sit on the light surface. Server HTML
 *   and no-JS render it clear.
 */
export function StickyHeader({
  children,
  className,
  defaultCondensed,
  overlay,
}: StickyHeaderProps) {
  const [condensed, setCondensed] = useState(defaultCondensed === true);
  const [menuOpen, setMenuOpen] = useState(false);
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const header = ref.current;
    if (!overlay || !header) return;
    const sync = () =>
      setMenuOpen(header.querySelector('details[open], [aria-expanded="true"]') !== null);
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(header, {
      subtree: true,
      attributes: true,
      attributeFilter: ["open", "aria-expanded"],
    });
    return () => observer.disconnect();
  }, [overlay]);

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

  const clear = overlay === true && !condensed && !menuOpen;

  return (
    <header
      ref={ref}
      {...(condensed ? { "data-condensed": "" } : {})}
      {...(clear ? { "data-tone": "dark", "data-clear": "" } : {})}
      className={cx(
        // No bottom rule under the navigation (owner direction, 16 Oct 2026).
        "sticky top-0 z-40 text-tone-text",
        clear ? "bg-transparent" : "bg-tone-bg",
        "[--header-h:var(--size-header)] data-condensed:[--header-h:var(--size-header-condensed)]",
        "data-condensed:mb-[calc(var(--size-header)-var(--size-header-condensed))]",
        "data-condensed:bg-tone-bg/92 data-condensed:backdrop-blur-md",
        "transition-[margin,background-color,border-color] duration-(--duration-reveal) ease-(--ease-standard)",
        className,
      )}
    >
      {children}
    </header>
  );
}
