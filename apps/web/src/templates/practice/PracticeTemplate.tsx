import { ctas, megaMenuColumns, navLabels, routes } from "@vitalos/cms";
import type { PracticeView, PublicationGates } from "@vitalos/cms";
import { Button, CaseStudyRow, FeatureGrid, SolutionShowcase } from "@vitalos/ui";
import { HeroImage } from "../../components/hero-image";
import { PageMain } from "../../components/site-chrome/PageMain";
import { trail } from "../../lib/view-mapping/breadcrumbs";
import { contactHref, ctaToLink } from "../../lib/view-mapping/hrefs";
import { iconFor } from "../../lib/view-mapping/icons";
import { caseStudyMeta, toRows } from "../../lib/view-mapping/patterns";
import { practiceImageFor } from "../../lib/view-mapping/practice-images";
import {
  industryShowcaseItems,
  offerFeatureItems,
  solutionShowcaseItems,
} from "../../lib/view-mapping/showcase";
import { structuralLabels } from "../../lib/view-mapping/labels";
import { Band, ClosingBand, PageIntro, RowList, renderBands } from "../commercial/bands";
import { bodyBands } from "../commercial/body-bands";
import { IndustryBand } from "../commercial/dark-bands";

/**
 * The AI & Data practice links to its division section, /ai-data (AID-002). The main site's
 * header menus are unchanged (ADR-031 owner direction); this band is the way in from here.
 */
export const AI_DATA_PRACTICE_SLUG = "ai-data";

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
 * Practice page (Stage 9 section 21) in the homepage's design (pages redesign, 15 Oct 2026): the
 * compact dark hero with the practice illustration; problems and capabilities as rows; the
 * practice's own account of how it helps as cards; related solutions as the showcase; offers as
 * icon cards; industries on the dark aurora band; work as proof; the closing card. One
 * template for all five practices; variation comes from content. A section without content is
 * omitted. Industries and Work appear only when their
 * publication gate is open, because their pages only exist then.
 */
export function PracticeTemplate({ practice, gates }: Readonly<PracticeTemplateProps>) {
  const cta = ctaToLink(practice.cta) ?? { label: ctas.primary, href: contactHref() };
  const solutionItems = solutionShowcaseItems(practice.solutions);
  const offerItems = offerFeatureItems(practice.offers);
  const industryItems = industryShowcaseItems(practice.industries);
  const workRows = practice.work.flatMap((work) => {
    const [row] = toRows("caseStudy", [work], { meta: caseStudyMeta(work) });
    return row ? [row] : [];
  });
  const image = practiceImageFor(practice.title);

  return (
    <PageMain>
      <PageIntro
        crumbs={practiceTrail(practice)}
        compact
        eyebrow={structuralLabels.practices}
        title={practice.title}
        lead={practice.proposition}
        actions={
          <Button href={cta.href} variant="secondary" size="lg" arrow>
            {cta.label}
          </Button>
        }
        media={image ? <HeroImage image={image} /> : undefined}
      />
      {renderBands(
        [
          (tone) =>
            practice.slug === AI_DATA_PRACTICE_SLUG ? (
              <Band
                tone={tone}
                spacing="compact"
                heading="Vitalos AI & Data has its own section"
                eyebrow="Applied AI & Data Engineering"
                intro="Concrete solutions for smaller businesses, how we work, and a reconciliation demonstrator on synthetic data."
              >
                <Button href={routes.aiData.home()} size="lg" arrow>
                  Visit Vitalos AI &amp; Data
                </Button>
              </Band>
            ) : null,
          (tone) =>
            practice.problems.length > 0 ? (
              <Band tone={tone} heading={structuralLabels.problems} eyebrow={practice.title}>
                <FeatureGrid variant="rows" items={practice.problems.map((text) => ({ text }))} />
              </Band>
            ) : null,
          (tone) =>
            practice.capabilities.length > 0 ? (
              <Band tone={tone} heading={structuralLabels.capabilities} eyebrow={practice.title}>
                <FeatureGrid
                  variant="rows"
                  items={practice.capabilities.map((text) => ({
                    text,
                    icon: iconFor("practice", practice.title),
                  }))}
                />
              </Band>
            ) : null,
          ...bodyBands(practice.body, {
            heading: structuralLabels.approach,
            eyebrow: practice.title,
          }),
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
        ],
        "light",
      )}
      <ClosingBand primary={cta} />
    </PageMain>
  );
}
