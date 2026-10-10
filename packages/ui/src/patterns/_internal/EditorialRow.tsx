import type { ReactNode } from "react";
import { cx } from "../../primitives/_internal/cx";
import { Icon } from "../../primitives/Icon";
import { MetaRow, type MetaItem } from "../../primitives/MetaRow";
import { CardTitle } from "./CardTitle";
import { hasText, type ItemHeadingLevel } from "./types";

/** Props shared by the editorial rows (practice, offer, industry, article, case study, lab asset). */
export interface RowBaseProps {
  title: string;
  /** Destination. The title is the link; the whole row is its target. */
  href: string;
  summary?: string | undefined;
  /** Small classification above the title (format, sector, type). */
  eyebrow?: string | undefined;
  /** Labelled facts under the summary. Labels come from the caller. */
  meta?: readonly MetaItem[] | undefined;
  /** Outline level of the title. Defaults to 3. */
  headingLevel?: ItemHeadingLevel | undefined;
  className?: string | undefined;
}

interface EditorialRowProps extends RowBaseProps {
  /** Extra content in the title column, under the title (badge, status). */
  lead?: ReactNode;
  /** Extra content in the summary column, under the meta row. */
  children?: ReactNode;
  kind?: string;
}

/**
 * Rule-separated, content-first row (Stage 9 section 17 "Editorial row"). Two columns from md:
 * title, summary and facts. A single stretched link, long titles wrap, no image required.
 */
export function EditorialRow({
  title,
  href,
  summary,
  eyebrow,
  meta,
  headingLevel = 3,
  className,
  lead,
  children,
  kind,
}: EditorialRowProps) {
  return (
    <article
      {...(kind ? { "data-kind": kind } : {})}
      className={cx(
        "group relative grid gap-x-(--space-6) gap-y-(--space-3) border-t border-tone-border py-(--space-5)",
        "md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]",
        className,
      )}
    >
      <div className="min-w-0">
        {hasText(eyebrow) ? (
          <p className="mb-(--space-2) text-eyebrow text-tone-muted uppercase">{eyebrow}</p>
        ) : null}
        <CardTitle level={headingLevel} size="h3" href={href}>
          {title}
        </CardTitle>
        {lead ? <div className="mt-(--space-3)">{lead}</div> : null}
      </div>
      <div className="flex min-w-0 items-start justify-between gap-(--space-4)">
        <div className="min-w-0 flex-1">
          {hasText(summary) ? (
            <p className="text-body text-tone-text text-pretty">{summary}</p>
          ) : null}
          {meta && meta.length > 0 ? (
            <MetaRow items={meta} className={hasText(summary) ? "mt-(--space-3)" : ""} />
          ) : null}
          {children}
        </div>
        <Icon
          name="arrow-right"
          size={20}
          className="mt-(--space-1) shrink-0 text-tone-heading transition-transform duration-(--duration-feedback) ease-(--ease-standard) group-hover:translate-x-1"
        />
      </div>
    </article>
  );
}
