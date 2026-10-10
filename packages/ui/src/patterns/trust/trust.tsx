import { useId } from "react";
import { cx } from "../../primitives/_internal/cx";
import { Button } from "../../primitives/Button";
import { DefinitionList, type DefinitionItem } from "../../primitives/DefinitionList";
import { Heading, type HeadingLevel } from "../../primitives/Heading";
import { Tag } from "../../primitives/Tag";
import { TextLink } from "../../primitives/TextLink";
import { DataTable } from "../_internal/DataTable";
import { EditorialRow, type RowBaseProps } from "../_internal/EditorialRow";
import { formatDate } from "../_internal/date";
import { hasText, type ItemHeadingLevel, type PatternLink } from "../_internal/types";

/* ---------- TrustTopicRow ---------- */

/** Matches TrustTopicSummary ({ title, summary }) plus `href`. */
export interface TrustTopicRowProps extends RowBaseProps {
  /** Current status in words, for example the review state. Real status only. */
  status?: string | undefined;
}

/** A Trust Centre topic as a row: precise, structured, no padlock graphics (Stage 9 section 27). */
export function TrustTopicRow({ status, ...row }: TrustTopicRowProps) {
  return (
    <EditorialRow
      kind="trust-topic"
      lead={hasText(status) ? <Tag>{status}</Tag> : undefined}
      {...row}
    />
  );
}

/* ---------- CertificationItem ---------- */

export interface CertificationItemProps {
  name: string;
  /** What the certification covers. A certification is never shown without its scope. */
  scope: string;
  /** ISO date. */
  issuedAt: string;
  /** ISO date. */
  expiresAt?: string | undefined;
  /** Link or request path to the evidence. */
  link?: PatternLink | undefined;
  /** Field labels. Defaults are structural English labels. */
  labels?:
    | { scope?: string | undefined; issued?: string | undefined; expires?: string | undefined }
    | undefined;
  locale?: string | undefined;
  headingLevel?: ItemHeadingLevel | undefined;
  className?: string | undefined;
}

/**
 * A verified certification: name, scope, issue and expiry dates (as machine-readable `<time>`) and
 * the link or request path. Pass only verified certifications; this component does not decide.
 */
export function CertificationItem({
  name,
  scope,
  issuedAt,
  expiresAt,
  link,
  labels,
  locale,
  headingLevel = 3,
  className,
}: CertificationItemProps) {
  if (!hasText(name) || !hasText(scope)) return null;
  const items: DefinitionItem[] = [
    { term: labels?.scope ?? "Scope", description: scope },
    {
      term: labels?.issued ?? "Issued",
      description: <time dateTime={issuedAt}>{formatDate(issuedAt, locale)}</time>,
    },
  ];
  if (hasText(expiresAt)) {
    items.push({
      term: labels?.expires ?? "Expires",
      description: <time dateTime={expiresAt}>{formatDate(expiresAt, locale)}</time>,
    });
  }
  return (
    <article
      data-kind="certification"
      className={cx("min-w-0 border-t border-tone-border pt-(--space-4)", className)}
    >
      <Heading level={headingLevel} size="h3">
        {name}
      </Heading>
      <DefinitionList items={items} className="mt-(--space-3)" />
      {link ? (
        <p className="m-0 mt-(--space-3)">
          <TextLink href={link.href}>{link.label}</TextLink>
        </p>
      ) : null}
    </article>
  );
}

/* ---------- PolicySummary ---------- */

export interface PolicySummaryProps {
  title: string;
  /** Short public position. */
  summary: string;
  /** ISO date of the last review. */
  lastReviewed?: string | undefined;
  lastReviewedLabel?: string | undefined;
  /** The full statement. */
  link?: PatternLink | undefined;
  locale?: string | undefined;
  headingLevel?: ItemHeadingLevel | undefined;
  className?: string | undefined;
}

/** Short public position with its last review date and a link to the full statement. */
export function PolicySummary({
  title,
  summary,
  lastReviewed,
  lastReviewedLabel = "Last reviewed",
  link,
  locale,
  headingLevel = 3,
  className,
}: PolicySummaryProps) {
  if (!hasText(title) || !hasText(summary)) return null;
  return (
    <article data-kind="policy" className={cx("min-w-0", className)}>
      <Heading level={headingLevel} size="h3">
        {title}
      </Heading>
      <p className="m-0 mt-(--space-3) max-w-(--container-prose) text-body text-tone-text text-pretty">
        {summary}
      </p>
      {hasText(lastReviewed) ? (
        <p className="m-0 mt-(--space-3) text-small text-tone-muted">
          <span className="font-medium">{lastReviewedLabel}:</span>{" "}
          <time dateTime={lastReviewed}>{formatDate(lastReviewed, locale)}</time>
        </p>
      ) : null}
      {link ? (
        <p className="m-0 mt-(--space-3)">
          <TextLink href={link.href}>{link.label}</TextLink>
        </p>
      ) : null}
    </article>
  );
}

/* ---------- EvidenceRequestCTA ---------- */

export interface EvidenceRequestCTAProps {
  heading: string;
  body?: string | undefined;
  /** The controlled request route (for example the procurement contact intent). Absent: nothing renders. */
  cta: PatternLink | undefined;
  headingLevel?: HeadingLevel | undefined;
  id?: string | undefined;
  className?: string | undefined;
}

/** Entry to the controlled evidence-request flow. Never links to the evidence itself. */
export function EvidenceRequestCTA({
  heading,
  body,
  cta,
  headingLevel = 2,
  id,
  className,
}: EvidenceRequestCTAProps) {
  const generatedId = useId();
  const headingId = id ?? generatedId;
  if (!cta || !hasText(heading)) return null;
  return (
    <section
      aria-labelledby={headingId}
      className={cx(
        "min-w-0 border-l-4 border-tone-accent py-(--space-2) pl-(--space-5)",
        className,
      )}
    >
      <Heading id={headingId} level={headingLevel} size="h3">
        {heading}
      </Heading>
      {hasText(body) ? (
        <p className="m-0 mt-(--space-3) max-w-(--container-prose) text-body text-tone-text text-pretty">
          {body}
        </p>
      ) : null}
      <div className="mt-(--space-4)">
        <Button href={cta.href} variant="secondary">
          {cta.label}
        </Button>
      </div>
    </section>
  );
}

/* ---------- SubprocessorTable ---------- */

export interface SubprocessorRow {
  name: string;
  purpose: string;
  location?: string | undefined;
}

export interface SubprocessorTableProps {
  caption: string;
  /** Renders nothing when empty. The location column appears only if some row has one. */
  rows: readonly SubprocessorRow[];
  /** Column headings. Defaults are structural English labels. */
  headings?:
    | {
        name?: string | undefined;
        purpose?: string | undefined;
        location?: string | undefined;
      }
    | undefined;
  className?: string | undefined;
}

/** Provider, purpose and (when known) location. Responsive: stacks below md. */
export function SubprocessorTable({ caption, rows, headings, className }: SubprocessorTableProps) {
  const valid = rows.filter((row) => hasText(row.name) && hasText(row.purpose));
  if (valid.length === 0 || !hasText(caption)) return null;
  const showLocation = valid.some((row) => hasText(row.location));
  const name = headings?.name ?? "Provider";
  const purpose = headings?.purpose ?? "Purpose";
  const location = headings?.location ?? "Location";
  return (
    <DataTable
      caption={caption}
      columns={showLocation ? [name, purpose, location] : [name, purpose]}
      rows={valid.map((row) =>
        showLocation ? [row.name, row.purpose, row.location ?? ""] : [row.name, row.purpose],
      )}
      className={className}
    />
  );
}
