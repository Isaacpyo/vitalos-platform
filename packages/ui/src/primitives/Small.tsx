import type { ComponentPropsWithoutRef } from "react";
import { cx } from "./_internal/cx";

export interface SmallProps extends ComponentPropsWithoutRef<"p"> {
  as?: "p" | "span" | "small" | "div" | "figcaption";
}

/** Metadata, captions and labels (13 to 14px). */
export function Small({ as = "p", className, ...props }: SmallProps) {
  const Tag = as as "p";
  return <Tag className={cx("text-small text-tone-muted", className)} {...props} />;
}
