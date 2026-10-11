import { cx } from "./_internal/cx";
import { Icon, type IconName } from "./Icon";

export interface IconTileProps {
  name: IconName;
  /** md: cards and rows; lg: feature items. */
  size?: "md" | "lg";
  className?: string | undefined;
}

/**
 * A monoline icon on a tinted square (the comp's subject marker). Decorative: it always sits
 * beside a visible label, so it is hidden from assistive technology. The tint and icon colours
 * are tone roles with a tested 3:1 contrast pair; inside a hovered `.group` the tile takes the
 * action colours.
 */
export function IconTile({ name, size = "md", className }: IconTileProps) {
  return (
    <span
      aria-hidden="true"
      className={cx(
        "inline-flex shrink-0 items-center justify-center self-start rounded-lg bg-tone-tile-bg text-tone-tile-fg",
        "transition-colors duration-(--duration-feedback) ease-(--ease-standard)",
        "group-hover:bg-tone-action group-hover:text-tone-action-text",
        size === "md" ? "size-12" : "size-14",
        className,
      )}
    >
      <Icon name={name} size={24} />
    </span>
  );
}
