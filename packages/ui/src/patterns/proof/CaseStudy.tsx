import { cx } from "../../primitives/_internal/cx";
import { Icon } from "../../primitives/Icon";
import { MetaRow, type MetaItem } from "../../primitives/MetaRow";
import { CardTitle } from "../_internal/CardTitle";
import { EditorialRow, type RowBaseProps } from "../_internal/EditorialRow";
import { PatternMedia } from "../_internal/Media";
import {
  hasText,
  type ItemHeadingLevel,
  type NonEmptyArray,
  type PatternImage,
} from "../_internal/types";
import { OutcomeStatList, type OutcomeStatItem } from "./OutcomeStats";

export interface CaseStudyFeatureProps {
  /** Outcome-led headline. */
  title: string;
  href: string;
  /** Concise challenge, plain text. */
  challenge?: string | undefined;
  /** One to three sourced metrics. Unsourced or unverified ones are dropped. */
  metrics?: NonEmptyArray<OutcomeStatItem> | undefined;
  /** Industry or sector label. */
  sector?: string | undefined;
  /** Labelled facts (client display, engagement basis). Labels come from the caller. */
  meta?: readonly MetaItem[] | undefined;
  /** Optional. The feature is complete without an image. */
  image?: PatternImage | undefined;
  headingLevel?: ItemHeadingLevel | undefined;
  className?: string | undefined;
}

/** Large editorial module: outcome-led headline, challenge, 1 to 3 metrics, industry and link. */
export function CaseStudyFeature({
  title,
  href,
  challenge,
  metrics,
  sector,
  meta,
  image,
  headingLevel = 3,
  className,
}: CaseStudyFeatureProps) {
  return (
    <article
      data-kind="case-study"
      className={cx(
        "group relative grid min-w-0 overflow-hidden rounded-lg border border-tone-border bg-tone-bg",
        image ? "lg:grid-cols-2" : "",
        className,
      )}
    >
      {image ? <PatternMedia image={image} className="h-full max-h-96 lg:max-h-none" /> : null}
      <div className="flex min-w-0 flex-col gap-(--space-5) p-(--space-5) md:p-(--space-6)">
        {hasText(sector) ? (
          <p className="text-eyebrow text-tone-muted uppercase">{sector}</p>
        ) : null}
        <CardTitle level={headingLevel} size="h2" href={href}>
          {title}
        </CardTitle>
        {hasText(challenge) ? (
          <p className="max-w-(--container-prose) text-body-l text-tone-text text-pretty">
            {challenge}
          </p>
        ) : null}
        <OutcomeStatList stats={metrics} max={3} className="relative" />
        {meta && meta.length > 0 ? <MetaRow items={meta} /> : null}
        <Icon
          name="arrow-right"
          size={24}
          className="self-start text-tone-heading transition-transform duration-(--duration-feedback) ease-(--ease-standard) group-hover:translate-x-1"
        />
      </div>
    </article>
  );
}

export interface CaseStudyRowProps extends RowBaseProps {
  /** At most the first sourced metric is shown, as the proof headline of the row. */
  metrics?: NonEmptyArray<OutcomeStatItem> | undefined;
}

/** Compact case-study row: title, summary, labelled facts and one sourced metric. */
export function CaseStudyRow({ metrics, ...row }: CaseStudyRowProps) {
  return (
    <EditorialRow kind="case-study" {...row}>
      <OutcomeStatList stats={metrics} max={1} className="mt-(--space-4)" />
    </EditorialRow>
  );
}
