/**
 * View model to pattern props. Pure functions; no React, no I/O.
 *
 * `@vitalos/ui` patterns take plain props and never import `@vitalos/cms`; the pages of the web app
 * translate view models into those props here, so every template maps the same way. Rules:
 *
 *  - Every href comes from routes.ts (`hrefForSummary`). A summary that cannot be resolved to a
 *    route yields `null` and the caller drops it: no dead or guessed link is ever rendered.
 *  - Nothing is added: titles and summaries pass through; labels of facts are structural
 *    (labels.ts); there is no price, no invented metric, no logo that was not approved.
 *  - Images pass only when the URL is one the CSP allows (Sanity CDN or same-site).
 */
import type {
  CaseStudySummary,
  DocKind,
  ImageView,
  InsightSummary,
  LabAssetSummary,
  OfferSummary,
  OutcomeMetricView,
  PersonSummary,
  ProofItemView,
  SummaryFor,
} from "@vitalos/cms";
import { labMaturityLabels, labTypeLabels } from "@vitalos/cms";
import { isNonEmpty } from "@vitalos/ui";
import type {
  ArticleRowProps,
  ItemHeadingLevel,
  LinkCardKind,
  LinkCardProps,
  MaturityKey,
  MetaItem,
  NonEmptyArray,
  OutcomeStatItem,
  PatternImage,
  PersonCardProps,
  PracticeRowProps,
  ProofStripItem,
  SolutionCardProps,
} from "@vitalos/ui";
import { classifyImageUrl } from "../cms/images";
import { hrefForSummary } from "./hrefs";
import { durationLabel, engagementBasisLabel, structuralLabels } from "./labels";

export type RowProps = PracticeRowProps;

export interface MapOptions {
  eyebrow?: string | undefined;
  meta?: readonly MetaItem[] | undefined;
  headingLevel?: ItemHeadingLevel | undefined;
}

const imageScope = () => ({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || undefined,
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET || undefined,
});

/** An approved image as pattern media, or undefined when it cannot be shown (alt text, CSP). */
export function toPatternImage(image: ImageView | undefined): PatternImage | undefined {
  if (!image) return undefined;
  if (!image.decorative && image.alt.trim() === "") return undefined;
  if (!(image.width > 0) || !(image.height > 0)) return undefined;
  if (classifyImageUrl(image.url, imageScope()) === null) return undefined;
  return {
    url: image.url,
    alt: image.alt,
    ...(image.decorative ? { decorative: true } : {}),
    width: image.width,
    height: image.height,
    ...(image.credit ? { credit: image.credit } : {}),
  };
}

/** Row props for any summary kind (PracticeRow, OfferRow, IndustryRow, ... share them). */
export function toRow<K extends DocKind>(
  kind: K,
  summary: SummaryFor<K>,
  options: MapOptions = {},
): RowProps | null {
  const href = hrefForSummary(kind, summary);
  const s = summary as unknown as { title?: string; summary?: string };
  if (!href || !s.title?.trim()) return null;
  return {
    title: s.title,
    href,
    ...(s.summary ? { summary: s.summary } : {}),
    ...(options.eyebrow ? { eyebrow: options.eyebrow } : {}),
    ...(options.meta && options.meta.length > 0 ? { meta: options.meta } : {}),
    ...(options.headingLevel ? { headingLevel: options.headingLevel } : {}),
  };
}

/** Rows for a list of summaries; unresolvable ones are dropped. */
export function toRows<K extends DocKind>(
  kind: K,
  summaries: readonly SummaryFor<K>[],
  options: MapOptions = {},
): RowProps[] {
  return summaries.flatMap((summary) => {
    const row = toRow(kind, summary, options);
    return row ? [row] : [];
  });
}

/** Offer row: title, summary and the duration category as a labelled fact. No price, ever. */
export function toOfferRow(summary: OfferSummary, options: MapOptions = {}): RowProps | null {
  const duration = durationLabel(summary.durationCategory);
  const meta: MetaItem[] = [
    ...(options.meta ?? []),
    ...(duration ? [{ label: structuralLabels.duration, value: duration }] : []),
  ];
  return toRow("offer", summary, { ...options, meta });
}

export function toOfferRows(
  summaries: readonly OfferSummary[],
  options: MapOptions = {},
): RowProps[] {
  return summaries.flatMap((summary) => {
    const row = toOfferRow(summary, options);
    return row ? [row] : [];
  });
}

/** Solution card props. */
export function toSolutionCard(
  summary: SummaryFor<"solution">,
  options: MapOptions = {},
): SolutionCardProps | null {
  return toRow("solution", summary, options);
}

