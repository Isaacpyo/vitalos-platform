import { ctas, routes } from "@vitalos/cms";
import type { PracticeView, PublicationGates } from "@vitalos/cms";
import { Button, CaseStudyRow, IndustryRow, OfferRow, RelatedContentRail } from "@vitalos/ui";
import { RichText } from "../../components/rich-text";
import { PageMain } from "../../components/site-chrome/PageMain";
import { trail } from "../../lib/view-mapping/breadcrumbs";
import { contactHref, ctaToLink } from "../../lib/view-mapping/hrefs";
import { caseStudyMeta, toOfferRows, toRailItems, toRows } from "../../lib/view-mapping/patterns";
import { structuralLabels } from "../../lib/view-mapping/labels";
import {
  Band,
  ClosingAction,
  PageIntro,
  RowList,
  StatementList,
  itemLevel,
  renderBands,
} from "../commercial/bands";

export interface PracticeTemplateProps {
  practice: PracticeView;
  gates: PublicationGates;
}

/** The crumbs of a practice page. Also used for the page's BreadcrumbList. */
export const practiceTrail = (practice: Pick<PracticeView, "title" | "slug">) =>
  trail(
    { label: structuralLabels.whatWeDo, path: routes.whatWeDo() },
    { label: practice.title, path: routes.practice(practice.slug) },
  );

/**
 * Practice page (Stage 9 section 21): proposition, problems, capabilities, the practice's own
 * account of how it helps, related solutions and offers, industries and work as proof. One
 * template for all five practices; variation comes from content. A section without content is
 * omitted. Industries and Work appear only when their
 * publication gate is open, because their pages only exist then.
 */
export function PracticeTemplate({ practice, gates }: Readonly<PracticeTemplateProps>) {
  const cta = ctaToLink(practice.cta) ?? { label: ctas.primary, href: contactHref() };
  const solutionCards = toRailItems("solution", practice.solutions);
  const offerRows = toOfferRows(practice.offers);
  const industryRows = toRows("industry", practice.industries);
  const workRows = practice.work.flatMap((work) => {
    const [row] = toRows("caseStudy", [work], { meta: caseStudyMeta(work) });
    return row ? [row] : [];
  });

  return (
    <PageMain>
      <PageIntro
        crumbs={practiceTrail(practice)}
        eyebrow={structuralLabels.practices}
        title={practice.title}
        lead={practice.proposition}
        actions={<Button href={cta.href}>{cta.label}</Button>}
      />
      {renderBands([
        (tone) =>
          practice.problems.length > 0 ? (
            <Band tone={tone} heading={structuralLabels.problems}>
              <StatementList items={practice.problems} />
            </Band>
          ) : null,
        (tone) =>
          practice.capabilities.length > 0 ? (
            <Band tone={tone} heading={structuralLabels.capabilities}>
              <StatementList items={practice.capabilities} />
            </Band>
          ) : null,
        (tone) =>
          practice.body && practice.body.length > 0 ? (
            <Band tone={tone}>
              <RichText value={practice.body} />
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
                  <OfferRow
                    key={row.href}
                    {...row}
                    headingLevel={itemLevel(structuralLabels.relatedOffers)}
                  />
                ))}
              </RowList>
            </Band>
          ) : null,
        (tone) =>
          gates.open.industries && industryRows.length > 0 ? (
            <Band tone={tone} heading={structuralLabels.relatedIndustries}>
              <RowList>
                {industryRows.map((row) => (
                  <IndustryRow key={row.href} {...row} />
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
