import { cx } from "./_internal/cx";
import { SlideArrow } from "./SlideArrow";

export interface CircleArrowProps {
  className?: string | undefined;
}

/**
 * Decorative arrow disc for a card or row whose title is the link (the stretched link is the
 * target; this is only an affordance). Fills with the action colour when the nearest `.group` is
 * hovered or holds focus. Follows the surrounding tone.
 */
export function CircleArrow({ className }: CircleArrowProps) {
  return (
    <span
      aria-hidden="true"
      className={cx(
        "inline-flex size-10 shrink-0 items-center justify-center rounded-full border border-tone-border bg-tone-bg text-tone-link",
        "transition-colors duration-(--duration-feedback) ease-(--ease-standard)",
        "group-hover:border-tone-action group-hover:bg-tone-action group-hover:text-tone-action-text",
        "group-focus-within:border-tone-action group-focus-within:bg-tone-action group-focus-within:text-tone-action-text",
        className,
      )}
    >
      <SlideArrow size={16} />
    </span>
  );
}
