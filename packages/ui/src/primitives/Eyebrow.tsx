import type { ComponentPropsWithoutRef } from "react";
import { cx } from "./_internal/cx";

export interface EyebrowProps extends ComponentPropsWithoutRef<"p"> {
  as?: "p" | "span" | "div";
}

/** Section categorisation only (Stage 9 section 16): uppercase, letter-spaced, muted. */
export function Eyebrow({ as = "p", className, ...props }: EyebrowProps) {
  const Tag = as as "p";
  return <Tag className={cx("text-eyebrow text-tone-muted uppercase", className)} {...props} />;
}
