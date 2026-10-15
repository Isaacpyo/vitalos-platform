import { cx } from "../../primitives/_internal/cx";
import { Icon } from "../../primitives/Icon";
import { Heading } from "../../primitives/Heading";
import { Reveal, RevealItem } from "../../motion/Reveal";
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
  /** Anchor id for the stage, so other pages can link to it (for example `stage-design`). */
  id?: string | undefined;
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

/** Horizontal step layouts with connectors, by stage count (more than five use a grid). */
const stepColumns: Record<number, string> = {
  1: "",
  2: "lg:grid-cols-2",
  3: "lg:grid-cols-3",
  4: "lg:grid-cols-4",
  5: "lg:grid-cols-5",
};

/**
 * Stage-by-stage journey (the AI journey, How We Work), in the owner comp's step style: a
 * numbered node per stage, joined by a connector. An ordered list throughout.
 *
 * - Up to five stages: a vertical timeline on compact screens and one row of steps from lg, with
 *   arrowed connectors. When the list scrolls into view the numbered nodes and the connectors
 *   draw in sequence (diagram motion, Stage 9 section 11: each connector over 600ms). Only the
 *   decorative nodes and connectors move; the stage text never does. Nothing moves without
 *   JavaScript, under reduced motion or when the list is already on screen (`Reveal stagger`).
 * - More than five: a two- and three-column grid of numbered stages, without connectors.
 *
 * Each stage can state deliverables, evidence and a decision gate. Stage names come from the
 * caller.
 */
export function ProcessJourney({
  stages,
  labels,
  headingLevel = 3,
  "aria-label": ariaLabel,
  className,
}: ProcessJourneyProps) {
  if (!isNonEmpty(stages)) return null;
  const steps = stages.length <= 5;
  const last = stages.length - 1;
  return (
    <Reveal
      as="ol"
      stagger={0.12}
      {...(ariaLabel ? { "aria-label": ariaLabel } : {})}
      className={cx(
        "group/journey m-0 grid list-none grid-cols-1 gap-y-(--space-6) p-0",
        steps
          ? cx("lg:gap-x-(--space-5)", stepColumns[stages.length])
          : "md:grid-cols-2 md:gap-x-(--space-6) lg:grid-cols-3 lg:gap-y-(--space-7)",
        className,
      )}
    >
      {stages.map((stage, index) => {
        const deliverables = (stage.deliverables ?? []).filter(hasText);
        return (
          <li
            key={`${stage.title}-${index}`}
            {...(stage.id ? { id: stage.id } : {})}
            className={cx(
              "relative flex min-w-0 scroll-mt-[calc(var(--size-header)+var(--space-6))] gap-(--space-4)",
              steps ? "lg:block" : "md:block",
              // Compact timeline: a rule joins each node to the next.
              index < last &&
                "before:absolute before:top-16 before:bottom-[calc(-1*var(--space-6)+0.5rem)] before:left-7 before:w-px before:bg-tone-border",
              index < last && (steps ? "lg:before:hidden" : "md:before:hidden"),
            )}
          >
            <div className="relative shrink-0">
              <RevealItem
                as="span"
                effect="pop"
                aria-hidden="true"
                className="relative inline-flex size-14 items-center justify-center rounded-full bg-tone-tile-bg text-small font-semibold text-tone-tile-fg ring-1 ring-tone-border"
              >
                {String(index + 1).padStart(2, "0")}
              </RevealItem>
              {steps && index < last ? (
                <RevealItem
                  as="span"
                  effect="draw"
                  aria-hidden="true"
                  className="absolute top-7 right-(--space-2) left-[calc(3.5rem+var(--space-3))] hidden -translate-y-1/2 origin-left items-center text-tone-eyebrow lg:flex"
                >
                  <span className="h-px flex-1 bg-current" />
                  <Icon name="chevron-right" size={16} className="-ml-2.5" />
                </RevealItem>
              ) : null}
            </div>
            <div
              className={cx(
                "min-w-0 pt-(--space-3)",
                steps ? "lg:pt-(--space-5)" : "md:pt-(--space-4)",
              )}
            >
              <Heading level={headingLevel} size={steps ? "h4" : "h3"}>
                {stage.title}
              </Heading>
              {hasText(stage.summary) ? (
                <p className="m-0 mt-(--space-2) text-body text-tone-text text-pretty">
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
            </div>
          </li>
        );
      })}
    </Reveal>
  );
}
