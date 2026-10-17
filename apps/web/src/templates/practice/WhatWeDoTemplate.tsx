import {
  closedGates,
  ctas,
  megaMenuColumns,
  navLabels,
  offerNames,
  practiceNames,
  routes,
  solutionNames,
} from "@vitalos/cms";
import type {
  OfferSummary,
  PracticeSummary,
  PublicationGates,
  RoutePageView,
  SolutionSummary,
} from "@vitalos/cms";
import { Button, FeatureGrid, PracticeShowcase, SolutionShowcase } from "@vitalos/ui";
import type { ProcessCycleStage } from "@vitalos/ui";
import { PageMain } from "../../components/site-chrome/PageMain";
import { trail } from "../../lib/view-mapping/breadcrumbs";
import { ctaToLink, contactHref } from "../../lib/view-mapping/hrefs";
import { structuralLabels } from "../../lib/view-mapping/labels";
import { orderByLockedNames } from "../../lib/view-mapping/ordering";
import {
  offerFeatureItems,
  sixPracticeShowcaseItems,
  solutionShowcaseItems,
} from "../../lib/view-mapping/showcase";
import { Band, ClosingBand, PageIntro, renderBands } from "../commercial/bands";
import { bodyBands } from "../commercial/body-bands";
import { LifecycleBand, lifecycleHeading } from "../commercial/dark-bands";
import { heroArtwork } from "../../lib/view-mapping/hero-artwork";

export interface WhatWeDoTemplateProps {
  page: RoutePageView | null;
  practices: readonly PracticeSummary[];
  solutions: readonly SolutionSummary[];
  offers: readonly OfferSummary[];
  /** The How We Work introduction and its nine stages, for the lifecycle band. */
  howWeWorkIntro?: string | undefined;
  howWeWorkStages?: readonly ProcessCycleStage[] | undefined;
  /** Gates and the Labs page introduction, for Vitalos Labs as the sixth practice. */
  gates?: PublicationGates | undefined;
  labsIntro?: string | undefined;
}

export const whatWeDoTrail = () => trail({ label: navLabels.whatWeDo, path: routes.whatWeDo() });

/** The three layers, in the order the body lists them: practices, solutions, offers. */
const layerIcons = ["layers", "workflow", "document"] as const;

/**
 * What We Do (Stage 8 section 9), in the homepage's design (pages redesign, 15 Oct 2026): the dark
 * hero; the three layers as icon cards; the practices and solutions as the homepage showcases;
 * the offers as icon cards with their typical duration; the delivery lifecycle on the dark band
 * (linking to How We Work); the closing card. Heading and introduction come from the route page,
 * with the locked navigation label as the h1 fallback.
 */
export function WhatWeDoTemplate({
  page,
  practices,
  solutions,
  offers,
  howWeWorkIntro,
  howWeWorkStages,
  gates,
  labsIntro,
}: Readonly<WhatWeDoTemplateProps>) {
  const ordered = orderByLockedNames(practices, practiceNames);
  const practiceItems = sixPracticeShowcaseItems(ordered, {
    gates: gates ?? closedGates,
    intro: labsIntro,
  });
  const solutionItems = solutionShowcaseItems(orderByLockedNames(solutions, solutionNames));
  const offerItems = offerFeatureItems(orderByLockedNames(offers, offerNames));
  const primary = ctaToLink(page?.cta) ?? { label: ctas.primary, href: contactHref() };

  return (
    <PageMain>
      <PageIntro
        artwork={heroArtwork("what-we-do")}
        title={page?.heading ?? navLabels.whatWeDo}
        lead={page?.intro}
        actions={
          <Button href={primary.href} variant="secondary" size="lg" arrow>
            {primary.label}
          </Button>
        }
      />
      {renderBands(
        [
          ...bodyBands(page?.body, { listIcons: layerIcons }),
          (tone) =>
            practiceItems.length > 0 ? (
              <Band tone={tone} heading={structuralLabels.practices} eyebrow={navLabels.whatWeDo}>
                <PracticeShowcase items={practiceItems} />
              </Band>
            ) : null,
          (tone) =>
            solutionItems.length > 0 ? (
              <Band
                tone={tone}
                heading={structuralLabels.solutions}
                eyebrow={megaMenuColumns.solutions}
              >
                <SolutionShowcase items={solutionItems} />
              </Band>
            ) : null,
          (tone) =>
            offerItems.length > 0 ? (
              <Band tone={tone} heading={structuralLabels.offers} eyebrow={navLabels.whatWeDo}>
                <FeatureGrid items={offerItems} />
              </Band>
            ) : null,
          () =>
            lifecycleHeading && howWeWorkStages ? (
              <LifecycleBand
                title={lifecycleHeading}
                intro={howWeWorkIntro}
                stages={howWeWorkStages}
              />
            ) : null,
        ],
        "light",
      )}
      <ClosingBand primary={primary} secondary={null} />
    </PageMain>
  );
}
