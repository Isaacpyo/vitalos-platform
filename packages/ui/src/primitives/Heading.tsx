import type { ComponentPropsWithoutRef } from "react";
import { cx } from "./_internal/cx";

export type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;
export type HeadingSize = "h1" | "h2" | "h3" | "h4";

const sizes: Record<HeadingSize, string> = {
  h1: "text-h1",
  h2: "text-h2",
  h3: "text-h3",
  h4: "text-body-l font-semibold",
};

const defaultSize = (level: HeadingLevel): HeadingSize =>
  level === 1 ? "h1" : level === 2 ? "h2" : level === 3 ? "h3" : "h4";

export interface HeadingProps extends ComponentPropsWithoutRef<"h2"> {
  /** Semantic level: drives the document outline only. */
  level: HeadingLevel;
  /** Visual size, independent of the semantic level. Defaults to the size matching the level. */
  size?: HeadingSize;
}

/** Heading with the semantic level decoupled from the visual size (Stage 9 section 30). */
export function Heading({ level, size, className, ...props }: HeadingProps) {
  const Tag = `h${level}` as "h2";
  return (
    <Tag
      className={cx(sizes[size ?? defaultSize(level)], "text-tone-heading text-balance", className)}
      {...props}
    />
  );
}
