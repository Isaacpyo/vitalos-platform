import { ctas, megaMenuColumns, navLabels, routes } from "@vitalos/cms";
import type { PublicationGates, SolutionView } from "@vitalos/cms";
import {
  Button,
  CaseStudyRow,
  Disclosure,
  FeatureGrid,
  LineDiagram,
  ProcessJourney,
  isNonEmpty,
} from "@vitalos/ui";
import { PageMain } from "../../components/site-chrome/PageMain";
import { trail } from "../../lib/view-mapping/breadcrumbs";
import { contactHref, ctaToLink } from "../../lib/view-mapping/hrefs";
import { iconFor } from "../../lib/view-mapping/icons";
import { structuralLabels } from "../../lib/view-mapping/labels";
import { caseStudyMeta, toRows } from "../../lib/view-mapping/patterns";
import { industryShowcaseItems, offerFeatureItems } from "../../lib/view-mapping/showcase";
import { heroArtwork } from "../../lib/view-mapping/hero-artwork";
import { solutionDiagramFor } from "../../lib/view-mapping/solution-diagrams";
import { Band, ClosingBand, PageIntro, RowList, renderBands } from "../commercial/bands";
import { bodyBands } from "../commercial/body-bands";
import { IndustryBand } from "../commercial/dark-bands";

export interface SolutionTemplateProps {
  solution: SolutionView;
  gates: PublicationGates;
}

export const solutionTrail = (solution: Pick<SolutionView, "title" | "slug">) =>
  trail(
    { label: structuralLabels.whatWeDo, path: routes.whatWeDo() },
    { label: structuralLabels.solutions, path: routes.solutions() },
    { label: solution.title, path: routes.solution(solution.slug) },
  );

/**
 * Solution page (Stage 9 section 22) in the homepage's design (pages redesign, 15 Oct 2026): the
 * compact dark hero with the solution's line diagram (ADR-044); signals; business impact; approach; the
 * typical journey on a dark band; offers and practices as icon cards; industries on the dark
 * aurora band; work as proof; common questions; the closing card. Empty sections are omitted.
 */
export function SolutionTemplate({ solution, gates }: Readonly<SolutionTemplateProps>) {
  const cta = ctaToLink(solution.cta) ?? { label: ctas.primary, href: contactHref() };
  const stages = solution.phases.map((phase) => ({
    title: phase.title,
    ...(phase.description ? { summary: phase.description } : {}),
  }));
  const offerItems = offerFeatureItems(solution.offers);
  const practiceItems = toRows("practice", solution.practices).map((row) => ({
    title: row.title,
    href: row.href,
    ...(row.summary ? { text: row.summary } : {}),
    icon: iconFor("practice", row.title),
  }));
  const industryItems = industryShowcaseItems(solution.industries);
  const workRows = solution.work.flatMap((work) => {
    const [row] = toRows("caseStudy", [work], { meta: caseStudyMeta(work) });
    return row ? [row] : [];
  });
  const diagram = solutionDiagramFor(solution.title);

  return (
    <PageMain>
      <PageIntro
        crumbs={solutionTrail(solution)}
        compact
        eyebrow={structuralLabels.solutions}
        title={solution.title}
        lead={solution.problemStatement}
        actions={
          <Button href={cta.href} variant="secondary" size="lg" arrow>
            {cta.label}
          </Button>
        }
        artwork={heroArtwork("what-we-do", solution.slug)}
        media={
          diagram ? (
            <span className="ml-auto block aspect-square w-full max-w-[22rem] rounded-2xl border border-tone-border bg-tone-bg p-(--space-7)">
              <LineDiagram name={diagram} className="size-full" />
            </span>
          ) : undefined
        }
      />
      {renderBands(
        [
          (tone) =>
            solution.signals.length > 0 ? (
              <Band tone={tone} heading={structuralLabels.signals} eyebrow={solution.title}>
                <FeatureGrid variant="rows" items={solution.signals.map((text) => ({ text }))} />
              </Band>
            ) : null,
          (tone) =>
            solution.impact?.trim() ? (
              <Band tone={tone} heading={structuralLabels.impact} eyebrow={solution.title}>
                <p className="m-0 max-w-(--container-prose) text-body-l text-tone-text text-pretty">
                  {solution.impact}
                </p>
              </Band>
            ) : null,
          ...bodyBands(solution.approach, {
            heading: structuralLabels.approach,
            eyebrow: solution.title,
          }),
          () =>
            isNonEmpty(stages) ? (
              <Band tone="dark" heading={structuralLabels.journey} eyebrow={solution.title}>
                <ProcessJourney
                  stages={stages}
                  headingLevel={3}
                  aria-label={structuralLabels.journey}
                />
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
            practiceItems.length > 0 ? (
              <Band
                tone={tone}
                heading={structuralLabels.relatedPractices}
                eyebrow={megaMenuColumns.practices}
              >
                <FeatureGrid items={practiceItems} columns={practiceItems.length === 4 ? 4 : 3} />
              </Band>
            ) : null,
          () =>
            gates.open.industries && industryItems.length > 0 ? (
              <IndustryBand title={structuralLabels.relatedIndustries} items={industryItems} />
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
              <Band tone={tone} heading={structuralLabels.questions} eyebrow={solution.title}>
                <div className="grid max-w-(--container-content) gap-(--space-3)">
                  {solution.faq.map((entry, index) => (
                    <Disclosure key={`${entry.question}-${index}`} summary={entry.question}>
                      <p className="m-0 max-w-(--container-prose) text-pretty">{entry.answer}</p>
                    </Disclosure>
                  ))}
                </div>
              </Band>
            ) : null,
        ],
        "light",
      )}
      <ClosingBand primary={cta} />
    </PageMain>
  );
}
