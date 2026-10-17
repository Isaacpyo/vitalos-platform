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
   * Approved logo export. The Figma SVG exports are not yet available, so the site header and
   * footer pass the owner-directed interim raster lockups (docs/brand/asset-approval.md). Do not
   * substitute any other raster file or a hand-drawn mark.
   */
  logo?: WordmarkLogo;
  /** Shown instead of `logo` inside a dark tone scope (`data-tone="dark"`), for example white. */
  darkLogo?: WordmarkLogo | undefined;
  /**
   * The symbol alone, for a crowded bar: below 25rem it replaces the logo (which is then drawn
   * 24px high up to 28rem), so the header's action and menu still fit at 320px. It must read on
   * light and dark surfaces alike.
   */
  compactLogo?: WordmarkLogo | undefined;
  /** Fallback text. Defaults to "VITALOS". */
  text?: string;
  /** Wrap in a plain anchor, for example the header home link. */
  href?: string;
  /**
   * Accessible name of the link when `href` is given (WCAG 2.4.4). Default "Vitalos home": the
   * images inside the link are then decorative, so a screen reader hears one clear name instead
   * of the letters of the wordmark.
   */
  linkLabel?: string;
}

/**
 * An exported logo can carry large intrinsic dimensions (for example 2172x724). The width and
 * height attributes only reserve the aspect ratio; the rendered size is fixed by CSS: a 32px high
 * slot (the header and footer lockup height), width from the aspect ratio, never wider than 12rem
 * or the container.
 */
const LOGO_SIZE_CLASSES = "h-8 w-auto max-w-48 object-contain object-left";
export const LOGO_IMAGE_CLASSES = `block ${LOGO_SIZE_CLASSES}`;

/** The VITALOS wordmark: a typed logo slot with a text fallback. */
export function Wordmark({
  logo,
  darkLogo,
  compactLogo,
  text = "VITALOS",
  href,
  linkLabel = "Vitalos home",
  className,
  ...props
}: WordmarkProps) {
  const image = (asset: WordmarkLogo, classes: string) => (
    <img
      src={asset.src}
      width={asset.width}
      height={asset.height}
      // Inside a named link the image is decorative; on its own it names the brand.
      alt={href ? "" : (asset.alt ?? text)}
      className={classes}
    />
  );
  // With a compact mark the lockup steps down to 24px below 28rem and gives way to the mark
  // below 25rem (`!` so it also beats the dark-scope rule below).
  const size = compactLogo
    ? cx(LOGO_SIZE_CLASSES, "max-[27.99rem]:h-6 max-[24.99rem]:hidden!")
    : LOGO_SIZE_CLASSES;
  // With a dark-surface logo, a dark tone scope around the wordmark decides which of the two is
  // drawn. Every image not drawn is display:none, so only one is ever in the accessibility tree.
  const mark = logo ? (
    <>
      {darkLogo ? (
        <>
          {image(logo, cx(size, "block [[data-tone=dark]_&]:hidden"))}
          {image(darkLogo, cx(size, "hidden [[data-tone=dark]_&]:block"))}
        </>
      ) : (
        image(logo, cx(size, "block"))
      )}
      {compactLogo
        ? image(compactLogo, "hidden h-8 w-auto object-contain max-[24.99rem]:block")
        : null}
    </>
  ) : (
    <span className="text-body-l font-semibold tracking-widest text-tone-heading">{text}</span>
  );
  const body = href ? (
    <a href={href} aria-label={linkLabel} className="inline-flex min-h-11 items-center no-underline">
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
