import { cx } from "../../primitives/_internal/cx";

export type MediaPlaceholderVariant = 0 | 1 | 2 | 3;

export interface MediaPlaceholderProps {
  /** Varies the tint so neighbouring placeholders read as separate panels. */
  variant?: MediaPlaceholderVariant;
  className?: string | undefined;
}

const variants: Record<MediaPlaceholderVariant, string> = {
  0: "from-blue-50 via-blue-100 to-blue-50",
  1: "from-aqua-50 via-blue-50 to-blue-100",
  2: "from-cloud-50 via-border to-blue-50",
  3: "from-blue-100 via-blue-50 to-aqua-50",
};

/**
 * Decorative, token-only stand-in where the comp shows a photograph. No stock or comp imagery is
 * used: approved, rights-cleared photography arrives through the CMS (docs/brand/asset-approval.md).
 * Hidden from assistive technology and never placed under text. Fills its positioned parent
 * unless given a size.
 */
export function MediaPlaceholder({ variant = 0, className }: MediaPlaceholderProps) {
  return (
    <div
      aria-hidden="true"
      data-placeholder="media"
      className={cx("relative overflow-hidden bg-linear-135", variants[variant], className)}
    >
      {/* Fine diagonal rules, the comp's texture, drawn with the white token. */}
      <div className="absolute inset-0 bg-[repeating-linear-gradient(120deg,transparent_0_22px,var(--color-white)_22px_23px)] opacity-50" />
    </div>
  );
}
