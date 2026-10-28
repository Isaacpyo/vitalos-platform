import type { Metadata } from "next";
import { routes } from "@vitalos/cms";
import { Icon } from "@vitalos/ui";
import { AiDataPage } from "../../../src/components/ai-data/chrome";
import { AiDataTracker } from "../../../src/components/ai-data/AiDataTracker";
import { DeliveryStages } from "../../../src/components/ai-data/DeliveryStages";
import { HeroWorkflow } from "../../../src/components/ai-data/HeroWorkflow";
import {
  OfferShowcase,
  UseCases,
  WorkflowExplorer,
} from "../../../src/components/ai-data/home-sections";
import {
  ArrowLink,
  Band,
  Eyebrow,
  SectionHeading,
} from "../../../src/components/ai-data/primitives";
import { ReconWorkbench } from "../../../src/components/ai-data/ReconWorkbench";
import { ClosingCta } from "../../../src/components/ai-data/sections";
import { JsonLd } from "../../../src/components/json-ld";
import { hero } from "../../../src/features/ai-data/copy";
import { demoSamples } from "../../../src/features/ai-data/demonstrator-samples";
import { aiDataGraph, aiDataMetadata } from "../../../src/features/ai-data/seo";

export const metadata: Metadata = aiDataMetadata("home");

const previewSamples = demoSamples.filter((sample) => sample.id === "month-end");

export default function AiDataHomePage() {
  return (
    <AiDataPage current="home">
      <JsonLd data={aiDataGraph("home", hero.title, hero.lead)} />
      <AiDataTracker>
        <Band tone="dark" spacing="large" grid labelledBy="aid-hero">
          <div className="grid items-start gap-(--space-8) lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-(--space-7)">
            <div className="flex flex-col gap-(--space-6) lg:pt-(--space-4)">
              <Eyebrow>{hero.eyebrow}</Eyebrow>
              <h1 id="aid-hero" className="m-0 text-display-l text-balance text-aid-heading">
                {hero.title}
              </h1>
              <p className="m-0 max-w-(--container-prose) text-body-l text-aid-text">{hero.lead}</p>
              <div className="flex flex-col gap-(--space-3) sm:flex-row sm:flex-wrap sm:items-center">
                <a
                  href="#aid-explorer"
                  data-aid-cta="explore-workflow"
                  className="inline-flex min-h-(--size-button-lg) items-center justify-center gap-(--space-3) rounded-md bg-aid-action px-(--space-6) text-body-l font-semibold text-aid-action-text no-underline transition-colors duration-(--duration-feedback) hover:bg-aid-action-hover active:translate-y-px"
                >
                  {hero.primaryCta}
                  <Icon name="arrow-down" size={20} />
                </a>
                <a
                  href={routes.aiData.demonstrator()}
                  data-aid-cta="try-example"
                  className="inline-flex min-h-(--size-button-lg) items-center justify-center gap-(--space-3) rounded-md border border-aid-heading px-(--space-6) text-body-l font-semibold text-aid-heading no-underline transition-colors duration-(--duration-feedback) hover:bg-aid-heading hover:text-aid-bg active:translate-y-px"
                >
                  {hero.secondaryCta}
                </a>
              </div>
              <ul className="m-0 flex list-none flex-col gap-(--space-3) border-t border-aid-border p-0 pt-(--space-5)">
                {hero.facts.map((fact) => (
                  <li key={fact} className="flex gap-(--space-3) text-small text-aid-muted">
                    <Icon name="check" size={20} className="mt-0.5 shrink-0 text-aid-signal" />
                    <span>{fact}</span>
                  </li>
                ))}
              </ul>
            </div>
            <HeroWorkflow />
          </div>
        </Band>

        <Band tone="light" labelledBy="aid-explorer-title" className="scroll-mt-24">
          <div className="flex flex-col gap-(--space-7)">
            <div id="aid-explorer" className="scroll-mt-24">
              <SectionHeading
                id="aid-explorer-title"
                eyebrow="Workflow explorer"
                title="What work is slowing your team down?"
                lead="Choose the closest match. Each shows the pattern we usually see, what software can take on, and what stays with a person."
              />
            </div>
            <WorkflowExplorer />
          </div>
        </Band>

        <Band tone="muted" labelledBy="aid-usecases">
          <div className="flex flex-col gap-(--space-7)">
            <SectionHeading
              id="aid-usecases"
              eyebrow="Three practical use cases"
              title="From the input you have to a result a person has checked."
              lead="In each, software does the repetitive reading and checking, and a person reviews what matters. The outcomes are what we aim for, not measured results."
            />
            <UseCases />
          </div>
        </Band>

        <Band tone="dark" labelledBy="aid-preview">
          <div className="flex flex-col gap-(--space-7)">
            <div className="flex flex-col gap-(--space-4)">
              <SectionHeading
                id="aid-preview"
                eyebrow="Reconciliation preview"
                title="See what a reviewer receives."
                lead="A supplier statement, checked line by line against a ledger. Choose a result to see the evidence behind it."
              />
              <ArrowLink href={routes.aiData.demonstrator()}>
                Open the full demonstrator, with source documents and more samples
              </ArrowLink>
            </div>
            <ReconWorkbench
              samples={previewSamples}
              surface="preview"
              variant="preview"
              tone="dark"
            />
          </div>
        </Band>

        <Band tone="light" labelledBy="aid-loop">
          <div className="flex flex-col gap-(--space-7)">
            <div className="flex flex-col gap-(--space-4)">
              <SectionHeading
                id="aid-loop"
                eyebrow="How we work"
                title="Discover, prove, build, operate."
                lead="You fund one stage at a time, and each stage ends with evidence you can use to decide whether to go on."
              />
              <ArrowLink href={routes.aiData.approach()}>Read our approach</ArrowLink>
            </div>
            <DeliveryStages />
          </div>
        </Band>

        <Band tone="muted" labelledBy="aid-start">
          <div className="flex flex-col gap-(--space-7)">
            <SectionHeading
              id="aid-start"
              eyebrow="Ways to start"
              title="Four stages, each one agreed on its own."
              lead="Start where you are. Each offer answers a question you probably have now and ends with something you can keep."
            />
            <OfferShowcase />
          </div>
        </Band>

        <ClosingCta
          title="Prepare a brief for the workflow that costs you most."
          lead="Answer a few questions about the work, the tools you use and what a good result looks like. We use it to plan a conversation about whether, and how, we can help."
          cta="prepare-brief"
          label="Prepare a workflow brief"
        />
      </AiDataTracker>
    </AiDataPage>
  );
}
