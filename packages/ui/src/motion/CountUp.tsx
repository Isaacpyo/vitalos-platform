"use client";

import { useEffect, useRef } from "react";

/** A figure split into the parts around its number: "£1,200k" -> "£", 1200, "k". */
export interface ParsedFigure {
  prefix: string;
  number: number;
  decimals: number;
  grouped: boolean;
  suffix: string;
}

const FIGURE = /^(\D*?)(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d+))?(\D*)$/;

/** Parses a figure with exactly one number in it. Anything else (ranges, dates) returns null. */
export function parseFigure(value: string): ParsedFigure | null {
  const match = FIGURE.exec(value.trim());
  if (!match) return null;
  const [, prefix = "", integer = "", fraction = "", suffix = ""] = match;
  const number = Number(`${integer.replace(/,/g, "")}${fraction ? `.${fraction}` : ""}`);
  if (!Number.isFinite(number)) return null;
  return { prefix, number, decimals: fraction.length, grouped: integer.includes(","), suffix };
}

/** Formats `n` in the shape of the parsed figure (same decimals, grouping, prefix and suffix). */
export function formatFigure(figure: ParsedFigure, n: number): string {
  const fixed = n.toFixed(figure.decimals);
  const [whole = "0", fraction] = fixed.split(".");
  const grouped = figure.grouped ? whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",") : whole;
  return `${figure.prefix}${grouped}${fraction ? `.${fraction}` : ""}${figure.suffix}`;
}

const DURATION_MS = 800;

/**
 * INTERNAL to OutcomeStats: counts a verified figure up from zero once it scrolls into view.
 * It is not exported from the package, so it can only ever animate a figure that has already
 * passed OutcomeStats' source and verification filter.
 *
 * The server renders the final figure (correct without JavaScript, no layout shift). Assistive
 * technology always reads the final figure from a visually hidden copy; the animated copy is
 * hidden from it. Nothing animates under reduced motion or when the figure cannot be parsed.
 */
export function CountUp({ value }: { value: string }) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const element = ref.current;
    const figure = parseFigure(value);
    if (!element || !figure || typeof IntersectionObserver === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let frame = 0;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        observer.disconnect();
        const start = performance.now();
        const tick = (now: number) => {
          const t = Math.min(1, (now - start) / DURATION_MS);
          const eased = 1 - Math.pow(1 - t, 4);
          element.textContent = t < 1 ? formatFigure(figure, figure.number * eased) : value;
          if (t < 1) frame = requestAnimationFrame(tick);
        };
        element.textContent = formatFigure(figure, 0);
        frame = requestAnimationFrame(tick);
      },
      { threshold: 0.6 },
    );
    observer.observe(element);

    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      element.textContent = value;
    };
  }, [value]);

  return (
    <>
      <span ref={ref} aria-hidden="true">
        {value}
      </span>
      <span className="sr-only">{value}</span>
    </>
  );
}
