import type { ReactNode } from "react";
import { cx } from "../../primitives/_internal/cx";
import { Icon } from "../../primitives/Icon";
import { MetaRow, type MetaItem } from "../../primitives/MetaRow";
import { CardTitle } from "./CardTitle";
import { PatternMedia } from "./Media";
import { hasText, type ItemHeadingLevel, type PatternImage } from "./types";

/** Props shared by the cards (solution, link). */
export interface CardBaseProps {
  title: string;
  href: string;
  summary?: string | undefined;
  /** Small classification above the title, for example the kind of content. */
  eyebrow?: string | undefined;
  meta?: readonly MetaItem[] | undefined;
  /** Optional. The card is complete without an image. */
  image?: PatternImage | undefined;
  headingLevel?: ItemHeadingLevel | undefined;
  className?: string | undefined;
}

interface FeatureCardProps extends CardBaseProps {
  kind?: string;
  children?: ReactNode;
}

/** Bordered card with one stretched link. Fills its grid cell; content decides the height. */
export function FeatureCard({
  title,
  href,
  summary,
  eyebrow,
  meta,
  image,
  headingLevel = 3,
  className,
  kind,
  children,
}: FeatureCardProps) {
  return (
    <article
      {...(kind ? { "data-kind": kind } : {})}
      className={cx(
        "group relative flex h-full min-w-0 flex-col overflow-hidden rounded-md border border-tone-border bg-tone-bg",
        "transition-colors duration-(--duration-feedback) ease-(--ease-standard) hover:border-tone-heading",
        className,
      )}
    >
      {image ? <PatternMedia image={image} className="aspect-[3/2]" /> : null}
      <div className="flex min-w-0 flex-1 flex-col gap-(--space-3) p-(--space-5)">
        {hasText(eyebrow) ? (
          <p className="text-eyebrow text-tone-muted uppercase">{eyebrow}</p>
        ) : null}
        <CardTitle level={headingLevel} size="h3" href={href}>
          {title}
        </CardTitle>
        {hasText(summary) ? (
          <p className="text-body text-tone-text text-pretty">{summary}</p>
        ) : null}
        {meta && meta.length > 0 ? <MetaRow items={meta} /> : null}
        {children}
        <Icon
          name="arrow-right"
          size={20}
          className="mt-auto self-start pt-0 text-tone-heading transition-transform duration-(--duration-feedback) ease-(--ease-standard) group-hover:translate-x-1"
        />
      </div>
    </article>
  );
}
