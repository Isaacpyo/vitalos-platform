import type { ReactNode } from "react";
import { cx } from "../../primitives/_internal/cx";
import { hasText } from "../_internal/types";

export interface TechnicalFigureProps {
  /**
   * REQUIRED text alternative that conveys what the diagram shows (components, flows, decisions).
   * It is the accessible name of the figure's media. A figure without one renders nothing: an
   * unlabelled technical diagram is not published.
   */
  textAlternative: string;
  /** A raster or vector image by URL. Its alt text IS `textAlternative`. */
  image?: { url: string; width: number; height: number } | undefined;
  /** Inline diagram (for example SVG). Exposed as one image named by `textAlternative`. */
  children?: ReactNode;
  /** Visible caption (figure number, title, source). */
  caption?: string | undefined;
  className?: string | undefined;
}

/** Framed reference-architecture or research diagram with a mandatory text alternative. */
export function TechnicalFigure({
  textAlternative,
  image,
  children,
  caption,
  className,
}: TechnicalFigureProps) {
  if (!hasText(textAlternative) || (!image && !children)) return null;
  return (
    <figure className={cx("m-0 min-w-0", className)}>
      <div className="overflow-hidden rounded-md border border-tone-border bg-tone-bg p-(--space-4)">
        {image ? (
          <img
            src={image.url}
            alt={textAlternative}
            width={image.width}
            height={image.height}
            loading="lazy"
            decoding="async"
            className="block h-auto w-full"
          />
        ) : (
          <div
            role="img"
            aria-label={textAlternative}
            className="[&_svg]:h-auto [&_svg]:max-w-full"
          >
            {children}
          </div>
        )}
      </div>
      {hasText(caption) ? (
        <figcaption className="mt-(--space-3) text-small text-tone-muted">{caption}</figcaption>
      ) : null}
    </figure>
  );
}
