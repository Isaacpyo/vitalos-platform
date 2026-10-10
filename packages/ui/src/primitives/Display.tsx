import type { ComponentPropsWithoutRef } from "react";
import { cx } from "./_internal/cx";

export type DisplaySize = "xl" | "l";

const sizes: Record<DisplaySize, string> = {
  xl: "text-display-xl",
  l: "text-display-l",
};

export interface DisplayProps extends ComponentPropsWithoutRef<"h1"> {
  /** xl: homepage and major campaign hero only; l: top-level page heroes. */
  size?: DisplaySize;
  /** Rendered element. A page has one h1; use "p" when a display line is decorative. */
  as?: "h1" | "h2" | "p";
}

/** Display type (Stage 9 section 5). Reserved for hero statements. */
export function Display({ size = "l", as = "h1", className, ...props }: DisplayProps) {
  const Tag = as as "h1";
  return (
    <Tag className={cx(sizes[size], "text-tone-heading text-balance", className)} {...props} />
  );
}
