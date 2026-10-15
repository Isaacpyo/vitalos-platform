import { cx } from "../../primitives/_internal/cx";

/** Desktop top-level link. The active section is underlined and bold (never colour alone). */
export function topLevelLinkClasses(active: boolean): string {
  return cx(
    "inline-flex min-h-(--size-button-md) items-center px-(--space-2) text-small whitespace-nowrap xl:px-(--space-3)",
    "text-tone-heading underline-offset-8 hover:underline hover:decoration-2",
    active ? "font-semibold underline decoration-2" : "font-medium",
  );
}

/** Quiet link on a midnight or light surface (footer, mega-menu columns). */
export const quietLinkClasses =
  "text-tone-text no-underline underline-offset-4 hover:text-tone-heading hover:underline";

/** Header utility link (the Trust Centre): a quiet outlined chip, as in the owner comp. */
export const utilityLinkClasses = cx(
  "inline-flex min-h-(--size-button-sm) items-center rounded-md border border-tone-border px-(--space-4)",
  "text-small font-semibold whitespace-nowrap text-tone-link no-underline",
  "transition-colors duration-(--duration-feedback) ease-(--ease-standard) hover:border-tone-link",
);
