import type { ReactNode } from "react";
import { cx } from "../primitives/_internal/cx";
import { hasText } from "./_internal/types";

export interface ContentGapProps {
  /**
   * True only when draft mode is on. Anything else renders NOTHING, so a gap notice can never
   * reach a public visitor even if a template renders it unconditionally.
   */
  draft: boolean;
  /** What is missing, for example the section name and what it needs. */
  title: string;
  /** Guidance for the editor, plain text. */
  description?: string | undefined;
  /** Badge text. Defaults to a structural English label. */
  label?: string | undefined;
  /** Extra content. */
  children?: ReactNode;
  className?: string | undefined;
}

/** Editor-only notice that a section has no content yet (Stage 1 empty-content policy). */
export function ContentGap({
  draft,
  title,
  description,
  label = "Draft only",
  children,
  className,
}: ContentGapProps) {
  if (draft !== true || !hasText(title)) return null;
  return (
    <aside
      data-content-gap=""
      className={cx(
        "min-w-0 rounded-md border-2 border-dashed border-tone-heading bg-tone-bg p-(--space-5) text-tone-text",
        className,
      )}
    >
      <p className="m-0 text-eyebrow text-tone-muted uppercase">{label}</p>
      <p className="m-0 mt-(--space-2) text-body font-semibold text-tone-heading">{title}</p>
      {hasText(description) ? (
        <p className="m-0 mt-(--space-2) text-body text-tone-text">{description}</p>
      ) : null}
      {children ? <div className="mt-(--space-3)">{children}</div> : null}
    </aside>
  );
}
