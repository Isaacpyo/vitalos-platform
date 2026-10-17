import { ctas, megaMenuColumns, routes } from "@vitalos/cms";
import type { OfferView } from "@vitalos/cms";
import { contactNextSteps } from "@vitalos/cms/repo";
import { Button, DefinitionList, FeatureGrid, Icon, ProcessJourney } from "@vitalos/ui";
import type { DefinitionItem, IconName, JourneyStage } from "@vitalos/ui";
import { PageMain } from "../../components/site-chrome/PageMain";
import { trail } from "../../lib/view-mapping/breadcrumbs";
import { contactHref, ctaToLink } from "../../lib/view-mapping/hrefs";
import { durationLabel, structuralLabels } from "../../lib/view-mapping/labels";
import { iconFor } from "../../lib/view-mapping/icons";
import { toRows } from "../../lib/view-mapping/patterns";
import { Band, ClosingBand, PageIntro, renderBands } from "../commercial/bands";

export interface OfferTemplateProps {
  offer: OfferView;
}

export const offerTrail = (offer: Pick<OfferView, "title" | "slug">) =>
  trail(
    { label: structuralLabels.whatWeDo, path: routes.whatWeDo() },
    { label: structuralLabels.offers, path: routes.offers() },
    { label: offer.title, path: routes.offer(offer.slug) },
  );

/**
 * The engagement summary: who it is for, the trigger, scope, duration category and next step.
 * There is deliberately no price (Stage 8 section 12): offers are proposal-led.
 */
export function engagementSummary(offer: OfferView): DefinitionItem[] {
  const items: DefinitionItem[] = [
    { term: structuralLabels.audience, description: offer.audience },
    { term: structuralLabels.trigger, description: offer.trigger },
    { term: structuralLabels.scope, description: offer.scope },
    { term: structuralLabels.duration, description: durationLabel(offer.durationCategory) },
    { term: structuralLabels.nextStep, description: offer.nextStep },
  ];
  return items.filter(
    (item) => typeof item.description === "string" && item.description.trim() !== "",
  );
}

/**
 * What happens next on an offer page (finding B9, 17 Oct 2026): the enquiry (the contact page's
 * own sentence), the offer's own scope, then its next phase, each from existing copy. No duration
 * or price is stated: none has an approved source (docs/review-2026-10-17/ws2/NOTES.md).
 */
export function offerNextSteps(offer: OfferView): JourneyStage[] {
  const steps: { title: string; summary: string | undefined }[] = [
    { title: ctas.primary, summary: contactNextSteps[1] },
    { title: offer.title, summary: offer.scope },
    { title: structuralLabels.nextPhase, summary: offer.nextStep },
  ];
  return steps.flatMap((step) =>
    step.summary && step.summary.trim() !== ""
      ? [{ title: step.title, summary: step.summary }]
      : [],
  );
}

/**
 * Offer page (Stage 9 section 22) in the homepage's design (pages redesign, 15 Oct 2026): the
 * compact dark hero with the offer's mark, the engagement summary as a definition list, what the
 * client receives, what is required from them, what is not included (rows), and where the offer
 * leads (icon cards), then the closing card. The call
 * to action starts the enquiry with this offer pre-selected unless the CMS supplies its own.
 */
