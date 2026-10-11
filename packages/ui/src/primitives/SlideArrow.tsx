import { cx } from "./_internal/cx";
import { Icon } from "./Icon";

export interface SlideArrowProps {
  /** Rendered size in px. */
  size?: 16 | 20;
  className?: string | undefined;
}

const arrow =
  "absolute inset-0 transition-transform duration-(--duration-feedback) ease-(--ease-emphasis)";

/**
 * Directional arrow for buttons, links and cards. On hover or keyboard focus of the nearest
 * `.group`, the arrow leaves to the right and a twin enters from the left. CSS only (no
 * JavaScript); the global reduced-motion rule shortens the transition to an instant swap.
 * Always decorative: the link text names the destination.
 */
export function SlideArrow({ size = 16, className }: SlideArrowProps) {
  return (
    <span
      aria-hidden="true"
      className={cx(
        "relative inline-block shrink-0 overflow-hidden",
        size === 16 ? "size-4" : "size-5",
        className,
      )}
    >
      <Icon
        name="arrow-right"
        size={size}
        className={cx(
          arrow,
          "group-hover:translate-x-full group-focus-visible:translate-x-full group-focus-within:translate-x-full",
        )}
      />
      <Icon
        name="arrow-right"
        size={size}
        className={cx(
          arrow,
          "-translate-x-full group-hover:translate-x-0 group-focus-visible:translate-x-0 group-focus-within:translate-x-0",
        )}
      />
    </span>
  );
}
