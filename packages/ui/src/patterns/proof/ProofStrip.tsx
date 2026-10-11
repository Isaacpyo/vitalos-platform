import { cx } from "../../primitives/_internal/cx";
import { PatternMedia } from "../_internal/Media";
import { hasText, isNonEmpty, type NonEmptyArray, type PatternImage } from "../_internal/types";

/** Matches ProofItemView: a verified marker, never an invented logo. */
export interface ProofStripItem {
  label: string;
  href?: string | undefined;
  /** Optional approved logo. The label is always rendered as text beside or instead of it. */
  logo?: PatternImage | undefined;
  /** When present, only `verified` items render. */
  evidence?: { status: "verified" | "pending" | "n/a" } | undefined;
}

export interface ProofStripProps {
  /**
   * Verified proof markers. The type requires at least one; items with unverified evidence are
   * dropped and the strip renders NOTHING if none remain. Empty or invented proof strips are
   * prohibited (Stage 9 section 18).
   */
  items: NonEmptyArray<ProofStripItem>;
  /** Visible lead-in, supplied by the caller. Also names the list. */
  label?: string | undefined;
  className?: string | undefined;
}

/** Compact row of verified proof: certifications, outcomes, partnerships, client marks. */
export function ProofStrip({ items, label, className }: ProofStripProps) {
  if (!isNonEmpty(items)) return null;
  const shown = items.filter(
    (item) =>
      hasText(item.label) && (item.evidence === undefined || item.evidence.status === "verified"),
  );
  if (shown.length === 0) return null;
  return (
    <div className={cx("min-w-0", className)}>
      {hasText(label) ? (
        <p className="mb-(--space-3) text-eyebrow text-tone-muted uppercase">{label}</p>
      ) : null}
      <ul
        {...(hasText(label) ? { "aria-label": label } : {})}
        className="m-0 flex list-none flex-wrap items-center gap-x-(--space-6) gap-y-(--space-3) p-0"
      >
        {shown.map((item, index) => {
          const content = (
            <span className="inline-flex items-center gap-(--space-3)">
              {item.logo ? (
                <PatternMedia image={item.logo} className="h-8 w-auto max-w-32 object-contain" />
              ) : null}
              <span className="text-body font-medium">{item.label}</span>
            </span>
          );
          return (
            <li key={`${item.label}-${index}`} className="min-w-0 text-tone-heading">
              {item.href ? (
                <a
                  href={item.href}
                  className="text-tone-heading underline underline-offset-4 hover:text-tone-link-hover"
                >
                  {content}
                </a>
              ) : (
                content
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
