import { ctas, routes } from "@vitalos/cms";
import type { PublicationGates, SolutionView } from "@vitalos/cms";
import {
  Button,
  CaseStudyRow,
  Disclosure,
  IndustryRow,
  OfferRow,
  PracticeRow,
  ProcessJourney,
  isNonEmpty,
} from "@vitalos/ui";
import { RichText } from "../../components/rich-text";
import { PageMain } from "../../components/site-chrome/PageMain";
import { trail } from "../../lib/view-mapping/breadcrumbs";
import { contactHref, ctaToLink } from "../../lib/view-mapping/hrefs";
import { structuralLabels } from "../../lib/view-mapping/labels";
import { caseStudyMeta, toOfferRows, toRows } from "../../lib/view-mapping/patterns";
import {
  Band,
  ClosingAction,
  PageIntro,
  RowList,
  StatementList,
  gapBand,
  renderBands,
} from "../commercial/bands";

export interface SolutionTemplateProps {
  solution: SolutionView;
  gates: PublicationGates;
  draft: boolean;
}

export const solutionTrail = (solution: Pick<SolutionView, "title" | "slug">) =>
  trail(
    { label: structuralLabels.whatWeDo, path: routes.whatWeDo() },
    { label: structuralLabels.solutions, path: routes.solutions() },
    { label: solution.title, path: routes.solution(solution.slug) },
  );

/**
 * Solution page (Stage 9 section 22): the executive problem statement, signals, business impact,
 * approach, typical journey, offers and practices that deliver it, industries and work as proof,
 * and common questions. Sections without content are omitted (editor notice in Draft Mode).
 */
export function SolutionTemplate({ solution, gates, draft }: Readonly<SolutionTemplateProps>) {
  const cta = ctaToLink(solution.cta) ?? { label: ctas.primary, href: contactHref() };
  const stages = solution.phases.map((phase) => ({
    title: phase.title,
    ...(phase.description ? { summary: phase.description } : {}),
  }));
  const offerRows = toOfferRows(solution.offers);
  const practiceRows = toRows("practice", solution.practices);
  const industryRows = toRows("industry", solution.industries);
  const workRows = solution.work.flatMap((work) => {
    const [row] = toRows("caseStudy", [work], { meta: caseStudyMeta(work) });
    return row ? [row] : [];
  });

  return (
    <PageMain>
      <PageIntro
        crumbs={solutionTrail(solution)}
        eyebrow={structuralLabels.solutions}
        title={solution.title}
        lead={solution.problemStatement}
        actions={<Button href={cta.href}>{cta.label}</Button>}
      />
      {renderBands([
        (tone) =>
          solution.signals.length > 0 ? (
            <Band tone={tone} heading={structuralLabels.signals}>
              <StatementList items={solution.signals} />
            </Band>
          ) : (
            gapBand(draft, structuralLabels.signals, tone)
          ),
        (tone) =>
          solution.impact?.trim() ? (
            <Band tone={tone} heading={structuralLabels.impact}>
              <p className="m-0 max-w-(--container-prose) text-body-l text-tone-text text-pretty">
                {solution.impact}
              </p>
            </Band>
          ) : (
            gapBand(draft, structuralLabels.impact, tone)
          ),
        (tone) =>
          solution.approach && solution.approach.length > 0 ? (
            <Band tone={tone} heading={structuralLabels.approach}>
              <RichText value={solution.approach} />
            </Band>
          ) : (
            gapBand(draft, structuralLabels.approach, tone)
          ),
        (tone) =>
          isNonEmpty(stages) ? (
            <Band tone={tone} heading={structuralLabels.journey}>
              <ProcessJourney
                stages={stages}
                headingLevel={3}
                aria-label={structuralLabels.journey}
              />
            </Band>
          ) : (
            gapBand(draft, structuralLabels.journey, tone)
          ),
        (tone) =>
          offerRows.length > 0 ? (
            <Band tone={tone} heading={structuralLabels.relatedOffers}>
              <RowList>
                {offerRows.map((row) => (
                  <OfferRow key={row.href} {...row} />
                ))}
              </RowList>
            </Band>
          ) : (
            gapBand(draft, structuralLabels.relatedOffers, tone)
          ),
        (tone) =>
          practiceRows.length > 0 ? (
            <Band tone={tone} heading={structuralLabels.relatedPractices}>
              <RowList>
                {practiceRows.map((row) => (
                  <PracticeRow key={row.href} {...row} />
                ))}
              </RowList>
            </Band>
          ) : (
            gapBand(draft, structuralLabels.relatedPractices, tone)
          ),
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
        (tone) =>
          solution.faq.length > 0 ? (
            <Band tone={tone} heading={structuralLabels.questions}>
              <div className="grid max-w-(--container-content) gap-(--space-3)">
                {solution.faq.map((entry, index) => (
                  <Disclosure key={`${entry.question}-${index}`} summary={entry.question}>
                    <p className="m-0 max-w-(--container-prose) text-pretty">{entry.answer}</p>
                  </Disclosure>
                ))}
              </div>
            </Band>
          ) : null,
      ])}
      <ClosingAction link={cta} />
    </PageMain>
  );
}
