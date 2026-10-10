"use client";

import { useEffect } from "react";

const SELECTOR = "[data-reveal]:not([data-reveal-state])";
/** Longer than the longest entrance (400ms plus a 320ms stagger). */
const SETTLE_MS = 1000;

/**
 * Drives every `Reveal` on the page. Mount it once in the site shell. It renders nothing.
 *
 * - Does nothing without IntersectionObserver or when the visitor prefers reduced motion.
 * - Never hides content that is on screen (or above it) when it is first seen, so there is no
 *   flash and nothing the visitor is reading moves.
 * - Content further down is marked `pending` and revealed once, when it scrolls into view.
 * - A MutationObserver picks up content rendered later (client-side navigation).
 */
export function RevealController() {
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined" || typeof window.matchMedia !== "function") {
      return;
    }
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const timers: number[] = [];
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const element = entry.target as HTMLElement;
          element.dataset["revealState"] = "shown";
          observer.unobserve(element);
          // Drop the entrance styles (the clip) once the transition has had time to finish.
          timers.push(
            window.setTimeout(() => {
              element.dataset["revealState"] = "done";
            }, SETTLE_MS),
          );
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0 },
    );

    const scan = () => {
      for (const element of Array.from(document.querySelectorAll<HTMLElement>(SELECTOR))) {
        if (element.getBoundingClientRect().top < window.innerHeight) {
          element.dataset["revealState"] = "done";
          continue;
        }
        element.dataset["revealState"] = "pending";
        observer.observe(element);
      }
    };

    scan();
    let frame = 0;
    const mutations = new MutationObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(scan);
    });
    mutations.observe(document.body, { childList: true, subtree: true });

    return () => {
      cancelAnimationFrame(frame);
      for (const timer of timers) window.clearTimeout(timer);
      mutations.disconnect();
      observer.disconnect();
      // Leave nothing hidden if the controller unmounts.
      for (const element of Array.from(
        document.querySelectorAll<HTMLElement>('[data-reveal-state="pending"]'),
      )) {
        element.dataset["revealState"] = "done";
      }
    };
  }, []);

  return null;
}
