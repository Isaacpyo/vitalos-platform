import type { ComponentPropsWithoutRef } from "react";
import { cx } from "./_internal/cx";

export interface TagProps extends ComponentPropsWithoutRef<"span"> {
  as?: "span" | "li";
}

/** Content classification (topic, format, maturity). Never decoration. */
export function Tag({ as = "span", className, ...props }: TagProps) {
  const El = as as "span";
  return (
    <El
      className={cx(
        "inline-flex items-center rounded-sm border border-tone-border px-(--space-2) py-0.5 text-small font-medium text-tone-text",
        className,
      )}
      {...props}
    />
  );
}