const linkCardKinds: Partial<Record<DocKind, LinkCardKind>> = {
  practice: "practice",
  solution: "solution",
  caseStudy: "case-study",
  insight: "insight",
  labAsset: "lab",
};

/** Related-content card for the kinds `LinkCard` supports; null for any other kind or link. */
export function toLinkCard<K extends DocKind>(
  kind: K,
  summary: SummaryFor<K>,
  options: MapOptions = {},
): LinkCardProps | null {
  const cardKind = linkCardKinds[kind];
  const row = toRow(kind, summary, options);
  return cardKind && row ? { ...row, kind: cardKind } : null;
}

/** Cards for a related-content rail, or undefined when there is nothing to show. */
export function toRailItems<K extends DocKind>(
  kind: K,
  summaries: readonly SummaryFor<K>[],
  options: MapOptions = {},
): NonEmptyArray<LinkCardProps> | undefined {
  const items = summaries.flatMap((summary) => {
    const card = toLinkCard(kind, summary, options);
    return card ? [card] : [];
  });
  return isNonEmpty(items) ? items : undefined;
}

/** Facts shown with a case-study summary: client label and the engagement basis, stated plainly. */
export function caseStudyMeta(summary: CaseStudySummary): MetaItem[] {
  return [
    ...(summary.clientLabel
      ? [{ label: structuralLabels.client, value: summary.clientLabel }]
      : []),
    {
      label: structuralLabels.engagementBasis,
      value: engagementBasisLabel(summary.engagementBasis),
    },
  ];
}

/** Lab asset facts: the lab type is the eyebrow, maturity is stated in words. */
export function labAssetPresentation(summary: LabAssetSummary): {
  eyebrow: string;
  maturity: MaturityKey;
  maturityLabel: string;
} {
  return {
    eyebrow: labTypeLabels[summary.labType],
    maturity: summary.maturity,
    maturityLabel: labMaturityLabels[summary.maturity],
  };
}

/** Insight eyebrow: the format as authored (an enum key from the CMS). */
export function insightEyebrow(summary: InsightSummary): string | undefined {
  const format = summary.format.trim();
  if (!format) return undefined;
  // Studio stores formats as kebab-case keys ("executive-briefing"); show them as words.
  const words = format.replace(/-/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** A sourced metric as an outcome stat. Unsourced or unverified ones are filtered by the pattern. */
export function toOutcomeStat(metric: OutcomeMetricView): OutcomeStatItem {
  return {
    value: metric.value,
    descriptor: metric.descriptor,
    source: metric.source,
    ...(metric.context ? { context: metric.context } : {}),
    ...(metric.timeframe ? { timeframe: metric.timeframe } : {}),
    ...(metric.evidence ? { evidence: { status: metric.evidence.status } } : {}),
  };
}

export function toOutcomeStats(
  metrics: readonly OutcomeMetricView[],
): NonEmptyArray<OutcomeStatItem> | undefined {
  const stats = metrics.map(toOutcomeStat);
  return isNonEmpty(stats) ? stats : undefined;
}

/**
 * Proof strip items from the home page's proof markers. Only verified markers pass (the mapper
 * already drops the rest; this keeps the rule at the boundary too). Undefined when none remain,
 * so the strip is never rendered empty.
 */
export function toProofStripItems(
  proof: readonly ProofItemView[],
): NonEmptyArray<ProofStripItem> | undefined {
  const items = proof
    .filter((item) => item.evidence.status === "verified" && item.label.trim() !== "")
    .map((item): ProofStripItem => ({
      label: item.label,
      ...(item.href ? { href: item.href } : {}),
      evidence: { status: item.evidence.status },
    }));
  return isNonEmpty(items) ? items : undefined;
}

/** Article row: format as eyebrow, author names as plain text (the row is one link), date. */
export function toArticleRow(
  summary: InsightSummary,
  options: MapOptions = {},
): ArticleRowProps | null {
  const row = toRow("insight", summary, { eyebrow: insightEyebrow(summary), ...options });
  if (!row) return null;
  return {
    ...row,
    authors: summary.authors.map((author) => ({ name: author.title })),
    publishedAt: summary.publishedAt,
  };
}

/** Person card: the profile link, role and portrait (only an approved, renderable one). */
export function toPersonCard(
  summary: PersonSummary,
  options: Pick<MapOptions, "headingLevel"> = {},
): PersonCardProps | null {
  const href = hrefForSummary("person", summary);
  if (!href || !summary.title.trim()) return null;
  const portrait = toPatternImage(summary.portrait);
  return {
    name: summary.title,
    href,
    ...(summary.role ? { role: summary.role } : {}),
    ...(portrait ? { portrait } : {}),
    ...(options.headingLevel ? { headingLevel: options.headingLevel } : {}),
  };
}
