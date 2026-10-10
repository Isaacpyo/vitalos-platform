import type { ComponentPropsWithoutRef } from "react";
import { cx } from "./_internal/cx";

export interface CTAGroupProps extends ComponentPropsWithoutRef<"div"> {
  align?: "start" | "center";
}

/**
 * A primary action beside its quieter alternatives. Wraps on narrow screens; one dominant
 * (primary) action per local region (Stage 9 section 14).
 */
export function CTAGroup({ align = "start", className, ...props }: CTAGroupProps) {
  return (
    <div
      className={cx(
        "flex flex-wrap items-center gap-x-(--space-5) gap-y-(--space-3)",
        align === "center" && "justify-center",
        className,
      )}
      {...props}
    />
  );
}
