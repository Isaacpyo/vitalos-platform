"use client";

import { useEffect, useRef, type ReactNode } from "react";

/** The breakpoint (Tailwind `md`) from which every footer column is shown expanded. */
const EXPANDED_FROM = "(min-width: 48rem)";

export interface FooterNavProps {
  label: string;
  className?: string | undefined;
  children: ReactNode;
}

/**
 * Footer navigation whose link columns are native `<details>` rendered open. Below `md` they
 * collapse to their headings and each expands on its own; from `md` they stay open and the
 * headings do not toggle. Without JavaScript every column stays open, so no link is unreachable.
 */
export function FooterNav({ label, className, children }: FooterNavProps) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const nav = ref.current;
    if (!nav || typeof window.matchMedia !== "function") return;
    const columns = Array.from(nav.querySelectorAll<HTMLDetailsElement>("details"));
    const query = window.matchMedia(EXPANDED_FROM);
    const sync = () => {
      for (const column of columns) column.open = query.matches;
    };
    // From `md` a heading is a heading: clicking it (or Enter/Space on it) changes nothing.
    const keepOpen = (event: Event) => {
      if (query.matches) event.preventDefault();
    };
    const summaries = columns.flatMap((column) => {
      const summary = column.querySelector("summary");
      return summary ? [summary] : [];
    });

    sync();
    query.addEventListener("change", sync);
    for (const summary of summaries) summary.addEventListener("click", keepOpen);
    return () => {
      query.removeEventListener("change", sync);
      for (const summary of summaries) summary.removeEventListener("click", keepOpen);
    };
  }, []);

  return (
    <nav ref={ref} aria-label={label} className={className}>
      {children}
    </nav>
  );
}
