import type { Metadata } from "next";
import { routes } from "@vitalos/cms";
import { Icon } from "@vitalos/ui";
import type { WorkflowTopic } from "../../../../src/features/ai-data/workflows";
import { AiDataPage } from "../../../../src/components/ai-data/chrome";
import {
  ArrowLink,
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

/** The explorer topic a solution belongs to, so its brief opens with the topic chosen. */
const topicFor: Record<string, WorkflowTopic | undefined> = {
  "documents-and-reconciliation": "finance-reconciliation",
  "enquiry-capture": "customer-requests",
  reporting: "operational-reporting",
};

export default function AiDataSolutionsPage() {
  return (
    <AiDataPage current="solutions">
      <JsonLd data={aiDataGraph("solutions", title, lead)} />
      <Band tone="dark" grid labelledBy="aid-solutions-title">
        <div className="grid items-end gap-(--space-7) lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
          <SectionHeading
            id="aid-solutions-title"
            level={1}
            eyebrow="Solutions"
            title={title}
            lead={lead}
          />
          <nav
            aria-label="Jump to a problem"
            className="rounded-xl border border-aid-line/40 bg-aid-surface p-(--space-4)"
          >
            <p className="m-0 pb-(--space-2) text-small font-semibold text-aid-heading">
              Jump to a problem
            </p>
            <ol className="m-0 flex list-none flex-col p-0">
              {solutions.map((solution, index) => (
                <li key={solution.id} className="border-t border-aid-border first:border-t-0">
                  <a
                    href={`#${solution.id}`}
                    className="group flex min-h-11 items-center gap-(--space-3) text-small text-aid-text no-underline transition-colors duration-(--duration-feedback) hover:text-aid-heading"
                  >
                    <span className="font-mono text-aid-muted">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="flex-1">{solution.title}</span>
                    <Icon
                      name="arrow-down"
                      size={16}
                      className="text-aid-muted transition-transform duration-(--duration-feedback) group-hover:translate-y-0.5 motion-reduce:group-hover:translate-y-0"
                    />
                  </a>
                </li>
              ))}
            </ol>
          </nav>
        </div>
      </Band>

      <Band tone="light" labelledBy="aid-problems">
        <div className="flex flex-col gap-(--space-7)">
          <h2 id="aid-problems" className="sr-only">
            Problems we solve
          </h2>
          <ol className="m-0 flex list-none flex-col gap-(--space-5) p-0">
            {solutions.map((solution, index) => {
              const topic = topicFor[solution.id];
              return (
                <li
                  key={solution.id}
                  id={solution.id}
                  className="flex scroll-mt-24 flex-col gap-(--space-5) rounded-xl border border-aid-border bg-aid-surface p-(--space-5) transition-[border-color,box-shadow] duration-(--duration-feedback) hover:border-aid-line hover:shadow-floating md:p-(--space-6)"
                >
                  <div className="flex flex-col gap-(--space-2)">
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
                  <dl className="m-0 grid gap-(--space-4) lg:grid-cols-3">
                    {(
                      [
                        ["The problem", solution.problem, "warning"],
                        ["What we build", solution.build, "code"],
                        ["Where people stay in control", solution.control, "person"],
                      ] as const
                    ).map(([term, detail, icon]) => (
                      <div
                        key={term}
                        className="flex flex-col gap-(--space-2) border-t-2 border-aid-border pt-(--space-3)"
                      >
                        <dt className="flex items-center gap-(--space-2) text-small font-semibold text-aid-heading">
                          <Icon name={icon} size={20} className="shrink-0 text-aid-signal" />
                          {term}
                        </dt>
                        <dd className="m-0 text-aid-text">{detail}</dd>
                      </div>
                    ))}
                  </dl>
                  {topic ? (
                    <div>
                      <ArrowLink href={`${routes.aiData.contact()}?topic=${topic}`}>
                        Prepare a brief on this
                        <span className="sr-only">: {solution.title}</span>
                      </ArrowLink>
                    </div>
                  ) : null}
                </li>
              );
            })}
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
