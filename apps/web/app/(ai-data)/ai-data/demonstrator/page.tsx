import type { Metadata } from "next";
import { routes } from "@vitalos/cms";
import { Button, Icon } from "@vitalos/ui";
import { AiDataPage } from "../../../../src/components/ai-data/chrome";
import {
  EvaluationResults,
  ReconciliationTable,
  StatementExcerpt,
} from "../../../../src/components/ai-data/demonstrator";
import { Band, LabelChip, SectionHeading } from "../../../../src/components/ai-data/primitives";
import { ReconWorkbench } from "../../../../src/components/ai-data/ReconWorkbench";
import { MethodChip } from "../../../../src/components/ai-data/work-surface";
import { JsonLd } from "../../../../src/components/json-ld";
import { demoSamples } from "../../../../src/features/ai-data/demonstrator-samples";
import { demonstratorReport } from "../../../../src/features/ai-data/demonstrator-report";
import { aiDataGraph, aiDataMetadata } from "../../../../src/features/ai-data/seo";

export const metadata: Metadata = aiDataMetadata("demonstrator");

const title = "Supplier statement reconciliation demonstrator";
const lead =
  "A working example of the kind of system we build: it reconciles a supplier statement against a purchase ledger, lists the exceptions and sends anything uncertain to a person. It runs on synthetic data.";

const steps = [
  {
    title: "Check the input",
    text: "Empty, unreadable, oversized or wrongly formatted files are rejected with a clear reason before any model is called.",
  },
  {
    title: "Read the statement",
    text: "A deterministic parser reads known layouts. A model is used only for lines the parser cannot read, and only when that path is switched on.",
  },
  {
    title: "Ground every line",
    text: "Each extracted line must match its source: the reference and amount have to appear on the cited statement line. Anything that does not is never accepted.",
  },
  {
    title: "Reconcile",
    text: "Statement and ledger are matched with exact decimal arithmetic: matched, amount mismatch, missing from the ledger, in the ledger but not on the statement, duplicate, and the closing-balance check.",
  },
  {
    title: "Route",
    text: "A clean result is marked complete. Any exception or uncertainty goes to a reviewer with the reason; the reviewer accepts, corrects or rejects each item.",
  },
] as const;

const split = [
  {
    heading: "Deterministic code",
    method: "code",
    icon: "code",
    items: [
      "Input checks and file limits",
      "Parsing of known statement layouts",
      "All arithmetic and the closing-balance check",
      "Matching rules and workflow state",
      "Who may see and approve what",
    ],
  },
  {
    heading: "Model, when enabled",
    method: "ai-assisted",
    icon: "chip",
    items: [
      "Reading statement lines in layouts the parser does not know",
      "Its output is validated against a schema and the source text before use",
      "Never trusted for sums, matches or approvals",
      "Not used at all in the scripted samples on this page",
    ],
  },
  {
    heading: "A person",
    method: "person",
    icon: "person",
    items: [
      "Reviews every exception and every uncertain line",
      "Accepts, corrects or rejects each item",
      "Decides what is posted to the accounts: nothing is posted automatically",
    ],
  },
] as const;

const failures = [
  [
    "Provider timeout or error",
    "Retried at most twice, then the run ends as failed or for review, never complete.",
  ],
  ["Invalid model output", "Rejected by schema validation; the line goes to a reviewer."],
  [
    "Instructions hidden in a statement",
    "Treated as data: results are unchanged and the case is flagged for review.",
  ],
  [
    "Spending limits reached",
    "Per-run, daily and monthly caps are checked before any model call; a kill switch stops all runs.",
  ],
] as const;

