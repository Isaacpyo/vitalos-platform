import type { ComponentPropsWithoutRef } from "react";
import { cx } from "./_internal/cx";

export interface RuleProps extends ComponentPropsWithoutRef<"hr"> {
  /** strong uses the heading colour for a heavier structural division. */
  strong?: boolean;
}

/** A 1px structural rule (Stage 9 section 8). Rendered as a semantic `<hr>` separator. */
export function Rule({ strong = false, className, ...props }: RuleProps) {
  return (
    <hr
      className={cx(
        "m-0 h-0 w-full border-0 border-t",
        strong ? "border-tone-heading" : "border-tone-border",
        className,
      )}
      {...props}
    />
  );
}
