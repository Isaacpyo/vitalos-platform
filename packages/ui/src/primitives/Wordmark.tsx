import type { ComponentPropsWithoutRef } from "react";
import { cx } from "./_internal/cx";

/** An exported logo asset. Dimensions are required so the slot never shifts layout. */
export interface WordmarkLogo {
  src: string;
  width: number;
  height: number;
  /** Accessible name; defaults to the wordmark text. */
  alt?: string;
}

export interface WordmarkProps extends Omit<ComponentPropsWithoutRef<"span">, "children"> {
  /**
   * Approved logo export (SVG from the Figma source). INTERIM: the production exports are not yet
   * available (docs/brand/asset-approval.md), so callers normally omit this and the text fallback
   * renders. Do not substitute raster files or hand-drawn marks.
   */
  logo?: WordmarkLogo;
  /** Fallback text. Defaults to "VITALOS". */
  text?: string;
  /** Wrap in a plain anchor, for example the header home link. */
  href?: string;
}

/**
 * An exported logo can carry large intrinsic dimensions (for example 2172x724). The width and
 * height attributes only reserve the aspect ratio; the rendered size is fixed by CSS: a 32px high
 * slot (the header and footer lockup height), width from the aspect ratio, never wider than 12rem
 * or the container.
 */
export const LOGO_IMAGE_CLASSES = "block h-8 w-auto max-w-48 object-contain object-left";

/** The VITALOS wordmark: a typed logo slot with a text fallback. */
export function Wordmark({ logo, text = "VITALOS", href, className, ...props }: WordmarkProps) {
  const mark = logo ? (
    <img
      src={logo.src}
      width={logo.width}
      height={logo.height}
      alt={logo.alt ?? text}
      className={LOGO_IMAGE_CLASSES}
    />
  ) : (
    <span className="text-body-l font-semibold tracking-widest text-tone-heading">{text}</span>
  );
  const body = href ? (
    <a href={href} className="inline-flex min-h-11 items-center no-underline">
      {mark}
    </a>
  ) : (
    mark
  );
  return (
    <span className={cx("inline-flex items-center", className)} {...props}>
      {body}
    </span>
  );
}
