import { cx } from "../../primitives/_internal/cx";
import { Heading } from "../../primitives/Heading";
import { hasText, isNonEmpty, type ItemHeadingLevel, type NonEmptyArray } from "../_internal/types";

export interface JourneyStage {
  /** Stage name. */
  title: string;
  summary?: string | undefined;
  deliverables?: readonly string[] | undefined;
  /** What evidence the stage produces. */
  evidence?: string | undefined;
  /** The decision made before the next stage. */
  decisionGate?: string | undefined;
}

export interface ProcessJourneyProps {
  /** Ordered stages. At least one is required; an empty list renders nothing. */
  stages: NonEmptyArray<JourneyStage>;
  /** Labels of the optional parts of a stage. Defaults are structural English labels. */
  labels?:
    | {
        deliverables?: string | undefined;
        evidence?: string | undefined;
        decisionGate?: string | undefined;
      }
    | undefined;
  /** Outline level of each stage title. Defaults to 3. */
  headingLevel?: ItemHeadingLevel | undefined;
  /** Accessible name of the ordered list. */
  "aria-label"?: string | undefined;
  className?: string | undefined;
}

/**
 * Stage-by-stage journey (the AI journey, How We Work). An ordered list: a vertical timeline on
 * compact screens and a horizontal step layout from lg that wraps if there are many stages. Each
 * stage can state deliverables, evidence and a decision gate. Stage names come from the caller.
 */
export function ProcessJourney({
  stages,
  labels,
  headingLevel = 3,
  "aria-label": ariaLabel,
  className,
}: ProcessJourneyProps) {
  if (!isNonEmpty(stages)) return null;
  return (
    <ol
      {...(ariaLabel ? { "aria-label": ariaLabel } : {})}
      className={cx(
        "m-0 grid list-none grid-cols-1 gap-y-(--space-6) p-0 lg:grid-cols-[repeat(auto-fit,minmax(15rem,1fr))] lg:gap-x-(--space-5)",
        className,
      )}
    >
      {stages.map((stage, index) => {
        const deliverables = (stage.deliverables ?? []).filter(hasText);
        return (
          <li
            key={`${stage.title}-${index}`}
            className="min-w-0 border-l-2 border-tone-heading pl-(--space-5) lg:border-t-2 lg:border-l-0 lg:pt-(--space-4) lg:pl-0"
          >
            <p className="m-0 text-eyebrow text-tone-muted" aria-hidden="true">
              {String(index + 1).padStart(2, "0")}
            </p>
            <Heading level={headingLevel} size="h3" className="mt-(--space-1)">
              {stage.title}
            </Heading>
            {hasText(stage.summary) ? (
              <p className="m-0 mt-(--space-3) text-body text-tone-text text-pretty">
                {stage.summary}
              </p>
            ) : null}
            {deliverables.length > 0 ? (
              <div className="mt-(--space-4)">
                <p className="m-0 text-small font-semibold text-tone-heading">
                  {labels?.deliverables ?? "Deliverables"}
                </p>
                <ul className="m-0 mt-(--space-1) list-disc pl-(--space-5) text-body text-tone-text">
                  {deliverables.map((item, itemIndex) => (
                    <li key={`${item}-${itemIndex}`}>{item}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {hasText(stage.evidence) ? (
              <p className="m-0 mt-(--space-4) text-body text-tone-text">
                <span className="font-semibold text-tone-heading">
                  {labels?.evidence ?? "Evidence"}:
                </span>{" "}
                {stage.evidence}
              </p>
            ) : null}
            {hasText(stage.decisionGate) ? (
              <p className="m-0 mt-(--space-4) text-body text-tone-text">
                <span className="font-semibold text-tone-heading">
                  {labels?.decisionGate ?? "Decision gate"}:
                </span>{" "}
                {stage.decisionGate}
              </p>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
