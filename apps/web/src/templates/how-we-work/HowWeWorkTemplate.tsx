import { ctas, howWeWorkStages, navLabels, routes } from "@vitalos/cms";
import type { RoutePageView } from "@vitalos/cms";
import { Button, ProcessJourney, isNonEmpty } from "@vitalos/ui";
import { lifecycleStages } from "../../lib/view-mapping/showcase";
import { PageMain } from "../../components/site-chrome/PageMain";
import { trail } from "../../lib/view-mapping/breadcrumbs";
import { contactHref, ctaToLink } from "../../lib/view-mapping/hrefs";
import { structuralLabels } from "../../lib/view-mapping/labels";
import { deriveStages, stageAnchor } from "../../lib/view-mapping/stages";
import { Band, ClosingBand, PageIntro, renderBands } from "../commercial/bands";
import { bodyBands } from "../commercial/body-bands";
import { LifecycleBand, lifecycleHeading } from "../commercial/dark-bands";

export interface HowWeWorkTemplateProps {
  page: RoutePageView | null;
}

export const howWeWorkTrail = () =>
  trail(
    { label: structuralLabels.whatWeDo, path: routes.whatWeDo() },
    { label: navLabels.howWeWork, path: routes.howWeWork() },
  );

/**
 * How We Work (Stage 8 section 17). The nine stages and their order are locked copy (Qualify to
 * Improve); the description of each stage is authored in the CMS route page body, under a heading
 * named after the stage (see `deriveStages`). A stage the editors have not described still shows
 * its name; no description is generated. The page works without a CMS route page. In the
 * homepage's design (pages redesign, 15 Oct 2026): the full dark hero, the lifecycle ring on the
 * dark band, each stage in detail (anchored), then the closing card.
 */
export function HowWeWorkTemplate({ page }: Readonly<HowWeWorkTemplateProps>) {
  const cta = ctaToLink(page?.cta) ?? { label: ctas.primary, href: contactHref() };
  const { stages: derived, lead } = deriveStages(page?.body, howWeWorkStages);
  // Each stage carries its anchor, so the homepage lifecycle ring can link to it.
  const stages = derived.map((stage) => ({ ...stage, id: stageAnchor(stage.title) }));

  return (
    <PageMain>
      <PageIntro
        crumbs={howWeWorkTrail()}
        title={page?.heading ?? navLabels.howWeWork}
        {...(page?.intro ? { lead: page.intro } : {})}
        actions={
          <Button href={cta.href} variant="secondary" size="lg" arrow>
            {cta.label}
          </Button>
        }
      />
      {renderBands(
        [
          () =>
            lifecycleHeading ? (
              <LifecycleBand
                title={lifecycleHeading}
                // Titles and discs only: each stage's description follows in full below, once.
                stages={lifecycleStages()}
                action={null}
                label={lifecycleHeading}
              />
            ) : null,
          ...bodyBands(lead),
          (tone) =>
            isNonEmpty(stages) ? (
              <Band tone={tone}>
                <ProcessJourney stages={stages} headingLevel={2} aria-label={navLabels.howWeWork} />
              </Band>
            ) : null,
        ],
        "light",
      )}
      <ClosingBand primary={cta} />
    </PageMain>
  );
}
