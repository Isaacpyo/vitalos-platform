import type { Metadata } from "next";
import { routes } from "@vitalos/cms";
import { Button } from "@vitalos/ui";
import { AiDataPage } from "../../../src/components/ai-data/chrome";
import { DeliveryLoop } from "../../../src/components/ai-data/DeliveryLoop";
import {
  ArrowLink,
  Band,
  Eyebrow,
  LabelChip,
  SectionHeading,
} from "../../../src/components/ai-data/primitives";
import { ClosingCta, OfferSummary, ServicePanels } from "../../../src/components/ai-data/sections";
import { JsonLd } from "../../../src/components/json-ld";
import { division, hero, outcomes } from "../../../src/features/ai-data/copy";
import { aiDataGraph, aiDataMetadata } from "../../../src/features/ai-data/seo";

export const metadata: Metadata = aiDataMetadata("home");

export default function AiDataHomePage() {
  return (
    <AiDataPage current="home">
      <JsonLd data={aiDataGraph("home", hero.title, hero.lead)} />
      <Band tone="dark" spacing="large" grid labelledBy="aid-hero">
        <div className="flex max-w-4xl flex-col gap-(--space-6)">
          <Eyebrow>{hero.eyebrow}</Eyebrow>
          <h1 id="aid-hero" className="m-0 text-display-xl text-balance text-aid-heading">
            {hero.title}
          </h1>
          <p className="m-0 max-w-(--container-prose) text-body-l text-aid-text">{hero.lead}</p>
          <div className="flex flex-col gap-(--space-4) pt-(--space-2) sm:flex-row sm:flex-wrap sm:items-center">
            <Button href={routes.aiData.contact()} size="lg" arrow>
              {division.primaryCta}
            </Button>
            <Button href={routes.aiData.solutions()} variant="secondary" size="lg">
              Explore Solutions
            </Button>
          </div>
        </div>
      </Band>

      <Band tone="light" labelledBy="aid-outcomes">
        <div className="flex flex-col gap-(--space-7)">
          <SectionHeading
            id="aid-outcomes"
            eyebrow="Outcomes, not technology"
            title="Start from the work that costs you time."
            lead="We begin with a specific, repetitive workflow and the result you want from it. AI is used where it materially helps; elsewhere, ordinary software does the job."
          />
          <ul className="m-0 grid list-none gap-0 border-t border-aid-border p-0 sm:grid-cols-2 lg:grid-cols-3">
            {outcomes.map((outcome, index) => (
              <li
                key={outcome.title}
                className="flex flex-col gap-(--space-2) border-b border-aid-border py-(--space-5) sm:pr-(--space-6)"
              >
                <span className="font-mono text-small text-aid-muted">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <h3 className="m-0 text-body-l font-semibold text-aid-heading">{outcome.title}</h3>
                <p className="m-0 text-aid-text">{outcome.text}</p>
              </li>
            ))}
          </ul>
        </div>
      </Band>

      <Band tone="muted" labelledBy="aid-services">
        <div className="flex flex-col gap-(--space-7)">
          <SectionHeading
            id="aid-services"
            eyebrow="What we do"
            title="Three ways we help."
            lead="Most work combines the three: software that does the job, data it can rely on, and someone accountable for keeping it working."
          />
          <ServicePanels />
        </div>
      </Band>

      <Band tone="light" labelledBy="aid-loop">
        <div className="grid items-center gap-(--space-7) lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
          <div className="flex flex-col gap-(--space-5)">
            <SectionHeading
              id="aid-loop"
              eyebrow="How we work"
              title="One accountable loop, from first conversation to live system."
              lead="The same people stay with the work from understanding the problem to operating the result, and every stage has a check before the next one starts."
            />
            <ArrowLink href={routes.aiData.approach()}>Read our approach</ArrowLink>
          </div>
          <DeliveryLoop id="aid-home-loop" />
        </div>
      </Band>

      <Band tone="dark" labelledBy="aid-demo">
        <div className="grid gap-(--space-7) lg:grid-cols-2 lg:items-center">
          <div className="flex flex-col gap-(--space-5)">
            <div className="flex flex-wrap gap-(--space-2)">
              <LabelChip icon="info">Demonstration on synthetic data</LabelChip>
            </div>
            <SectionHeading
              id="aid-demo"
              title="Supplier statement reconciliation, shown end to end."
              lead="Our demonstrator reads a supplier statement, checks every line against its source, reconciles it with a purchase ledger using exact arithmetic and sends anything uncertain to a person."
            />
            <ArrowLink href={routes.aiData.demonstrator()}>
              See how the demonstrator works
            </ArrowLink>
          </div>
          <dl className="m-0 grid gap-0 border-t border-aid-border">
            {[
              ["Extraction", "Rules first; a model only for layouts the rules cannot read."],
              ["Arithmetic", "Exact, deterministic code. Never a model."],
              [
                "Exceptions",
                "Missing invoices, amount differences and duplicates go to a reviewer.",
              ],
              ["Evidence", "Evaluated offline against criteria written before the first run."],
            ].map(([term, detail]) => (
              <div
                key={term}
                className="grid gap-(--space-1) border-b border-aid-border py-(--space-4) sm:grid-cols-[10rem_1fr] sm:gap-(--space-5)"
              >
                <dt className="font-mono text-small text-aid-accent uppercase tracking-[0.08em]">
                  {term}
                </dt>
                <dd className="m-0 text-aid-text">{detail}</dd>
              </div>
            ))}
          </dl>
        </div>
      </Band>

      <Band tone="muted" labelledBy="aid-start">
        <div className="flex flex-col gap-(--space-7)">
          <SectionHeading
            id="aid-start"
            eyebrow="Ways to start"
            title="Four sizes of commitment."
            lead="Start small. Each step is scoped and agreed on its own, so you decide after each one whether to go further."
          />
          <OfferSummary />
        </div>
      </Band>

      <ClosingCta />
    </AiDataPage>
  );
}
