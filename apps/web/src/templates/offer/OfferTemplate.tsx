import { ctas, isUnpublished, megaMenuColumns, routes } from "@vitalos/cms";
import type { OfferView } from "@vitalos/cms";
import { Button, DefinitionList, FeatureGrid, Icon } from "@vitalos/ui";
import type { DefinitionItem, IconName } from "@vitalos/ui";
import { MediaSlot } from "../../components/media-slot";
import { DraftNotice } from "../../components/placeholder-notice";
import { PageMain } from "../../components/site-chrome/PageMain";
import { isMediaSlotId } from "../../content/media-slots";
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

/** The duration category's label, with the finer duration beside it when there is one. */
export function offerDuration(offer: Pick<OfferView, "durationCategory" | "durationDetail">) {
  const category = durationLabel(offer.durationCategory);
  const detail = offer.durationDetail?.trim();
  return category && detail ? `${category} (${detail})` : (category ?? detail);
}

/** True for an offer in the points layout (Website Build Pack): short points instead of paragraphs. */
export const usesPoints = (offer: OfferView): boolean =>
  (offer.audiencePoints?.length ?? 0) > 0 || (offer.triggerPoints?.length ?? 0) > 0;

/** The offer's registered hero visual, if it has one (`offers.{slug}.visual`). */
const visualSlot = (slug: string) => {
  const id = `offers.${slug}.visual`;
  return isMediaSlotId(id) ? id : undefined;
};

/**
 * The engagement summary: who it is for, the trigger, scope, duration category and next step.
 * There is deliberately no price (Stage 8 section 12): offers are proposal-led.
 */
export function engagementSummary(offer: OfferView): DefinitionItem[] {
  const items: DefinitionItem[] = [
    { term: structuralLabels.audience, description: offer.audience },
    { term: structuralLabels.trigger, description: offer.trigger },
    { term: structuralLabels.scope, description: offer.scope },
    { term: structuralLabels.duration, description: offerDuration(offer) },
    { term: structuralLabels.nextStep, description: offer.nextStep },
  ];
  return items.filter(
    (item) => typeof item.description === "string" && item.description.trim() !== "",
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
  const cta = ctaToLink(offer.cta) ?? {
    label: ctas.primary,
    href: contactHref("offer", offer.slug),
  };
  const points = usesPoints(offer);
  const summary = points ? [] : engagementSummary(offer);
  const duration = offerDuration(offer);
  const visual = visualSlot(offer.slug);
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
          visual ? (
            <MediaSlot id={visual} priority />
          ) : (
            <OfferMark
              icon={iconFor("offer", offer.title)}
              {...(duration ? { fact: { label: structuralLabels.duration, value: duration } } : {})}
            />
          )
        }
      >
        {visual && duration ? <DurationFact value={duration} /> : null}
      </PageIntro>
      <DraftNotice show={isUnpublished(offer)} />
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
            points && (offer.audiencePoints?.length ?? 0) > 0 ? (
              <Band tone={tone} heading={structuralLabels.audience} eyebrow={offer.title}>
                <FeatureGrid
                  variant="rows"
                  items={statements(offer.audiencePoints ?? [], "building")}
                />
              </Band>
            ) : null,
          (tone) =>
            points && (offer.triggerPoints?.length ?? 0) > 0 ? (
              <Band tone={tone} heading={structuralLabels.trigger} eyebrow={offer.title}>
                <FeatureGrid
                  variant="rows"
                  items={statements(offer.triggerPoints ?? [], "target")}
                />
              </Band>
            ) : null,
          (tone) =>
            offer.outputs.length > 0 ? (
              <Band tone={tone} heading={structuralLabels.outputs} eyebrow={offer.title}>
                <FeatureGrid
                  variant="rows"
                  items={statements(offer.outputs, points ? "check" : undefined)}
                />
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
            (offer.work?.length ?? 0) > 0 ? (
              <Band tone={tone} heading={structuralLabels.work} eyebrow={offer.title}>
                <FeatureGrid
                  columns={2}
                  items={(offer.work ?? []).map((study) => ({
                    title: study.title,
                    ...(study.summary ? { text: study.summary } : {}),
                    icon: "document" as const,
                    href: routes.caseStudy(study.slug),
                  }))}
                />
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

/** The typical duration under the hero lead, when a visual takes the mark's place. */
function DurationFact({ value }: Readonly<{ value: string }>) {
  return (
    <p className="m-0 mt-(--space-5) inline-flex items-center gap-(--space-2) rounded-full border border-white/25 bg-white/10 px-(--space-4) py-(--space-2) text-small text-white">
      <Icon name="clock" size={16} />
      <span>
        <span className="font-semibold">{structuralLabels.duration}:</span> {value}
      </span>
    </p>
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
