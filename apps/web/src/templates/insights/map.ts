import { routes } from "@vitalos/cms";
import type { InsightSummary, InsightView, PersonSummary } from "@vitalos/cms";
import type { ArticleRowProps, AuthorLink, PersonCardProps } from "@vitalos/ui";
import { toPatternImage } from "../institutional/images";
import { buildFilterGroups } from "../institutional/list-filter-model";
import type { FilterDimension, FilterGroup } from "../institutional/list-filter-model";
import { formatLabel, insightLabels, topicLabel } from "./labels";

/** Insight view models to pattern props. Pure and framework-free. */

/** Newest first; undated pieces last. Stable for equal dates. */
export function sortByPublishedDesc<T extends { publishedAt: string }>(items: readonly T[]): T[] {
  const time = (value: string) => (Number.isNaN(Date.parse(value)) ? -Infinity : Date.parse(value));
  return [...items].sort((a, b) => time(b.publishedAt) - time(a.publishedAt));
}

/** An insight is a serious publication only with a named author (Stage 10 §18). */
export const hasNamedAuthor = (insight: { authors: readonly PersonSummary[] }): boolean =>
  insight.authors.some((author) => author.title.trim() !== "");

/** Authors with profile links. Used on the article page, where links do not nest in a card. */
export function authorLinks(authors: readonly PersonSummary[]): AuthorLink[] {
  return authors
    .filter((author) => author.title.trim() !== "")
    .map((author) => ({ name: author.title, href: routes.person(author.slug) }));
}

type RowSource = Pick<InsightSummary, "title" | "slug" | "summary" | "format" | "publishedAt"> & {
  authors: readonly PersonSummary[];
  updatedAt?: string | undefined;
};

/** Props for an insight row or feature (the author names are plain text inside a linked card). */
export function insightCardProps(insight: RowSource): Omit<ArticleRowProps, "headingLevel"> {
  return {
    title: insight.title,
    href: routes.insight(insight.slug),
    ...(insight.summary ? { summary: insight.summary } : {}),
    eyebrow: formatLabel(insight.format),
    authors: insight.authors
      .filter((author) => author.title.trim() !== "")
      .map((author) => ({ name: author.title })),
    publishedAt: insight.publishedAt,
    ...(insight.updatedAt ? { updatedAt: insight.updatedAt } : {}),
  };
}

export function authorCardProps(author: PersonSummary): Omit<PersonCardProps, "headingLevel"> {
  const portrait = toPatternImage(author.portrait);
  return {
    name: author.title,
    href: routes.person(author.slug),
    ...(author.role ? { role: author.role } : {}),
    ...(portrait ? { portrait } : {}),
  };
}

/** Topic filter for the Insights index (Stage 9 §25: topic navigation). */
export const insightFilterDimensions: readonly FilterDimension<InsightView>[] = [
  {
    key: "topic",
    label: insightLabels.topic,
    valuesOf: (insight) =>
      insight.topics
        .filter((t) => t.trim() !== "")
        .map((t) => ({ value: t, label: topicLabel(t) })),
  },
];

export function insightFilterGroups(insights: readonly InsightView[]): FilterGroup[] {
  return buildFilterGroups(insights, insightFilterDimensions);
}
