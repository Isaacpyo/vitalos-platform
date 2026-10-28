import type { Metadata } from "next";
import { AiDataPage } from "../../../../src/components/ai-data/chrome";
import {
  Band,
  CheckList,
  LabelChip,
  SectionHeading,
} from "../../../../src/components/ai-data/primitives";
import {
  ClosingCta,
  OfferDetails,
  ServicePanels,
} from "../../../../src/components/ai-data/sections";
import { JsonLd } from "../../../../src/components/json-ld";
import { audience, solutions } from "../../../../src/features/ai-data/copy";
import { aiDataGraph, aiDataMetadata } from "../../../../src/features/ai-data/seo";

export const metadata: Metadata = aiDataMetadata("solutions");

const title = "Concrete problems, solved in your workflow.";
const lead =
  "These are the problems we see most often in small and medium-sized businesses. For each one: the problem, what we build, and where people stay in control.";

export default function AiDataSolutionsPage() {
  return (
    <AiDataPage current="solutions">
      <JsonLd data={aiDataGraph("solutions", title, lead)} />
      <Band tone="dark" grid labelledBy="aid-solutions-title">
        <SectionHeading
          id="aid-solutions-title"
          level={1}
          eyebrow="Solutions"
          title={title}
          lead={lead}
        />
      </Band>

      <Band tone="light" labelledBy="aid-problems">
        <div className="flex flex-col gap-(--space-7)">
          <h2 id="aid-problems" className="sr-only">
            Problems we solve
          </h2>
          <ol className="m-0 flex list-none flex-col gap-0 border-t border-aid-border p-0">
            {solutions.map((solution, index) => (
              <li
                key={solution.id}
                id={solution.id}
                className="grid scroll-mt-24 gap-(--space-5) border-b border-aid-border py-(--space-7) lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] lg:gap-(--space-7)"
              >
                <div className="flex flex-col gap-(--space-3)">
                  <span className="font-mono text-small text-aid-muted">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <h3 className="m-0 text-h3 text-balance text-aid-heading">{solution.title}</h3>
                  {solution.note ? (
                    <div>
                      <LabelChip>{solution.note}</LabelChip>
                    </div>
                  ) : null}
                </div>
                <dl className="m-0 flex flex-col gap-(--space-4)">
                  {(
                    [
                      ["The problem", solution.problem],
                      ["What we build", solution.build],
                      ["Where people stay in control", solution.control],
                    ] as const
                  ).map(([term, detail]) => (
                    <div
                      key={term}
                      className="grid gap-(--space-1) sm:grid-cols-[12rem_1fr] sm:gap-(--space-5)"
                    >
                      <dt className="text-small font-semibold text-aid-accent">{term}</dt>
                      <dd className="m-0 text-aid-text">{detail}</dd>
                    </div>
                  ))}
                </dl>
              </li>
            ))}
          </ol>
        </div>
      </Band>

      <Band tone="muted" labelledBy="aid-capabilities">
        <div className="flex flex-col gap-(--space-7)">
          <SectionHeading
            id="aid-capabilities"
            eyebrow="Capabilities"
            title="Three capability areas."
            lead="The solutions above draw on the same three areas of work."
          />
          <ServicePanels detailed />
        </div>
      </Band>

      <Band tone="light" labelledBy="aid-offers">
        <div className="flex flex-col gap-(--space-7)">
          <SectionHeading
            id="aid-offers"
            eyebrow="Ways to start"
            title="Four ways to work with us."
            lead="Each is scoped and agreed on its own. Here is what each one is for, what you get, and what it is not."
          />
          <OfferDetails />
        </div>
      </Band>

      <Band tone="muted" labelledBy="aid-audience">
        <div className="grid gap-(--space-7) lg:grid-cols-2">
          <SectionHeading id="aid-audience" eyebrow="Fit" title={audience.title} />
          <div className="flex flex-col gap-(--space-6)">
            <CheckList items={audience.points} />
            <p className="m-0 border-l-2 border-aid-accent pl-(--space-5) text-body-l text-aid-heading">
              {audience.deterministic}
            </p>
          </div>
        </div>
      </Band>

      <ClosingCta />
    </AiDataPage>
  );
}
