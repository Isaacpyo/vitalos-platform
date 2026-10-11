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

/** The VITALOS wordmark: a typed logo slot with a text fallback. */
export function Wordmark({ logo, text = "VITALOS", href, className, ...props }: WordmarkProps) {
  const mark = logo ? (
    <img
      src={logo.src}
      width={logo.width}
      height={logo.height}
      alt={logo.alt ?? text}
      className="block h-auto max-w-full"
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
