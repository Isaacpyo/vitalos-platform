import type { ReactNode } from "react";
import { cx } from "../../primitives/_internal/cx";
import { Eyebrow } from "../../primitives/Eyebrow";
import { Heading, type HeadingLevel } from "../../primitives/Heading";
import { TextLink } from "../../primitives/TextLink";
import { hasText, type PatternLink } from "../_internal/types";

export interface SectionHeadingProps {
  /** The section title. An array sets deliberate line breaks on wide screens (each line wraps naturally on small ones). */
  title: string | readonly string[];
  /** Id of the heading, so the section can be named by it. */
  id?: string | undefined;
  /** Small categorisation line above the title. */
  eyebrow?: string | undefined;
  /** One or two sentences beside the title (below it on compact screens). */
  intro?: string | undefined;
  /** A single onward link beside the title, for example "View all insights". */
  link?: PatternLink | undefined;
  /** Extra content in the aside column, for example carousel controls. */
  aside?: ReactNode;
  level?: Extract<HeadingLevel, 2 | 3> | undefined;
  className?: string | undefined;
}

/**
 * The comp's section header: eyebrow and a large title on the left; a short introduction and
 * one onward link on the right, aligned to the title's baseline from lg. Without an intro or a
 * link it is just the eyebrow and title. Every string comes from props.
 */
export function SectionHeading({
  title,
  id,
  eyebrow,
  intro,
  link,
  aside,
  level = 2,
  className,
}: SectionHeadingProps) {
  const lines = typeof title === "string" ? [title] : title.filter(hasText);
  const hasAside = hasText(intro) || link !== undefined || aside !== undefined;
  return (
    <div
      className={cx(
        "grid gap-x-(--space-8) gap-y-(--space-4)",
        hasAside && "lg:grid-cols-[minmax(0,1fr)_minmax(0,28rem)] lg:items-end",
        className,
      )}
    >
      <div className="min-w-0">
        {hasText(eyebrow) ? <Eyebrow className="mb-(--space-3)">{eyebrow}</Eyebrow> : null}
        <Heading
          {...(id ? { id } : {})}
          level={level}
          size="h2"
          className="max-w-(--container-content)"
        >
          {lines.length === 1
            ? lines[0]
            : lines.map((line, index) => (
                <span key={`${line}-${index}`} className="lg:block">
                  {line}
                  {index < lines.length - 1 ? " " : null}
                </span>
              ))}
        </Heading>
      </div>
      {hasAside ? (
        <div className="min-w-0 lg:pb-(--space-1)">
          {hasText(intro) ? (
            <p className="m-0 text-body text-tone-text text-pretty">{intro}</p>
          ) : null}
          {link ? (
            <p className={cx("m-0", hasText(intro) && "mt-(--space-3)")}>
              <TextLink href={link.href}>{link.label}</TextLink>
            </p>
          ) : null}
          {aside}
        </div>
      ) : null}
    </div>
  );
}