export default function AiDataDemonstratorPage() {
  return (
    <AiDataPage current="demonstrator">
      <JsonLd data={aiDataGraph("demonstrator", title, lead)} />
      <Band tone="dark" grid labelledBy="aid-demo-title">
        <div className="flex flex-col gap-(--space-6)">
          <ul
            aria-label="About this page"
            className="m-0 flex list-none flex-wrap gap-(--space-2) p-0"
          >
            <li>
              <LabelChip icon="info" size="lg">
                Synthetic data
              </LabelChip>
            </li>
            <li>
              <LabelChip icon="document" size="lg">
                Scripted example
              </LabelChip>
            </li>
            <li>
              <LabelChip icon="warning" size="lg">
                Not a product
              </LabelChip>
            </li>
          </ul>
          <SectionHeading
            id="aid-demo-title"
            level={1}
            eyebrow="Demonstrator"
            title={title}
            lead={lead}
          />
          <p className="m-0 max-w-(--container-prose) text-aid-muted">
            It exists to show how we approach a real workflow: what is automated, what is checked,
            and where a person decides. It is not offered for sale and has not been used with any
            customer&apos;s data.
          </p>
        </div>
      </Band>

      <Band tone="light" labelledBy="aid-workbench">
        <div className="flex flex-col gap-(--space-7)">
          <SectionHeading
            id="aid-workbench"
            eyebrow="Try it"
            title="Choose a sample and follow every result back to its source."
            lead="The statement is on the left and the results on the right. Choose a result to expand its evidence and highlight the line it cites. The sample inputs are synthetic; the results are prepared from them, not computed live."
          />
          <ReconWorkbench samples={demoSamples} surface="demonstrator" tone="light" />
        </div>
      </Band>

      <Band tone="muted" labelledBy="aid-split">
        <div className="flex flex-col gap-(--space-7)">
          <SectionHeading
            id="aid-split"
            eyebrow="Who does what"
            title="AI where it helps, code where it must be exact, people where it matters."
          />
          <ul className="m-0 grid list-none gap-(--space-5) p-0 md:grid-cols-3">
            {split.map((column) => (
              <li
                key={column.heading}
                className="flex min-w-0 flex-col gap-(--space-4) rounded-xl border border-aid-border bg-aid-surface p-(--space-5) transition-[border-color,box-shadow] duration-(--duration-feedback) hover:border-aid-line hover:shadow-floating"
              >
                <div className="flex items-center justify-between gap-(--space-3)">
                  <span className="inline-flex size-10 items-center justify-center rounded-md border border-aid-signal bg-aid-signal-soft text-aid-signal">
                    <Icon name={column.icon} size={20} />
                  </span>
                  <MethodChip method={column.method} />
                </div>
                <h3 className="m-0 text-h3 text-aid-heading">{column.heading}</h3>
                <ul className="m-0 flex list-disc flex-col gap-(--space-2) pl-(--space-5)">
                  {column.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </div>
      </Band>

      <Band tone="light" labelledBy="aid-steps">
        <div className="flex flex-col gap-(--space-7)">
          <SectionHeading id="aid-steps" eyebrow="What it does" title="Five steps, in order." />
          <ol className="m-0 grid list-none gap-(--space-4) p-0 sm:grid-cols-2 lg:grid-cols-5">
            {steps.map((step, index) => (
              <li
                key={step.title}
                className="flex flex-col gap-(--space-2) border-t-2 border-aid-signal pt-(--space-3)"
              >
                <span className="font-mono text-small text-aid-muted">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <h3 className="m-0 text-body-l font-semibold text-aid-heading">{step.title}</h3>
                <p className="m-0 text-small text-aid-text">{step.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </Band>

      <Band tone="muted" labelledBy="aid-failures">
        <div className="grid gap-(--space-7) lg:grid-cols-2">
          <SectionHeading
            id="aid-failures"
            eyebrow="When things go wrong"
            title="Failure is handled, not hidden."
            lead="A run that cannot be trusted ends as failed or for review, with a reason, never as complete. Each behaviour below is an acceptance criterion that the evaluation checks."
          />
          <dl className="m-0 flex flex-col gap-0 border-t border-aid-border">
            {failures.map(([term, detail]) => (
              <div
                key={term}
                className="flex flex-col gap-(--space-1) border-b border-aid-border py-(--space-4)"
              >
                <dt className="font-semibold text-aid-heading">{term}</dt>
                <dd className="m-0 text-aid-text">{detail}</dd>
              </div>
            ))}
          </dl>
        </div>
      </Band>

      <Band tone="light" labelledBy="aid-evidence">
        <div className="flex flex-col gap-(--space-7)">
          <SectionHeading
            id="aid-evidence"
            eyebrow="Evidence"
            title={demonstratorReport.label}
            lead="Acceptance criteria were written down before any evaluation was run, and thresholds only change through a dated revision. Offline results with simulated model responses test the controls around the model, not the quality of any live model. The live-provider criterion has not run."
          />
          <EvaluationResults report={demonstratorReport} />
          <details className="group rounded-xl border border-aid-border bg-aid-surface">
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-(--space-4) px-(--space-5) py-(--space-3) font-semibold text-aid-heading [&::-webkit-details-marker]:hidden">
              <span>The first sample as plain tables</span>
              <Icon
                name="chevron-down"
                size={20}
                className="shrink-0 transition-transform duration-(--duration-disclosure) group-open:rotate-180"
              />
            </summary>
            <div className="flex flex-col gap-(--space-6) px-(--space-5) pb-(--space-5)">
              <p className="m-0 text-aid-muted">
                The same synthetic statement and its reconciliation as ordinary tables, for readers
                who prefer them and for tools that cannot use the interactive view.
              </p>
              <StatementExcerpt />
              <ReconciliationTable />
            </div>
          </details>
        </div>
      </Band>

      <Band tone="dark" grid labelledBy="aid-walkthrough">
        <div className="flex flex-col items-start gap-(--space-6)">
          <SectionHeading
            id="aid-walkthrough"
            title="See it with a statement layout like yours."
            lead="We can walk you through the demonstrator and talk about what a proof of value on your own, authorised data would involve."
          />
          <Button href={routes.aiData.contact("ai-proof-of-value")} size="lg" arrow>
            Ask for a walkthrough
          </Button>
        </div>
      </Band>
    </AiDataPage>
  );
}
