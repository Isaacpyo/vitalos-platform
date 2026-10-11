import type { ComponentPropsWithoutRef } from "react";
import { cx } from "./_internal/cx";

export interface EyebrowProps extends ComponentPropsWithoutRef<"p"> {
  as?: "p" | "span" | "div";
}

/**
 * Section categorisation only (Stage 9 section 16): uppercase and letter-spaced, in the tone's
 * eyebrow colour (brand blue on light surfaces, as in the owner comp; a light neutral on dark).
 */
export function Eyebrow({ as = "p", className, ...props }: EyebrowProps) {
  const Tag = as as "p";
  return <Tag className={cx("text-eyebrow text-tone-eyebrow uppercase", className)} {...props} />;
}
