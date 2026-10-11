import type { ComponentPropsWithoutRef } from "react";
import { cx } from "./_internal/cx";

export type SectionTone = "light" | "muted" | "dark";
export type SectionSpacing = "compact" | "default" | "large";

const spacings: Record<SectionSpacing, string> = {
  compact: "py-(--section-compact)",
  default: "py-(--section-default)",
  large: "py-(--section-large)",
};

export interface SectionProps extends ComponentPropsWithoutRef<"section"> {
  /** Surface: light (default), muted (cloud) or dark (midnight, a deliberate emphasis surface). */
  tone?: SectionTone;
  /** Vertical rhythm: 96 to 128px desktop, 56 to 80px mobile for the larger sizes. */
  spacing?: SectionSpacing;
  as?: "section" | "div" | "aside" | "article";
}

/**
 * A page band. Sets `data-tone` so every descendant (Heading, Eyebrow, Button, TextLink, ...) reads
 * the verified contrast roles for that surface. A section needs an accessible name
 * (`aria-labelledby` or `aria-label`) to be exposed as a landmark; otherwise use as="div".
 */
export function Section({
  tone = "light",
  spacing = "default",
  as = "section",
  className,
  ...props
}: SectionProps) {
  const Tag = as as "section";
  return (
    <Tag
      data-tone={tone}
      className={cx("bg-tone-bg text-tone-text", spacings[spacing], className)}
      {...props}
    />
  );
}
