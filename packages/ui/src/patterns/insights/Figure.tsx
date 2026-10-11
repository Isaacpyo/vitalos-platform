import type { ReactNode } from "react";
import { cx } from "../../primitives/_internal/cx";
import { PatternMedia } from "../_internal/Media";
import { hasText, type PatternImage } from "../_internal/types";

export interface FigureProps {
  /** Matches ImageView: `alt` is required unless `decorative`. */
  image?: PatternImage | undefined;
  /** Non-image media (for example inline SVG). Give it an accessible name yourself. */
  children?: ReactNode;
  caption?: string | undefined;
  className?: string | undefined;
}

/** Editorial figure: media with an optional caption and credit. Nothing renders without media. */
export function Figure({ image, children, caption, className }: FigureProps) {
  if (!image && !children) return null;
  return (
    <figure className={cx("m-0 min-w-0", className)}>
      {image ? <PatternMedia image={image} className="rounded-md" /> : children}
      {hasText(caption) || hasText(image?.credit) ? (
        <figcaption className="mt-(--space-3) text-small text-tone-muted">
          {hasText(caption) ? caption : null}
          {hasText(caption) && hasText(image?.credit) ? " " : null}
          {hasText(image?.credit) ? <span>{image.credit}</span> : null}
        </figcaption>
      ) : null}
    </figure>
  );
}