export function OfferTemplate({ offer }: Readonly<OfferTemplateProps>) {
  const cta = ctaToLink(offer.cta, { offerSlug: offer.slug }) ?? {
    label: ctas.primary,
    href: contactHref("offer", offer.slug),
  };
  const summary = engagementSummary(offer);
  const [firstStep, ...otherSteps] = offerNextSteps(offer);
  const duration = durationLabel(offer.durationCategory);
  const related = (kind: "solution" | "practice", items: OfferView["solutions"]) =>
    toRows(kind, items).map((row) => ({
      title: row.title,
      href: row.href,
      ...(row.summary ? { text: row.summary } : {}),
      icon: iconFor(kind, row.title),
    }));
  const solutionItems = related("solution", offer.solutions);
  const practiceItems = related("practice", offer.practices);
  const statements = (items: readonly string[], icon?: IconName) =>
    items.map((text) => ({ text, ...(icon ? { icon } : {}) }));

  return (
    <PageMain>
      <PageIntro
        crumbs={offerTrail(offer)}
        compact
        eyebrow={structuralLabels.offers}
        title={offer.title}
        {...(offer.summary ? { lead: offer.summary } : {})}
        actions={
          <Button href={cta.href} variant="secondary" size="lg" arrow>
            {cta.label}
          </Button>
        }
        media={
          <OfferMark
            icon={iconFor("offer", offer.title)}
            {...(duration ? { fact: { label: structuralLabels.duration, value: duration } } : {})}
          />
        }
      />
      {renderBands(
        [
          (tone) =>
            summary.length > 0 ? (
              <Band tone={tone} heading={structuralLabels.engagement} eyebrow={offer.title}>
                <DefinitionList
                  items={summary}
                  className="max-w-(--container-content) border-b border-tone-border"
                />
              </Band>
            ) : null,
          (tone) =>
            firstStep ? (
              <Band tone={tone} heading={structuralLabels.whatHappensNext} eyebrow={offer.title}>
                <ProcessJourney
                  stages={[firstStep, ...otherSteps]}
                  aria-label={structuralLabels.whatHappensNext}
                />
              </Band>
            ) : null,
          (tone) =>
            offer.outputs.length > 0 ? (
              <Band tone={tone} heading={structuralLabels.outputs} eyebrow={offer.title}>
                <FeatureGrid variant="rows" items={statements(offer.outputs)} />
              </Band>
            ) : null,
          (tone) =>
            offer.requirements.length > 0 ? (
              <Band tone={tone} heading={structuralLabels.requirements} eyebrow={offer.title}>
                <FeatureGrid variant="rows" items={statements(offer.requirements, "users")} />
              </Band>
            ) : null,
          (tone) =>
            offer.exclusions.length > 0 ? (
              <Band tone={tone} heading={structuralLabels.exclusions} eyebrow={offer.title}>
                <FeatureGrid variant="rows" items={statements(offer.exclusions, "minus")} />
              </Band>
            ) : null,
          (tone) =>
            solutionItems.length > 0 ? (
              <Band
                tone={tone}
                heading={structuralLabels.relatedSolutions}
                eyebrow={megaMenuColumns.solutions}
              >
                <FeatureGrid items={solutionItems} />
              </Band>
            ) : null,
          (tone) =>
            practiceItems.length > 0 ? (
              <Band
                tone={tone}
                heading={structuralLabels.relatedPractices}
                eyebrow={megaMenuColumns.practices}
              >
                <FeatureGrid items={practiceItems} />
              </Band>
            ) : null,
        ],
        "light",
      )}
      <ClosingBand primary={cta} />
    </PageMain>
  );
}

/**
 * The offer's mark beside the hero copy: its icon on a frosted panel with the typical duration,
 * in the hero panel's style. Decorative apart from the fact, which is also in the summary below.
 */
function OfferMark({
  icon,
  fact,
}: Readonly<{ icon: IconName; fact?: { label: string; value: string } }>) {
  return (
    <div className="relative mx-auto grid aspect-square w-full max-w-sm place-items-center overflow-hidden rounded-3xl border border-white/20 bg-white/10 backdrop-blur-xl">
      <span
        aria-hidden="true"
        className="absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,color-mix(in_srgb,var(--color-blue-600)_45%,transparent),transparent_65%)]"
      />
      <span
        aria-hidden="true"
        className="relative inline-flex size-28 items-center justify-center rounded-3xl bg-white text-blue-600 shadow-floating"
      >
        <Icon name={icon} size={32} className="scale-150" />
      </span>
      {fact ? (
        <p className="absolute inset-x-(--space-5) bottom-(--space-5) m-0 rounded-xl bg-white/90 px-(--space-4) py-(--space-3) text-center text-small text-midnight-950">
          <span className="font-semibold">{fact.label}:</span> {fact.value}
        </p>
      ) : null}
    </div>
  );
}
