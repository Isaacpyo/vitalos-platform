import { Fragment } from "react";
import { routes } from "@vitalos/cms";
import { Icon } from "@vitalos/ui";
import { feesNote, offers } from "../../features/ai-data/copy";
import { explorerTopics, useCaseFlows } from "../../features/ai-data/workflows";
import type { ExplorerTopic, WorkflowTopic } from "../../features/ai-data/workflows";
import { ArrowLink, CheckList } from "./primitives";
import { cx } from "./work-surface";

/**
 * Server-rendered sections of the AI & Data home page below the hero. They carry the essential
 * content in the HTML and add no client JavaScript of their own: the explorer is a native radio
 * group whose selected panel is shown by CSS (`:has(:checked)`), so it works without scripts and
 * a delegated listener in AiDataTracker only reports which topic was chosen.
 */

const contactFor = (topic: WorkflowTopic) => `${routes.aiData.contact()}?topic=${topic}`;

/** Static class strings per topic, so Tailwind can see them. */
const panelShown: Record<WorkflowTopic, string> = {
  "finance-reconciliation":
    "has-[input[id=topic-finance-reconciliation]:checked]:[&_[data-panel=finance-reconciliation]]:flex",
  "document-intake":
    "has-[input[id=topic-document-intake]:checked]:[&_[data-panel=document-intake]]:flex",
  "customer-requests":
    "has-[input[id=topic-customer-requests]:checked]:[&_[data-panel=customer-requests]]:flex",
  "operational-reporting":
    "has-[input[id=topic-operational-reporting]:checked]:[&_[data-panel=operational-reporting]]:flex",
};

const cardLift =
  "transition-[border-color,box-shadow,transform] duration-(--duration-feedback) ease-(--ease-standard) hover:-translate-y-0.5 hover:border-aid-line hover:shadow-floating motion-reduce:hover:translate-y-0";

function TopicPanel({ topic }: Readonly<{ topic: ExplorerTopic }>) {
  return (
    <div
      data-panel={topic.slug}
      className="hidden min-w-0 flex-col gap-(--space-5) rounded-xl border border-aid-border bg-aid-surface p-(--space-5) md:p-(--space-6)"
    >
      <div className="flex flex-col gap-(--space-2)">
        <p className="m-0 font-mono text-eyebrow tracking-[0.14em] text-aid-eyebrow uppercase">
          Typical pattern
        </p>
        <h3 className="m-0 text-h3 text-aid-heading">{topic.symptom}</h3>
        <p className="m-0 max-w-(--container-prose) text-aid-text">{topic.pattern}</p>
      </div>
      <div className="flex flex-col gap-(--space-2)">
        <p className="m-0 text-small font-semibold text-aid-heading">You might recognise</p>
        <CheckList items={topic.signs} />
      </div>
      <div className="grid gap-(--space-4) border-t border-aid-border pt-(--space-5) md:grid-cols-2">
        <div className="flex flex-col gap-(--space-2)">
          <p className="m-0 flex items-center gap-(--space-2) text-small font-semibold text-aid-heading">
            <Icon name="code" size={20} className="shrink-0 text-aid-signal" />
            What the software does
          </p>
          <p className="m-0 text-aid-text">{topic.system}</p>
        </div>
        <div className="flex flex-col gap-(--space-2)">
          <p className="m-0 flex items-center gap-(--space-2) text-small font-semibold text-aid-heading">
            <Icon name="person" size={20} className="shrink-0 text-aid-signal" />
            What stays with a person
          </p>
          <p className="m-0 text-aid-text">{topic.person}</p>
        </div>
      </div>
      <div className="flex flex-col gap-(--space-3) sm:flex-row sm:flex-wrap sm:items-center sm:gap-(--space-5)">
        <a
          href={contactFor(topic.slug)}
          data-aid-cta="prepare-brief"
          className="inline-flex min-h-11 items-center justify-center gap-(--space-2) rounded-md bg-aid-action px-(--space-5) text-body font-semibold text-aid-action-text no-underline transition-colors duration-(--duration-feedback) hover:bg-aid-action-hover"
        >
          Prepare a brief on this
          <Icon name="arrow-right" size={16} />
        </a>
        {topic.example ? (
          <ArrowLink href={topic.example.href}>{topic.example.label}</ArrowLink>
        ) : null}
      </div>
    </div>
  );
}

