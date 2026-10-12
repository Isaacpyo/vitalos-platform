import { ctas, routes } from "@vitalos/cms";
import type { OfferView } from "@vitalos/cms";
import { Button, DefinitionList, RelatedContentRail } from "@vitalos/ui";
import type { DefinitionItem } from "@vitalos/ui";
import { PageMain } from "../../components/site-chrome/PageMain";
import { trail } from "../../lib/view-mapping/breadcrumbs";
import { contactHref, ctaToLink } from "../../lib/view-mapping/hrefs";
import { durationLabel, structuralLabels } from "../../lib/view-mapping/labels";
import { toRailItems } from "../../lib/view-mapping/patterns";
import { Band, ClosingAction, PageIntro, StatementList, renderBands } from "../commercial/bands";

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
 * Offer page (Stage 9 section 22): the engagement summary as a definition list, what the client
 * receives, what is required from them, what is not included, and where the offer leads. The call
 * to action starts the enquiry with this offer pre-selected unless the CMS supplies its own.
 */
export function OfferTemplate({ offer }: Readonly<OfferTemplateProps>) {
  const cta = ctaToLink(offer.cta) ?? {
    label: ctas.primary,
    href: contactHref("offer", offer.slug),
  };
  const summary = engagementSummary(offer);
  const solutionCards = toRailItems("solution", offer.solutions);
  const practiceCards = toRailItems("practice", offer.practices);

  return (
    <PageMain>
      <PageIntro
        crumbs={offerTrail(offer)}
        eyebrow={structuralLabels.offers}
        title={offer.title}
        {...(offer.summary ? { lead: offer.summary } : {})}
        actions={<Button href={cta.href}>{cta.label}</Button>}
      />
      {renderBands([
        (tone) =>
          summary.length > 0 ? (
            <Band tone={tone} heading={structuralLabels.engagement}>
              <DefinitionList
                items={summary}
                className="max-w-(--container-content) border-b border-tone-border"
              />
            </Band>
          ) : null,
        (tone) =>
          offer.outputs.length > 0 ? (
            <Band tone={tone} heading={structuralLabels.outputs}>
              <StatementList items={offer.outputs} />
            </Band>
          ) : null,
        (tone) =>
          offer.requirements.length > 0 ? (
            <Band tone={tone} heading={structuralLabels.requirements}>
              <StatementList items={offer.requirements} />
            </Band>
          ) : null,
        (tone) =>
          offer.exclusions.length > 0 ? (
            <Band tone={tone} heading={structuralLabels.exclusions}>
              <StatementList items={offer.exclusions} />
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
          practiceCards ? (
            <Band tone={tone}>
              <RelatedContentRail
                heading={structuralLabels.relatedPractices}
                items={practiceCards}
              />
            </Band>
          ) : null,
      ])}
      <ClosingAction link={cta} />
    </PageMain>
  );
}
