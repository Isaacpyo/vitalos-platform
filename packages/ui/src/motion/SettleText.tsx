import type { CSSProperties } from "react";
import { cx } from "../primitives/_internal/cx";

export interface SettlePart {
  text: string;
  /** Set this part in the link colour (the comp's coloured closing clause). Presentation only. */
  accent?: boolean | undefined;
}

export interface SettleTextProps {
  /** The text in order; parts are joined exactly as given (include the spaces). */
  parts: readonly SettlePart[];
  /** Delay between words in ms. The whole settle stays within the 400ms entrance budget. */
  step?: number | undefined;
  className?: string | undefined;
}

/** Each word's settle; the last word starts at most this long after the first. */
const DURATION_MS = 240;
const BUDGET_MS = 400;

/**
 * A staggered headline that never hides its text (ADR-024). Each word is drawn at full colour
 * from the very first paint and only rises 0.3em into place, one after another, finishing within
 * 400ms (Stage 9 section 11 entrance budget). Pure CSS (`hero-word` keyframes behind
 * `motion-safe`), so it starts with the first paint, needs no JavaScript and does nothing under
 * reduced motion. Render it inside the heading element: the accessible name is the joined text,
 * because the words are plain inline-block spans separated by real spaces.
 */
export function SettleText({ parts, step = 12, className }: SettleTextProps) {
  const words = parts.flatMap((part) =>
    part.text
      .split(/(\s+)/)
      .filter((token) => token !== "")
      .map((token) => ({ token, accent: part.accent === true })),
  );
  const count = words.filter(({ token }) => token.trim() !== "").length;
  const gap = Math.max(0, Math.min(step, (BUDGET_MS - DURATION_MS) / Math.max(1, count - 1)));
  let index = 0;
  return (
    <span className={className}>
      {words.map(({ token, accent }, position) => {
        if (token.trim() === "") return token;
        const style = { animationDelay: `${Math.round(index * gap)}ms` } as CSSProperties;
        index += 1;
        return (
          <span
            key={position}
            style={style}
            className={cx(
              "inline-block motion-safe:animate-[hero-word_240ms_var(--ease-emphasis)_both]",
              accent && "text-tone-link",
            )}
          >
            {token}
          </span>
        );
      })}
    </span>
  );
}
