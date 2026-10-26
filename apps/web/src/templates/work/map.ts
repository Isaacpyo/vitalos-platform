import { hrefForDocument, isUnpublished, productBySlug, productPath, routes } from "@vitalos/cms";
import type {
  CaseStudyView,
  EngagementBasis,
  PracticeSummary,
  PublicationGates,
  SolutionSummary,
  TestimonialView,
} from "@vitalos/cms";
import { isNonEmpty } from "@vitalos/ui";
import type {
  CaseStudyRowProps,
  LinkCardProps,
  MetaItem,
  NonEmptyArray,
  OutcomeStatItem,
} from "@vitalos/ui";
import { buildFilterGroups } from "../institutional/list-filter-model";
import type { FilterDimension, FilterGroup } from "../institutional/list-filter-model";

/**
 * Case study view model to pattern props. Pure and framework-free.
 *
 * Proof rules enforced here, on top of the mappers in `@vitalos/cms` (Stage 10 §17):
 *  - only case studies with verified evidence are public Work;
 *  - a client is named only when the view says "named", carries a name AND records the date of
 *    the client's written permission; anonymised studies never show a name, even if one is
 *    present on the view;
 *  - metrics need a source, a verifier and verified evidence, on the metric and on the case study;
 *  - a testimonial is shown only for a named client with verified evidence and a recorded
 *    permission date (an attributed quote would otherwise identify an anonymised client).
 */

/** Stage 10 §17 (Evidence rule): contracted by Vitalos, or prior founder/team experience. */
export const engagementBasisLabels: Record<EngagementBasis, string> = {
  "contracted-by-vitalos": "Contracted by Vitalos",
  "prior-team-experience": "Prior founder / team experience",
  "vitalos-product": "Built and run by Vitalos",
};

/** Structural field labels (Stage 8 §14 table: Context, Client evidence). */
export const workLabels = {
  client: "Client",
  anonymisedClient: "Anonymised",
  engagement: "Engagement",
  sector: "Sector",
  challenge: "Challenge",
  approach: "Approach",
  outcome: "Outcome",
  related: "Related",
  practice: "Practice",
  solution: "Solution",
  industry: "Industry",
  offer: "Offer",
  product: "Product",
  highlights: "Highlights",
} as const;

export const isVerifiedProof = (study: CaseStudyView): boolean =>
  study.evidence.status === "verified";

/**
 * Whether a case study has a page and a place in the Work index: verified evidence, an
 * illustrative placeholder scenario, or an unpublished draft. Placeholders exist only in the draft
 * content source (ADR-025) and unpublished documents only outside production (Website Build Pack,
 * 25 Oct 2026); production serves neither.
 */
export const isPublicCaseStudy = (study: CaseStudyView): boolean =>
  isVerifiedProof(study) || study.placeholder === true || isUnpublished(study);

/** The named client, or undefined when the client is anonymised or unnamed. */
export function namedClient(study: CaseStudyView): string | undefined {
  if (study.clientDisplay !== "named" || !study.clientPermission?.trim()) return undefined;
  const name = study.clientName?.trim();
  return name ? name : undefined;
}

export function engagementLabel(study: CaseStudyView): string {
  // A placeholder scenario describes no engagement, so it must not claim a basis.
  if (study.placeholder === true) return "Illustrative scenario (placeholder)";
  return engagementBasisLabels[study.engagementBasis];
}

/** Sourced, verified metrics, or undefined when there is nothing publishable. */
export function verifiedMetrics(study: CaseStudyView): NonEmptyArray<OutcomeStatItem> | undefined {
  if (!isVerifiedProof(study)) return undefined;
  const items: OutcomeStatItem[] = study.metrics
    .filter(
      (metric) =>
        metric.evidence?.status === "verified" &&
        metric.source.trim() !== "" &&
        (metric.verifiedBy?.trim() ?? "") !== "" &&
        metric.value.trim() !== "" &&
        metric.descriptor.trim() !== "",
    )
    .map((metric) => ({
      value: metric.value,
      descriptor: metric.descriptor,
      source: metric.source,
      ...(metric.context ? { context: metric.context } : {}),
      ...(metric.timeframe ? { timeframe: metric.timeframe } : {}),
      evidence: { status: "verified" as const },
    }));
  return isNonEmpty(items) ? items : undefined;
}

