import type { Metadata } from "next";
import { routes } from "@vitalos/cms";
import { Button } from "@vitalos/ui";
import { AiDataPage } from "../../../../src/components/ai-data/chrome";
import {
  EvaluationResults,
  ReconciliationTable,
  StatementExcerpt,
} from "../../../../src/components/ai-data/demonstrator";
import {
  Band,
  LabelChip,
  Panel,
  SectionHeading,
} from "../../../../src/components/ai-data/primitives";
import { JsonLd } from "../../../../src/components/json-ld";
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
    items: [
      "Reading statement lines in layouts the parser does not know",
      "Its output is validated against a schema and the source text before use",
      "Never trusted for sums, matches or approvals",
    ],
  },
  {
    heading: "A person",
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
                Illustrative example
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

      <Band tone="light" labelledBy="aid-steps">
        <div className="flex flex-col gap-(--space-7)">
          <SectionHeading id="aid-steps" eyebrow="What it does" title="Five steps, in order." />
          <ol className="m-0 flex list-none flex-col gap-0 border-t border-aid-border p-0">
            {steps.map((step, index) => (
              <li
                key={step.title}
                className="grid grid-cols-[2.5rem_1fr] gap-x-(--space-3) gap-y-(--space-1) border-b border-aid-border py-(--space-5) md:grid-cols-[3rem_14rem_1fr] md:gap-x-(--space-6)"
              >
                <span className="pt-1 font-mono text-small text-aid-muted">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <h3 className="m-0 text-body-l font-semibold text-aid-heading">{step.title}</h3>
                <p className="col-start-2 m-0 max-w-(--container-prose) text-aid-text md:col-start-3">
                  {step.text}
                </p>
              </li>
            ))}
          </ol>
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
              <Panel as="li" key={column.heading}>
                <h3 className="m-0 text-h3 text-aid-heading">{column.heading}</h3>
                <ul className="m-0 flex list-disc flex-col gap-(--space-2) pl-(--space-5)">
                  {column.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </Panel>
            ))}
          </ul>
        </div>
      </Band>

      <Band tone="light" labelledBy="aid-example">
        <div className="flex flex-col gap-(--space-7)">
          <div className="flex flex-col gap-(--space-4)">
            <div className="flex flex-wrap gap-(--space-2)">
              <LabelChip icon="info">Synthetic data</LabelChip>
              <LabelChip icon="document">Illustrative example</LabelChip>
            </div>
            <SectionHeading
              id="aid-example"
              eyebrow="Example"
              title="A statement excerpt and its reconciliation."
              lead="A short, made-up statement from a fictional supplier, and the result the demonstrator produces against a fictional purchase ledger. Every result cites the statement line (L5, L6 and so on) it came from."
            />
          </div>
          <StatementExcerpt />
          <ReconciliationTable />
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

      <Band tone="light" labelledBy="aid-evaluation">
        <div className="flex flex-col gap-(--space-7)">
          <SectionHeading
            id="aid-evaluation"
            eyebrow="Evaluation"
            title={demonstratorReport.label}
            lead="Acceptance criteria were written down before any evaluation was run, and thresholds only change through a dated revision. Offline results with simulated model responses test the controls around the model, not the quality of any live model."
          />
          <EvaluationResults report={demonstratorReport} />
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
