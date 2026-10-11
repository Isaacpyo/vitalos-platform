import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { cx } from "./_internal/cx";
import { Icon } from "./Icon";

export interface DisclosureProps extends Omit<ComponentPropsWithoutRef<"details">, "title"> {
  /** The always-visible summary text. Keep it a short, descriptive label. */
  summary: ReactNode;
  children: ReactNode;
}

/**
 * Native `<details>`: keyboard (Enter and Space), screen reader and no-JavaScript behaviour come
 * from the platform. The chevron is decorative; open state is exposed by the element itself.
 */
export function Disclosure({ summary, children, className, ...props }: DisclosureProps) {
  return (
    <details className={cx("group border-y border-tone-border", className)} {...props}>
      <summary
        className={cx(
          "flex min-h-(--size-button-md) cursor-pointer list-none items-center justify-between gap-(--space-4)",
          "py-(--space-3) text-body font-semibold text-tone-heading",
          "marker:hidden [&::-webkit-details-marker]:hidden",
        )}
      >
        <span>{summary}</span>
        <Icon
          name="chevron-down"
          className="shrink-0 transition-transform duration-(--duration-disclosure) ease-(--ease-standard) group-open:rotate-180"
        />
      </summary>
      <div className="pb-(--space-5) text-body text-tone-text">{children}</div>
    </details>
  );
}
