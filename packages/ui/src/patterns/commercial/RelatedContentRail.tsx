import { useId } from "react";
import { cx } from "../../primitives/_internal/cx";
import { Heading, type HeadingLevel } from "../../primitives/Heading";
import { isNonEmpty, hasText, type NonEmptyArray } from "../_internal/types";
import { LinkCard, type LinkCardProps } from "./cards";

export interface RelatedContentRailProps {
  /** Visible heading, supplied by the caller. Names the landmark. */
  heading: string;
  /**
   * Contextually related items. The type requires at least one; an empty list renders nothing.
   * Normal vertical flow in a responsive grid: never a carousel (Stage 9 section 17).
   */
  items: NonEmptyArray<LinkCardProps>;
  headingLevel?: HeadingLevel | undefined;
  /** Id for the heading; defaults to a value derived from the first item. */
  id?: string | undefined;
  className?: string | undefined;
}

/** Related content after substantive content: a heading and a grid of LinkCards. */
export function RelatedContentRail({
  heading,
  items,
  headingLevel = 2,
  id,
  className,
}: RelatedContentRailProps) {
  const generatedId = useId();
  const headingId = id ?? generatedId;
  if (!isNonEmpty(items) || !hasText(heading)) return null;
  return (
    <section aria-labelledby={headingId} className={cx("min-w-0", className)}>
      <Heading id={headingId} level={headingLevel} size="h3">
        {heading}
      </Heading>
      <ul className="m-0 mt-(--space-5) grid list-none grid-cols-1 gap-(--space-5) p-0 md:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <li key={`${item.kind}-${item.href}`} className="min-w-0">
            <LinkCard {...item} headingLevel={item.headingLevel ?? nextLevel(headingLevel)} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function nextLevel(level: HeadingLevel): 3 | 4 | 5 {
  return level <= 2 ? 3 : level === 3 ? 4 : 5;
}
