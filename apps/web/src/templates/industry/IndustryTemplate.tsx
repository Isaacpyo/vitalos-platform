import { ctas, routes } from "@vitalos/cms";
import type { IndustryView, PublicationGates } from "@vitalos/cms";
import { Button, CaseStudyRow, OfferRow, RelatedContentRail } from "@vitalos/ui";
import { PageMain } from "../../components/site-chrome/PageMain";
import { trail } from "../../lib/view-mapping/breadcrumbs";
import { contactHref, ctaToLink } from "../../lib/view-mapping/hrefs";
import { structuralLabels } from "../../lib/view-mapping/labels";
import { caseStudyMeta, toOfferRows, toRailItems, toRows } from "../../lib/view-mapping/patterns";
import {
  Band,
  ClosingAction,
  PageIntro,
  RowList,
  StatementList,
  renderBands,
} from "../commercial/bands";

export interface IndustryTemplateProps {
  industry: IndustryView;
  gates: PublicationGates;
}

export const industryTrail = (industry: Pick<IndustryView, "title" | "slug">) =>
  trail(
    { label: structuralLabels.industries, path: routes.industries() },
    { label: industry.title, path: routes.industry(industry.slug) },
  );

/**
 * Industry page (Stage 9 section 23): sector realities, priority problems, AI opportunities,
 * trust and regulatory considerations, and the solutions, offers, work and insights that relate.
 * Work and Insights appear only when their publication gates are open.
 */
export function IndustryTemplate({ industry, gates }: Readonly<IndustryTemplateProps>) {
  const cta = ctaToLink(industry.cta) ?? { label: ctas.primary, href: contactHref() };
  const solutionCards = toRailItems("solution", industry.solutions);
  const offerRows = toOfferRows(industry.offers);
  const workRows = industry.work.flatMap((work) => {
    const [row] = toRows("caseStudy", [work], { meta: caseStudyMeta(work) });
    return row ? [row] : [];
  });

  return (
    <PageMain>
      <PageIntro
        crumbs={industryTrail(industry)}
        eyebrow={structuralLabels.industries}
        title={industry.title}
        {...(industry.summary ? { lead: industry.summary } : {})}
        actions={<Button href={cta.href}>{cta.label}</Button>}
      />
      {renderBands([
        (tone) =>
          industry.realities.length > 0 ? (
            <Band tone={tone} heading={structuralLabels.realities}>
              <StatementList items={industry.realities} />
            </Band>
          ) : null,
        (tone) =>
          industry.problems.length > 0 ? (
            <Band tone={tone} heading={structuralLabels.industryProblems}>
              <StatementList items={industry.problems} />
            </Band>
          ) : null,
        (tone) =>
          industry.aiOpportunities.length > 0 ? (
            <Band tone={tone} heading={structuralLabels.aiOpportunities}>
              <StatementList items={industry.aiOpportunities} />
            </Band>
          ) : null,
        (tone) =>
          industry.considerations.length > 0 ? (
            <Band tone={tone} heading={structuralLabels.considerations}>
              <StatementList items={industry.considerations} />
            </Band>
          ) : null,
        (tone) =>
          solutionCards ? (
            <Band tone={tone}>
              <RelatedContentRail
                heading={structuralLabels.relatedSolutions}
                items={solutionCards}
              />
            </Band>
          ) : null,
        (tone) =>
          offerRows.length > 0 ? (
            <Band tone={tone} heading={structuralLabels.relatedOffers}>
              <RowList>
                {offerRows.map((row) => (
                  <OfferRow key={row.href} {...row} />
                ))}
              </RowList>
            </Band>
          ) : null,
        (tone) =>
          gates.open.work && workRows.length > 0 ? (
            <Band tone={tone} heading={structuralLabels.selectedWork}>
              <RowList>
                {workRows.map((row) => (
                  <CaseStudyRow key={row.href} {...row} />
                ))}
              </RowList>
            </Band>
          ) : null,
      ])}
      <ClosingAction link={cta} />
    </PageMain>
  );
}
