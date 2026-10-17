import { ctas, megaMenuColumns, navLabels, routes } from "@vitalos/cms";
import type { IndustryView, PublicationGates } from "@vitalos/cms";
import { Button, CaseStudyRow, FeatureGrid, SolutionShowcase } from "@vitalos/ui";
import type { IconName } from "@vitalos/ui";
import { PageMain } from "../../components/site-chrome/PageMain";
import { trail } from "../../lib/view-mapping/breadcrumbs";
import { contactHref, ctaToLink } from "../../lib/view-mapping/hrefs";
import { industryArtworkFor } from "../../lib/view-mapping/industry-artwork";
import { structuralLabels } from "../../lib/view-mapping/labels";
import { caseStudyMeta, toRows } from "../../lib/view-mapping/patterns";
import { offerFeatureItems, solutionShowcaseItems } from "../../lib/view-mapping/showcase";
import { Band, ClosingBand, PageIntro, RowList, renderBands } from "../commercial/bands";

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
 * Industry page (Stage 9 section 23) in the homepage's design (pages redesign, 15 Oct 2026): the
 * compact dark hero with the sector's artwork (ADR-044); sector realities and considerations as rows;
 * priority problems as cards; AI opportunities as cards on a dark band; related solutions as the
 * showcase and offers as icon cards; work (only when its gate is open); the closing card.
 * Insights live in the content admin and are not linked from industry pages.
 */
export function IndustryTemplate({ industry, gates }: Readonly<IndustryTemplateProps>) {
  const cta = ctaToLink(industry.cta) ?? { label: ctas.primary, href: contactHref() };
  const solutionItems = solutionShowcaseItems(industry.solutions);
  const offerItems = offerFeatureItems(industry.offers);
  const workRows = industry.work.flatMap((work) => {
    const [row] = toRows("caseStudy", [work], { meta: caseStudyMeta(work) });
    return row ? [row] : [];
  });
  const items = (texts: readonly string[], icon?: IconName) =>
    texts.map((text) => ({ text, ...(icon ? { icon } : {}) }));

  return (
    <PageMain>
      <PageIntro
        crumbs={industryTrail(industry)}
        compact
        eyebrow={structuralLabels.industries}
        title={industry.title}
        {...(industry.summary ? { lead: industry.summary } : {})}
        actions={
          <Button href={cta.href} variant="secondary" size="lg" arrow>
            {cta.label}
          </Button>
        }
        artwork={industryArtworkFor(industry.title)}
      />
      {renderBands(
        [
          (tone) =>
            industry.realities.length > 0 ? (
              <Band tone={tone} heading={structuralLabels.realities} eyebrow={industry.title}>
                <FeatureGrid variant="rows" items={items(industry.realities)} />
              </Band>
            ) : null,
          (tone) =>
            industry.problems.length > 0 ? (
              <Band
                tone={tone}
                heading={structuralLabels.industryProblems}
                eyebrow={industry.title}
              >
                <FeatureGrid items={items(industry.problems, "target")} />
              </Band>
            ) : null,
          () =>
            industry.aiOpportunities.length > 0 ? (
              <Band tone="dark" heading={structuralLabels.aiOpportunities} eyebrow={industry.title}>
                <FeatureGrid items={items(industry.aiOpportunities, "chip")} />
              </Band>
            ) : null,
          (tone) =>
            industry.considerations.length > 0 ? (
              <Band tone={tone} heading={structuralLabels.considerations} eyebrow={industry.title}>
                <FeatureGrid variant="rows" items={items(industry.considerations, "shield")} />
              </Band>
            ) : null,
          (tone) =>
            solutionItems.length > 0 ? (
              <Band
                tone={tone}
                heading={structuralLabels.relatedSolutions}
                eyebrow={megaMenuColumns.solutions}
              >
                <SolutionShowcase items={solutionItems} />
              </Band>
            ) : null,
          (tone) =>
            offerItems.length > 0 ? (
              <Band
                tone={tone}
                heading={structuralLabels.relatedOffers}
                eyebrow={navLabels.whatWeDo}
              >
                <FeatureGrid items={offerItems} />
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
        ],
        "light",
      )}
      <ClosingBand primary={cta} />
    </PageMain>
  );
}
