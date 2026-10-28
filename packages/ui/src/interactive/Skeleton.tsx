import type { HTMLAttributes } from "react";
import { cx } from "../primitives/_internal/cx";

/**
 * Placeholder block for content that is genuinely loading (a lazy-loaded island, a request in
 * flight). Never use it to fake progress: render it only while something real is pending, and
 * mark the loading region `aria-busy="true"`. Decorative, so hidden from assistive technology.
 * The pulse runs only when the visitor has not asked for reduced motion.
 */
export interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  /** Number of text-like lines. Omit for a single block sized by `className`. */
  lines?: number;
}

export function Skeleton({ lines, className, ...props }: SkeletonProps) {
  if (lines && lines > 1) {
    return (
      <div aria-hidden="true" className={cx("flex flex-col gap-(--space-2)", className)} {...props}>
        {Array.from({ length: lines }, (_, index) => (
          <div
            key={index}
            className={cx(
              "h-4 rounded-sm bg-tone-border motion-safe:animate-pulse",
              index === lines - 1 && "w-2/3",
            )}
          />
        ))}
      </div>
    );
  }
  return (
    <div
      aria-hidden="true"
      className={cx("min-h-4 rounded-md bg-tone-border motion-safe:animate-pulse", className)}
      {...props}
    />
  );
}
