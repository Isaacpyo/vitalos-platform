import { cx } from "../../primitives/_internal/cx";
import type { PatternImage } from "./types";

/** Plain `<img>` with intrinsic dimensions (no layout shift). The web app may wrap or replace it. */
export function PatternMedia({ image, className }: { image: PatternImage; className?: string }) {
  return (
    <img
      src={image.url}
      alt={image.decorative ? "" : image.alt}
      width={image.width}
      height={image.height}
      loading="lazy"
      decoding="async"
      className={cx("block h-auto w-full object-cover", className)}
    />
  );
}
