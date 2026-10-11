import type { ComponentPropsWithoutRef } from "react";
import { cx } from "./_internal/cx";

/** Lead paragraph: one to three sentences of framing, intentionally larger (Stage 9 section 16). */
export function Lead({ className, ...props }: ComponentPropsWithoutRef<"p">) {
  return (
    <p
      className={cx("text-body-l max-w-(--container-prose) text-tone-text text-pretty", className)}
      {...props}
    />
  );
}
