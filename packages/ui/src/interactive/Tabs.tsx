"use client";

import { Tabs as BaseTabs } from "@base-ui/react/tabs";
import { cx } from "../primitives/_internal/cx";
import { focusRing } from "./_surface";

/**
 * Tabs (Base UI): roving tabindex, Arrow/Home/End keys, `aria-selected`, `aria-controls`. No
 * Tabs.Indicator: it injects an inline script (see ADR-054, CSP); selection is shown with a
 * border and weight so it never relies on colour alone.
 */
export const Tabs = BaseTabs.Root;

export function TabsList({
  className,
  ...props
}: Omit<BaseTabs.List.Props, "className"> & { className?: string }) {
  return (
    <BaseTabs.List
      className={cx("flex flex-wrap gap-(--space-2) border-b border-tone-border", className)}
      {...props}
    />
  );
}

export function TabsTab({
  className,
  ...props
}: Omit<BaseTabs.Tab.Props, "className"> & { className?: string }) {
  return (
    <BaseTabs.Tab
      className={cx(
        "-mb-px inline-flex min-h-11 items-center border-b-2 border-transparent px-(--space-4) text-body font-semibold text-tone-muted",
        "transition-colors duration-(--duration-feedback) hover:text-tone-heading",
        "data-active:border-tone-accent data-active:text-tone-heading",
        focusRing,
        className,
      )}
      {...props}
    />
  );
}

export function TabsPanel({
  className,
  ...props
}: Omit<BaseTabs.Panel.Props, "className"> & { className?: string }) {
  return <BaseTabs.Panel className={cx("outline-none", focusRing, className)} {...props} />;
}
