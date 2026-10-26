import type { ReactNode } from "react";
import { cx } from "./_internal/cx";
import { Icon, type IconName } from "./Icon";

export interface IconTileProps {
  name: IconName;
  /** sm: menu links; md: cards and rows; lg: feature items. */
  size?: "sm" | "md" | "lg";
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
    <IconTileFrame size={size} className={className}>
      <Icon name={name} size={iconTileGlyphSize(size)} />
    </IconTileFrame>
  );
}

/** The glyph size inside a tile of the given size. */
export const iconTileGlyphSize = (size: NonNullable<IconTileProps["size"]>) =>
  size === "sm" ? 20 : 24;

/**
 * The tile around any glyph. Exported for the server-only subject icons
 * (`@vitalos/ui/subject-icons`), which use the same tile.
 */
export function IconTileFrame({
  size = "md",
  className,
  children,
}: Omit<IconTileProps, "name"> & { children: ReactNode }) {
  return (
    <span
      aria-hidden="true"
      className={cx(
        "inline-flex shrink-0 items-center justify-center self-start rounded-lg bg-tone-tile-bg text-tone-tile-fg",
        "transition-colors duration-(--duration-feedback) ease-(--ease-standard)",
        "group-hover:bg-tone-action group-hover:text-tone-action-text",
        size === "sm" ? "size-9 rounded-md" : size === "md" ? "size-12" : "size-14",
        className,
      )}
    >
      {children}
    </span>
  );
}
