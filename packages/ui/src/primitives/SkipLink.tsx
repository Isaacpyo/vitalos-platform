import type { ComponentPropsWithoutRef } from "react";
import { cx } from "./_internal/cx";

export interface SkipLinkProps extends Omit<ComponentPropsWithoutRef<"a">, "href"> {
  /** Id of the main landmark, as a fragment. */
  href?: string;
}

/**
 * First focusable element on every page. Hidden until focused, then shown above the sticky header
 * so focus is never obscured (Stage 9 section 30). The target needs `id` and `tabIndex={-1}`.
 */
export function SkipLink({
  href = "#main",
  children = "Skip to main content",
  className,
  ...props
}: SkipLinkProps) {
  return (
    <a
      href={href}
      className={cx(
        "sr-only focus:not-sr-only focus:fixed focus:top-(--space-3) focus:left-(--space-3) focus:z-50",
        "focus:rounded-sm focus:bg-white focus:px-(--space-4) focus:py-(--space-3) focus:font-semibold",
        "focus:text-midnight-950 focus:shadow-floating",
        className,
      )}
      {...props}
    >
      {children}
    </a>
  );
}
