import { routes } from "@vitalos/cms";
import { Button } from "@vitalos/ui";
import { division, feesNote, offers, serviceAreas } from "../../features/ai-data/copy";
import type { Offer, ServiceArea } from "../../features/ai-data/copy";
import { ArrowLink, Band, CheckList, Panel, SectionHeading } from "./primitives";

/** Three capability panels. With `detailed`, each carries its points and a stable anchor. */
export function ServicePanels({
  headingLevel = 3,
  detailed = false,
}: Readonly<{ headingLevel?: 2 | 3; detailed?: boolean }>) {
  const Heading = headingLevel === 2 ? "h2" : "h3";
  return (
    <ul className="m-0 grid list-none gap-(--space-5) p-0 md:grid-cols-3">
      {serviceAreas.map((area: ServiceArea, index) => (
        <Panel as="li" key={area.id} id={detailed ? area.id : undefined} className="scroll-mt-24">
          <p className="m-0 font-mono text-small text-aid-muted">0{index + 1}</p>
          <Heading className="m-0 text-h3 text-aid-heading">{area.title}</Heading>
          <p className="m-0 text-aid-text">{area.summary}</p>
          {detailed ? (
            <CheckList items={area.points} className="border-t border-aid-border pt-(--space-4)" />
          ) : (
            <ArrowLink href={`${routes.aiData.solutions()}#${area.id}`} className="mt-auto">
              About {area.title}
            </ArrowLink>
          )}
        </Panel>
      ))}
    </ul>
  );
}

/** The four offers as compact cards (home page). No prices (AID-006). */
export function OfferSummary() {
  return (
    <div className="flex flex-col gap-(--space-5)">
      <ol className="m-0 grid list-none gap-(--space-5) p-0 sm:grid-cols-2 lg:grid-cols-4">
        {offers.map((offer: Offer, index) => (
          <Panel as="li" key={offer.key}>
            <p className="m-0 font-mono text-small text-aid-muted">0{index + 1}</p>
            <h3 className="m-0 text-body-l font-semibold text-aid-heading">{offer.title}</h3>
            <p className="m-0 text-small text-aid-text">{offer.short}</p>
            <ArrowLink href={routes.aiData.contact(offer.key)} className="mt-auto text-small">
              Ask about this<span className="sr-only">: {offer.title}</span>
            </ArrowLink>
          </Panel>
        ))}
      </ol>
      <p className="m-0 max-w-(--container-prose) text-aid-muted">{feesNote}</p>
    </div>
  );
}

/** The four offers in full: purpose, what you get, what it is not (solutions page). */
export function OfferDetails() {
  return (
    <div className="flex flex-col gap-(--space-6)">
      <ol className="m-0 grid list-none gap-(--space-5) p-0 lg:grid-cols-2">
        {offers.map((offer, index) => (
          <Panel as="li" key={offer.key} id={offer.key} className="scroll-mt-24">
            <p className="m-0 font-mono text-small text-aid-muted">0{index + 1}</p>
            <h3 className="m-0 text-h3 text-aid-heading">{offer.title}</h3>
            <p className="m-0">{offer.purpose}</p>
            <div className="flex flex-col gap-(--space-3) border-t border-aid-border pt-(--space-4)">
              <h4 className="m-0 text-small font-semibold text-aid-heading uppercase tracking-[0.08em]">
                What you get
              </h4>
              <CheckList items={offer.youGet} />
            </div>
            <div className="flex flex-col gap-(--space-2) border-t border-aid-border pt-(--space-4)">
              <h4 className="m-0 text-small font-semibold text-aid-heading uppercase tracking-[0.08em]">
                What it is not
              </h4>
              <p className="m-0 text-aid-muted">{offer.isNot}</p>
            </div>
            <ArrowLink href={routes.aiData.contact(offer.key)} className="mt-auto">
              Discuss the {offer.title}
            </ArrowLink>
          </Panel>
        ))}
      </ol>
      <p className="m-0 max-w-(--container-prose) text-aid-muted">{feesNote}</p>
    </div>
  );
}

/** The closing call to action on every page except the contact page. */
export function ClosingCta({
  id = "closing",
  title = "Tell us about the workflow that costs you most.",
  lead = "Describe the problem in a few sentences. We will reply to arrange a conversation about whether, and how, we can help.",
}: Readonly<{ id?: string; title?: string; lead?: string }>) {
  return (
    <Band tone="dark" labelledBy={id} grid>
      <div className="flex flex-col items-start gap-(--space-6)">
        <SectionHeading id={id} title={title} lead={lead} />
        <Button href={routes.aiData.contact()} size="lg" arrow>
          {division.primaryCta}
        </Button>
      </div>
    </Band>
  );
}
