import { cx } from "../../primitives/_internal/cx";
import { Icon } from "../../primitives/Icon";
import { CardTitle } from "../_internal/CardTitle";
import { EditorialRow, type RowBaseProps } from "../_internal/EditorialRow";
import { PatternMedia } from "../_internal/Media";
import { hasText, type ItemHeadingLevel, type PatternImage } from "../_internal/types";
import { AuthorMeta, type AuthorMetaProps } from "./AuthorMeta";

type ArticleMeta = Pick<
  AuthorMetaProps,
  "authors" | "publishedAt" | "updatedAt" | "readTime" | "labels" | "locale"
>;

/** Matches InsightSummary plus `href`. `eyebrow` carries the format or topic label. */
export interface ArticleRowProps extends RowBaseProps, ArticleMeta {}

/** An insight as an editorial row. Author names are plain text here (the row is one link). */
export function ArticleRow({
  authors,
  publishedAt,
  updatedAt,
  readTime,
  labels,
  locale,
  ...row
}: ArticleRowProps) {
  return (
    <EditorialRow kind="insight" {...row}>
      <AuthorMeta
        authors={authors?.map((author) => ({ name: author.name }))}
        publishedAt={publishedAt}
        updatedAt={updatedAt}
        readTime={readTime}
        labels={labels}
        locale={locale}
        className="mt-(--space-3)"
      />
    </EditorialRow>
  );
}

export interface ArticleFeatureProps extends ArticleMeta {
  title: string;
  href: string;
  summary?: string | undefined;
  /** Format or topic label. */
  eyebrow?: string | undefined;
  /** Optional. The feature is complete without an image. */
  image?: PatternImage | undefined;
  headingLevel?: ItemHeadingLevel | undefined;
  className?: string | undefined;
}

/** The featured insight on an index page: large title and summary, optional image. */
export function ArticleFeature({
  title,
  href,
  summary,
  eyebrow,
  image,
  authors,
  publishedAt,
  updatedAt,
  readTime,
  labels,
  locale,
  headingLevel = 2,
  className,
}: ArticleFeatureProps) {
  return (
    <article
      data-kind="insight"
      className={cx(
        "group relative grid min-w-0 gap-(--space-5) border-y border-tone-border py-(--space-6)",
        image ? "lg:grid-cols-2 lg:items-center" : "",
        className,
      )}
    >
      {image ? <PatternMedia image={image} className="rounded-md" /> : null}
      <div className="flex min-w-0 flex-col gap-(--space-4)">
        {hasText(eyebrow) ? (
          <p className="text-eyebrow text-tone-muted uppercase">{eyebrow}</p>
        ) : null}
        <CardTitle level={headingLevel} size="h2" href={href}>
          {title}
        </CardTitle>
        {hasText(summary) ? (
          <p className="max-w-(--container-prose) text-body-l text-tone-text text-pretty">
            {summary}
          </p>
        ) : null}
        <AuthorMeta
          authors={authors?.map((author) => ({ name: author.name }))}
          publishedAt={publishedAt}
          updatedAt={updatedAt}
          readTime={readTime}
          labels={labels}
          locale={locale}
        />
        <Icon
          name="arrow-right"
          size={24}
          className="self-start text-tone-heading transition-transform duration-(--duration-feedback) ease-(--ease-standard) group-hover:translate-x-1"
        />
      </div>
    </article>
  );
}
