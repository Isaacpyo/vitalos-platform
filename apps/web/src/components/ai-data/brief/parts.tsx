"use client";

import type { ReactNode } from "react";
import { Icon } from "@vitalos/ui";

/**
 * Small presentation parts for the guided brief (W6). Colours come only from the `--aid-*` roles
 * (set by `data-aid-tone` on the surrounding panel); native elements and aria attributes, no
 * dependency on the shared overlay wrappers.
 */

export const cx = (...parts: (string | false | null | undefined)[]) =>
  parts.filter(Boolean).join(" ");

const focusRing =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-aid-focus";

/** A quick-answer suggestion. A toggle: pressed means the answer currently equals this text. */
export function Chip({
  children,
  pressed,
  onClick,
  disabled,
}: Readonly<{
  children: ReactNode;
  pressed?: boolean;
  onClick: () => void;
  disabled?: boolean;
}>) {
  return (
    <button
      type="button"
      aria-pressed={pressed ?? false}
      disabled={disabled}
      onClick={onClick}
      className={cx(
        "inline-flex min-h-11 items-center gap-(--space-2) rounded-full border px-(--space-4) py-(--space-2) text-small",
        "transition-[background-color,border-color,transform] duration-(--duration-feedback) ease-(--ease-standard)",
        "border-aid-control-border bg-aid-control-bg text-aid-text hover:border-aid-accent hover:bg-aid-chip-bg",
        "active:translate-y-px aria-pressed:border-aid-signal aria-pressed:bg-aid-signal-soft aria-pressed:text-aid-heading",
        "disabled:cursor-not-allowed disabled:opacity-60",
        focusRing,
      )}
    >
      {pressed ? <Icon name="check" size={16} className="shrink-0" /> : null}
      {children}
    </button>
  );
}

export function ChipRow({ label, children }: Readonly<{ label: string; children: ReactNode }>) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-(--space-2)">
      {children}
    </div>
  );
}

const tagStyles = {
  you: "border-aid-ok bg-aid-ok-bg text-aid-ok",
  ai: "border-aid-info bg-aid-info-bg text-aid-info",
  checklist: "border-aid-line bg-aid-chip-bg text-aid-chip-text",
  edited: "border-aid-warn bg-aid-warn-bg text-aid-warn",
} as const;

const tagIcons = { you: "users", ai: "chip", checklist: "document", edited: "check" } as const;

/** Provenance label. Text and an icon carry the meaning, never colour alone. */
export function ProvenanceTag({
  kind,
  children,
}: Readonly<{ kind: keyof typeof tagStyles; children: ReactNode }>) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-(--space-2) rounded-sm border px-(--space-3) py-(--space-1) text-small font-semibold",
        tagStyles[kind],
      )}
    >
      <Icon name={tagIcons[kind]} size={16} className="shrink-0" />
      {children}
    </span>
  );
}

export { Skeleton } from "@vitalos/ui/interactive";

/** Notice block: info (neutral), warning (AI could not be used) or error. Text plus icon. */
export function Notice({
  tone,
  title,
  children,
  id,
}: Readonly<{
  tone: "info" | "warn" | "error";
  title: string;
  children?: ReactNode;
  id?: string;
}>) {
  const style = {
    info: "border-aid-line bg-aid-info-bg text-aid-text",
    warn: "border-aid-warn bg-aid-warn-bg text-aid-text",
    error: "border-aid-error bg-aid-error-bg text-aid-text",
  }[tone];
  const icon = { info: "info", warn: "warning", error: "error" }[tone] as
    "info" | "warning" | "error";
  return (
    <div id={id} className={cx("flex gap-(--space-3) rounded-md border p-(--space-4)", style)}>
      <Icon name={icon} size={20} className="mt-0.5 shrink-0" />
      <div className="min-w-0">
        <p className="m-0 font-semibold text-aid-heading">{title}</p>
        {children ? <div className="mt-(--space-1) text-small">{children}</div> : null}
      </div>
    </div>
  );
}

export const secondaryButton = cx(
  "inline-flex min-h-11 items-center justify-center gap-(--space-2) rounded-md border border-aid-control-border bg-transparent px-(--space-4) text-small font-semibold text-aid-heading",
  "transition-colors duration-(--duration-feedback) ease-(--ease-standard) hover:bg-aid-chip-bg active:translate-y-px",
  "disabled:cursor-not-allowed disabled:opacity-60",
  focusRing,
);

export const textButton = cx(
  "inline-flex min-h-11 items-center gap-(--space-2) rounded-sm px-(--space-2) text-small font-semibold text-aid-link underline underline-offset-4",
  "hover:text-aid-link-hover active:translate-y-px",
  focusRing,
);
