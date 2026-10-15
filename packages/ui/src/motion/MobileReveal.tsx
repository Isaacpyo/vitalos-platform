"use client";

import { useEffect } from "react";
import { prefersReducedMotion } from "./_internal/island";

/** Compact screens only: below the lg breakpoint. */
const COMPACT = "(max-width: 63.99rem)";
/** Successive items in one list start this far apart, up to six steps. */
const STEP_MS = 70;

export interface MobileRevealProps {
  /** The container whose bands and items fade in. Defaults to the page's `main`. */
  selector?: string | undefined;
}

/**
 * Fade-in on compact screens (owner direction, 15 Oct 2026): every band of the page and every
 * card, row or list item in it fades and rises into place the first time it scrolls into view,
 * items in a list a step apart. It adds to each section's own effects (Reveal, the showcases)
 * rather than replacing them: it only sets `data-m-reveal` (token CSS), never a transform.
 *
 * Armed only after hydration, only below lg, only when motion is allowed and only for what
 * starts below the fold, so the server HTML, the page without JavaScript, print and reduced
 * motion all show everything at once. Focus moving into a held item shows it immediately. The
 * lifecycle ring (`[data-cycle]`) keeps its own entrance and is left out.
 */
export function MobileReveal({ selector = "main" }: MobileRevealProps) {
  useEffect(() => {
    if (typeof IntersectionObserver !== "function" || typeof window.matchMedia !== "function") {
      return;
    }
    if (!window.matchMedia(COMPACT).matches || prefersReducedMotion()) return;
    const root = document.querySelector<HTMLElement>(selector);
    if (!root) return;

    const candidates = [
      ...Array.from(root.children),
      ...Array.from(root.querySelectorAll("li")),
    ].filter(
      (element): element is HTMLElement =>
        element instanceof HTMLElement &&
        !element.closest("[data-cycle]") &&
        !element.closest("nav") &&
        !element.closest("details:not([open])"),
    );
    const fold = window.innerHeight * 0.92;
    const held = candidates.filter((element) => element.getBoundingClientRect().top > fold);
    if (held.length === 0) return;

    const show = (element: HTMLElement) => {
      element.dataset["mReveal"] = "shown";
    };
    for (const element of held) {
      const siblings = element.parentElement ? Array.from(element.parentElement.children) : [];
      const step = Math.min(Math.max(siblings.indexOf(element), 0), 6);
      if (element.tagName === "LI" && step > 0) {
        element.style.setProperty("--m-delay", `${step * STEP_MS}ms`);
      }
      element.dataset["mReveal"] = "armed";
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          show(entry.target as HTMLElement);
          observer.unobserve(entry.target);
        }
      },
      { rootMargin: "0px 0px -8% 0px" },
    );
    for (const element of held) observer.observe(element);

    // Keyboard users never land on an invisible control.
    const onFocusIn = (event: FocusEvent) => {
      const target = event.target instanceof Node ? event.target : null;
      if (!target) return;
      for (const element of held) {
        if (element.contains(target) && element.dataset["mReveal"] === "armed") show(element);
      }
    };
    root.addEventListener("focusin", onFocusIn);

    return () => {
      observer.disconnect();
      root.removeEventListener("focusin", onFocusIn);
      for (const element of held) show(element);
    };
  }, [selector]);

  return null;
}
