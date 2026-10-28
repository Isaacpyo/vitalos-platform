import type { Metadata } from "next";
import { routes } from "@vitalos/cms";
import { AiDataPage } from "../../../../src/components/ai-data/chrome";
import { DeliveryLoop } from "../../../../src/components/ai-data/DeliveryLoop";
import {
  ArrowLink,
  Band,
  Panel,
  SectionHeading,
} from "../../../../src/components/ai-data/primitives";
import { ClosingCta } from "../../../../src/components/ai-data/sections";
import { JsonLd } from "../../../../src/components/json-ld";
import {
  dataPractices,
  engineeringQuestions,
  lifecycle,
  willNot,
} from "../../../../src/features/ai-data/copy";
import { aiDataGraph, aiDataMetadata } from "../../../../src/features/ai-data/seo";

export const metadata: Metadata = aiDataMetadata("approach");

const title = "We stay with the work, from the problem to the running system.";
const lead =
  "The same small team understands your workflow, builds the solution, proves that it works and keeps it working. Here is how that goes, step by step.";

export default function AiDataApproachPage() {
  return (
    <AiDataPage current="approach">
      <JsonLd data={aiDataGraph("approach", title, lead)} />
      <Band tone="dark" grid labelledBy="aid-approach-title">
        <SectionHeading
          id="aid-approach-title"
          level={1}
          eyebrow="Our Approach"
          title={title}
          lead={lead}
        />
      </Band>

      <Band tone="light" labelledBy="aid-lifecycle">
        <div className="flex flex-col gap-(--space-7)">
          <SectionHeading
            id="aid-lifecycle"
            eyebrow="The lifecycle"
            title="Ten stages, each with a check before the next."
            lead="Not every engagement goes through all ten: an assessment stops after the first four. Nothing is built before scope, measures and data terms are agreed in writing."
          />
          <ol className="m-0 grid list-none gap-0 border-t border-aid-border p-0 md:grid-cols-2">
            {lifecycle.map((stage, index) => (
              <li
                key={stage.title}
                className="grid grid-cols-[3rem_1fr] gap-(--space-3) border-b border-aid-border py-(--space-5) md:odd:pr-(--space-7) md:even:pl-(--space-7) md:even:border-l"
              >
                <span className="font-mono text-small text-aid-muted">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div className="flex flex-col gap-(--space-1)">
                  <h3 className="m-0 text-body-l font-semibold text-aid-heading">{stage.title}</h3>
                  <p className="m-0 text-aid-text">{stage.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </Band>

      <Band tone="muted" labelledBy="aid-loop-title">
        <div className="grid items-center gap-(--space-7) lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
          <SectionHeading
            id="aid-loop-title"
            eyebrow="After launch"
            title="Live systems keep going round the loop."
            lead="Once a system is running, monitoring and review feed the next round of improvement. Changes are measured against the same baseline."
          />
          <DeliveryLoop id="aid-approach-loop" />
        </div>
      </Band>

      <Band tone="light" labelledBy="aid-questions">
        <div className="flex flex-col gap-(--space-7)">
          <SectionHeading
            id="aid-questions"
            eyebrow="Four questions"
            title="Every piece of work has to answer these."
          />
          <ol className="m-0 grid list-none gap-(--space-5) p-0 md:grid-cols-2">
            {engineeringQuestions.map((item, index) => (
              <Panel as="li" key={item.question}>
                <span className="font-mono text-small text-aid-muted">Q{index + 1}</span>
                <h3 className="m-0 text-h3 text-aid-heading">{item.question}</h3>
                <p className="m-0">{item.text}</p>
              </Panel>
            ))}
          </ol>
        </div>
      </Band>

      <Band tone="muted" labelledBy="aid-quality">
        <div className="grid gap-(--space-7) lg:grid-cols-3">
          <SectionHeading
            id="aid-quality"
            eyebrow="Quality and control"
            title="Proved before launch, checked after."
            className="lg:col-span-1"
          />
          <div className="grid gap-(--space-6) sm:grid-cols-2 lg:col-span-2">
            <div className="flex flex-col gap-(--space-2)">
              <h3 className="m-0 text-body-l font-semibold text-aid-heading">
                Evaluation before launch
              </h3>
              <p className="m-0">
                We agree test cases and pass thresholds with you before building, including awkward
                and adversarial cases, and report every result, including misses.
              </p>
            </div>
            <div className="flex flex-col gap-(--space-2)">
              <h3 className="m-0 text-body-l font-semibold text-aid-heading">
                Human review where mistakes matter
              </h3>
              <p className="m-0">
                Uncertain results and exceptions go to a named person to accept, correct or reject.
                The system shows its source for every answer it gives.
              </p>
            </div>
            <div className="flex flex-col gap-(--space-2)">
              <h3 className="m-0 text-body-l font-semibold text-aid-heading">
                Deterministic code for the exact parts
              </h3>
              <p className="m-0">
                Arithmetic, permissions and workflow state are handled by ordinary, tested code.
                Models are used for reading and drafting, not for sums or decisions about access.
              </p>
            </div>
            <div className="flex flex-col gap-(--space-2)">
              <h3 className="m-0 text-body-l font-semibold text-aid-heading">
                Safe when a model is wrong or down
              </h3>
              <p className="m-0">
                Model output is checked before it is used. If a model service is unavailable, work
                is queued or handed to a person rather than guessed.
              </p>
            </div>
          </div>
        </div>
      </Band>

      <Band tone="light" labelledBy="aid-data">
        <div className="flex flex-col gap-(--space-7)">
          <SectionHeading
            id="aid-data"
            eyebrow="Your data"
            title="How we handle data and security."
            lead="These are the practices we work to on every engagement, set out in the written scope and data terms. They describe how we work; they are not a certification."
          />
          <ul className="m-0 grid list-none gap-(--space-5) p-0 sm:grid-cols-2 lg:grid-cols-4">
            {dataPractices.map((practice) => (
              <Panel as="li" key={practice.title}>
                <h3 className="m-0 text-body-l font-semibold text-aid-heading">{practice.title}</h3>
                <p className="m-0">{practice.text}</p>
              </Panel>
            ))}
          </ul>
          <ArrowLink href={routes.trust()}>Read the Vitalos Trust Centre</ArrowLink>
        </div>
      </Band>

      <Band tone="muted" labelledBy="aid-will-not">
        <div className="grid gap-(--space-7) lg:grid-cols-2">
          <SectionHeading id="aid-will-not" eyebrow="Boundaries" title="What we will not do." />
          <ul className="m-0 flex list-none flex-col gap-0 border-t border-aid-border p-0">
            {willNot.map((item) => (
              <li
                key={item}
                className="flex gap-(--space-3) border-b border-aid-border py-(--space-4)"
              >
                <span aria-hidden="true" className="font-mono text-aid-accent">
                  ×
                </span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </Band>

      <Band tone="light" spacing="compact" labelledBy="aid-footnote">
        <h2 id="aid-footnote" className="sr-only">
          A note on terms
        </h2>
        <p className="m-0 max-w-(--container-prose) text-small text-aid-muted">
          This way of working, where engineers work alongside a customer&apos;s team from the first
          conversation through to running the system, is sometimes called forward-deployed
          engineering.
        </p>
      </Band>

      <ClosingCta />
    </AiDataPage>
  );
}
