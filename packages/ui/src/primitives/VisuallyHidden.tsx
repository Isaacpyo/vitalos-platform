import type { ComponentPropsWithoutRef } from "react";
import { cx } from "./_internal/cx";

export interface VisuallyHiddenProps extends ComponentPropsWithoutRef<"span"> {
  as?: "span" | "div" | "p";
}

/** Content for assistive technology only: removed from layout, kept in the accessibility tree. */
export function VisuallyHidden({ as = "span", className, ...props }: VisuallyHiddenProps) {
  const Tag = as as "span";
  return <Tag className={cx("sr-only", className)} {...props} />;
}