/** The testimonial, only for a named client with verified evidence. */
export function publishableTestimonial(study: CaseStudyView): TestimonialView | undefined {
  if (
    !study.testimonial ||
    !isVerifiedProof(study) ||
    namedClient(study) === undefined ||
    !study.testimonial.permissionDate?.trim()
  ) {
    return undefined;
  }
  return study.testimonial.quote.trim() !== "" && study.testimonial.attribution.trim() !== ""
    ? study.testimonial
    : undefined;
}

/** Labelled facts for a case study: client (named or "Anonymised"), engagement basis, sector. */
export function caseStudyFacts(study: CaseStudyView): MetaItem[] {
  // A product story has no client: its engagement fact says it is built and run by Vitalos.
  const client: MetaItem[] =
    study.kind === "product"
      ? []
      : [{ label: workLabels.client, value: namedClient(study) ?? workLabels.anonymisedClient }];
  return [...client, { label: workLabels.engagement, value: engagementLabel(study) }];
}

/** Props for one row of the Work index. */
export function caseStudyRowProps(study: CaseStudyView): Omit<CaseStudyRowProps, "headingLevel"> {
  const metrics = verifiedMetrics(study);
  return {
    title: study.title,
    href: routes.caseStudy(study.slug),
    ...(study.summary ? { summary: study.summary } : {}),
    ...(study.sector ? { eyebrow: study.sector } : {}),
    meta: caseStudyFacts(study),
    ...(metrics ? { metrics } : {}),
  };
}

const option = (item: { slug: string; title: string }) => ({
  value: item.slug,
  label: item.title,
});

/** Filter dimensions for the Work index (Stage 8 §14: Industry, Solution, Practice). */
export const workFilterDimensions: readonly FilterDimension<CaseStudyView>[] = [
  { key: "practice", label: workLabels.practice, valuesOf: (s) => s.practices.map(option) },
  { key: "solution", label: workLabels.solution, valuesOf: (s) => s.solutions.map(option) },
  { key: "industry", label: workLabels.industry, valuesOf: (s) => s.industries.map(option) },
];

export function workFilterGroups(studies: readonly CaseStudyView[]): FilterGroup[] {
  return buildFilterGroups(studies, workFilterDimensions);
}

type RelatedLink = LinkCardProps;

/**
 * Related practices, solutions and industries as link cards. Industries only when their section
 * is public, so a case study never links into a closed (noindex) section.
 */
export function relatedLinks(study: CaseStudyView, gates: PublicationGates): RelatedLink[] {
  const practice = (p: PracticeSummary): RelatedLink => ({
    kind: "practice",
    title: p.title,
    href: hrefForDocument({ kind: "practice", slug: p.slug }),
    ...(p.summary ? { summary: p.summary } : {}),
    eyebrow: workLabels.practice,
  });
  const solution = (s: SolutionSummary): RelatedLink => ({
    kind: "solution",
    title: s.title,
    href: hrefForDocument({ kind: "solution", slug: s.slug }),
    ...(s.summary ? { summary: s.summary } : {}),
    eyebrow: workLabels.solution,
  });
  const industries: RelatedLink[] = gates.open.industries
    ? study.industries.map((i) => ({
        kind: "practice" as const,
        title: i.title,
        href: hrefForDocument({ kind: "industry", slug: i.slug }),
        ...(i.summary ? { summary: i.summary } : {}),
        eyebrow: workLabels.industry,
      }))
    : [];
  const offers: RelatedLink[] = (study.offers ?? []).map((o) => ({
    kind: "solution" as const,
    title: o.title,
    href: hrefForDocument({ kind: "offer", slug: o.slug }),
    ...(o.summary ? { summary: o.summary } : {}),
    eyebrow: workLabels.offer,
  }));
  const products: RelatedLink[] = (study.products ?? []).flatMap((slug) => {
    const product = productBySlug(slug);
    return product
      ? [
          {
            kind: "practice" as const,
            title: product.name,
            href: productPath(product),
            summary: product.summary,
            eyebrow: workLabels.product,
          },
        ]
      : [];
  });
  return [
    ...products,
    ...offers,
    ...study.practices.map(practice),
    ...study.solutions.map(solution),
    ...industries,
  ];
}