/** "What work is slowing your team down?" Four topics, one native radio group. */
export function WorkflowExplorer() {
  return (
    <fieldset
      className={cx(
        "m-0 grid min-w-0 gap-(--space-5) border-0 p-0 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] lg:items-start",
        ...explorerTopics.map((t) => panelShown[t.slug]),
      )}
    >
      <legend className="sr-only">Choose the kind of work that is slowing your team down</legend>
      <div className="grid gap-(--space-2) sm:grid-cols-2 lg:grid-cols-1">
        {explorerTopics.map((topic, index) => (
          <div key={topic.slug} className="relative">
            <input
              type="radio"
              id={`topic-${topic.slug}`}
              name="aid-topic"
              value={topic.slug}
              defaultChecked={index === 0}
              className="peer sr-only"
            />
            <label
              htmlFor={`topic-${topic.slug}`}
              className={cx(
                "flex h-full min-h-11 cursor-pointer flex-col gap-(--space-1) rounded-lg border border-aid-border bg-aid-surface p-(--space-4)",
                cardLift,
                "peer-checked:border-aid-signal peer-checked:bg-aid-signal-soft peer-checked:shadow-floating",
                "peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-aid-focus",
              )}
            >
              <span className="font-mono text-small text-aid-muted">0{index + 1}</span>
              <span className="text-body-l font-semibold text-aid-heading">{topic.title}</span>
              <span className="text-small text-aid-muted">{topic.symptom}</span>
            </label>
          </div>
        ))}
      </div>
      {explorerTopics.map((topic) => (
        <TopicPanel key={topic.slug} topic={topic} />
      ))}
    </fieldset>
  );
}

/** Three practical flows: input, AI assistance, human review, outcome. */
export function UseCases() {
  const steps = [
    { key: "input", label: "Input", icon: "document" },
    { key: "assist", label: "AI assistance", icon: "chip" },
    { key: "review", label: "Human review", icon: "person" },
    { key: "outcome", label: "Outcome", icon: "target" },
  ] as const;
  return (
    <ul className="m-0 grid list-none gap-(--space-5) p-0 lg:grid-cols-3">
      {useCaseFlows.map((flow) => (
        <li
          key={flow.id}
          className={cx(
            "flex flex-col gap-(--space-4) rounded-xl border border-aid-border bg-aid-surface p-(--space-5)",
            cardLift,
          )}
        >
          <h3 className="m-0 text-h3 text-aid-heading">{flow.title}</h3>
          <ol className="m-0 flex list-none flex-col p-0">
            {steps.map((step, index) => (
              <Fragment key={step.key}>
                <li className="flex gap-(--space-3)">
                  <span
                    className={cx(
                      "mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-md border",
                      step.key === "review"
                        ? "border-aid-signal bg-aid-signal-soft text-aid-signal"
                        : "border-aid-line/50 text-aid-muted",
                    )}
                  >
                    <Icon name={step.icon} size={16} />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col pb-(--space-1)">
                    <span className="text-small font-semibold text-aid-heading">{step.label}</span>
                    <span className="text-aid-text">{flow[step.key]}</span>
                  </span>
                </li>
                {index < steps.length - 1 ? (
                  <li aria-hidden="true" className="ml-4 h-4 w-px bg-aid-line/50" />
                ) : null}
              </Fragment>
            ))}
          </ol>
          <ArrowLink href={flow.href} className="mt-auto">
            More about this
            <span className="sr-only">: {flow.title}</span>
          </ArrowLink>
        </li>
      ))}
    </ul>
  );
}

/** The four offers through the customer's need and the concrete things they receive. No prices. */
export function OfferShowcase() {
  return (
    <div className="flex flex-col gap-(--space-5)">
      <ol className="m-0 grid list-none gap-(--space-5) p-0 md:grid-cols-2 xl:grid-cols-4">
        {offers.map((offer, index) => (
          <li
            key={offer.key}
            className={cx(
              "flex min-w-0 flex-col gap-(--space-4) rounded-xl border border-aid-border bg-aid-surface p-(--space-5)",
              cardLift,
            )}
          >
            <div className="flex items-center justify-between gap-(--space-3)">
              <span className="font-mono text-small text-aid-muted">0{index + 1}</span>
              <span className="text-[0.75rem] font-semibold tracking-[0.08em] text-aid-muted uppercase">
                {["Discover", "Prove", "Build", "Operate"][index]}
              </span>
            </div>
            <h3 className="m-0 text-body-l font-semibold text-aid-heading">{offer.title}</h3>
            <p className="m-0 border-l-2 border-aid-signal pl-(--space-3) text-aid-text italic">
              {offer.need}
            </p>
            <div className="flex flex-col gap-(--space-2)">
              <p className="m-0 text-small font-semibold text-aid-heading">You receive</p>
              <CheckList items={offer.deliverables} className="text-small" />
            </div>
            <ArrowLink href={routes.aiData.contact(offer.key)} className="mt-auto text-small">
              Ask about this<span className="sr-only">: {offer.title}</span>
            </ArrowLink>
          </li>
        ))}
      </ol>
      <p className="m-0 max-w-(--container-prose) text-aid-muted">{feesNote}</p>
    </div>
  );
}
