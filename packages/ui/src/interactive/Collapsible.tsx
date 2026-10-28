"use client";

import { Collapsible as BaseCollapsible } from "@base-ui/react/collapsible";
import type { ReactNode } from "react";
import { cx } from "../primitives/_internal/cx";
import { Icon } from "../primitives/Icon";
import { focusRing } from "./_surface";

/**
 * Collapsible (Base UI): a button that expands and collapses a region with a short height
 * transition (instant under reduced motion). The panel stays in the DOM with
 * `hidden="until-found"`, so find-in-page opens it. Prefer native `<details>` (Disclosure) when
 * the content is plain and no animation is wanted.
 */
export const Collapsible = BaseCollapsible.Root;

export function CollapsibleTrigger({
  className,
  children,
  ...props
}: Omit<BaseCollapsible.Trigger.Props, "className" | "children"> & {
  className?: string;
  children: ReactNode;
}) {
  return (
    <BaseCollapsible.Trigger
      className={cx(
        "group inline-flex min-h-11 items-center gap-(--space-2) text-left text-body font-semibold text-tone-link",
        "transition-colors duration-(--duration-feedback) hover:text-tone-link-hover",
        focusRing,
        className,
      )}
      {...props}
    >
      {children}
      <Icon
        name="chevron-down"
        size={16}
        className="shrink-0 transition-transform duration-(--duration-disclosure) ease-(--ease-standard) group-data-panel-open:rotate-180"
      />
    </BaseCollapsible.Trigger>
  );
}

export function CollapsiblePanel({
  className,
  ...props
}: Omit<BaseCollapsible.Panel.Props, "className"> & { className?: string }) {
  return (
    <BaseCollapsible.Panel
      hiddenUntilFound
      className={cx(
        "h-(--collapsible-panel-height) overflow-hidden transition-[height] duration-(--duration-disclosure) ease-(--ease-standard)",
        "data-ending-style:h-0 data-starting-style:h-0",
        className,
      )}
      {...props}
    />
  );
}
