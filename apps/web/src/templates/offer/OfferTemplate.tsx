import { ctas, megaMenuColumns, routes } from "@vitalos/cms";
import type { OfferView } from "@vitalos/cms";
import { Button, DefinitionList, FeatureGrid } from "@vitalos/ui";
import type { DefinitionItem, IconName } from "@vitalos/ui";
import { PageMain } from "../../components/site-chrome/PageMain";
import { trail } from "../../lib/view-mapping/breadcrumbs";
import { contactHref, ctaToLink } from "../../lib/view-mapping/hrefs";
import { heroArtwork } from "../../lib/view-mapping/hero-artwork";
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

/** The facts the hero's engagement panel carries, so the summary band below does not repeat them. */
const heroTerms: ReadonlySet<string> = new Set([
  structuralLabels.audience,
  structuralLabels.duration,
  structuralLabels.nextStep,
]);

/** How many of the offer's outputs the hero panel lists; the full list follows in its band. */
const HERO_OUTPUTS = 3;

/**
 * Offer page (Stage 9 section 22): a reading page, so the light compact hero (ADR-044) with the
 * What We Do family's artwork in the offer's own variant and, beside the copy, the engagement
 * panel (finding A7): typical duration, who it is for, what you receive and how it connects to the
 * next phase, all from the offer's own fields (nothing is added when a field is empty). Then the
 * rest of the engagement summary as a definition list, what the client receives, what is required
 * from them, what is not included (rows), and where the offer leads (icon cards), then the closing
 * card. The call to action starts the enquiry with this offer pre-selected unless the CMS supplies
 * its own.
 */
export function OfferTemplate({ offer }: Readonly<OfferTemplateProps>) {
  const cta = ctaToLink(offer.cta) ?? {
    label: ctas.primary,
    href: contactHref("offer", offer.slug),
  };
  const summary = engagementSummary(offer).filter((item) => !heroTerms.has(item.term));
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
        tone="light"
        artwork={heroArtwork("what-we-do", offer.slug)}
        eyebrow={structuralLabels.offers}
        title={offer.title}
        {...(offer.summary ? { lead: offer.summary } : {})}
        actions={
          <Button href={cta.href} size="lg" arrow>
            {cta.label}
          </Button>
        }
        media={<EngagementPanel offer={offer} />}
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
 * The engagement panel beside the offer's hero copy (finding A7, ADR-044): the facts a buyer looks
 * for first, from the offer's own fields. A field that is empty is left out; with none at all the
 * panel is not rendered. Real content, so it is a named region for assistive technology.
 */
export function EngagementPanel({ offer }: Readonly<{ offer: OfferView }>) {
  const duration = durationLabel(offer.durationCategory);
  const outputs = offer.outputs.filter((item) => item.trim() !== "").slice(0, HERO_OUTPUTS);
  const facts: { term: string; value: string | readonly string[] }[] = [];
  if (duration) facts.push({ term: structuralLabels.duration, value: duration });
  if (offer.audience?.trim()) facts.push({ term: structuralLabels.audience, value: offer.audience });
  if (outputs.length > 0) facts.push({ term: structuralLabels.outputs, value: outputs });
  if (offer.nextStep?.trim()) facts.push({ term: structuralLabels.nextStep, value: offer.nextStep });
  if (facts.length === 0) return null;
  return (
    <aside
      aria-label={structuralLabels.engagement}
      data-tone="light"
      className="rounded-2xl border border-tone-border bg-tone-bg p-(--space-6) text-tone-text shadow-floating"
    >
      <p className="m-0 font-mono text-eyebrow tracking-wide text-tone-eyebrow uppercase">
        {structuralLabels.engagement}
      </p>
      <dl className="m-0 mt-(--space-4) divide-y divide-tone-border">
        {facts.map((fact) => (
          <div key={fact.term} className="py-(--space-4) first:pt-0 last:pb-0">
            <dt className="text-small font-semibold text-tone-heading">{fact.term}</dt>
            <dd className="m-0 mt-(--space-1) text-small text-pretty">
              {typeof fact.value === "string" ? (
                fact.value
              ) : (
                <ul className="m-0 list-none space-y-(--space-1) p-0">
                  {fact.value.map((item) => (
                    <li key={item} className="flex gap-(--space-2)">
                      <span aria-hidden="true" className="mt-[0.55em] size-1.5 shrink-0 bg-aqua-600" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              )}
            </dd>
          </div>
        ))}
      </dl>
    </aside>
  );
}
