import type { ReactNode } from "react";
import { cx } from "../../primitives/_internal/cx";
import { Heading } from "../../primitives/Heading";
import { Icon } from "../../primitives/Icon";
import { Tag } from "../../primitives/Tag";
import { PatternMedia } from "../_internal/Media";
import {
  hasText,
  type ItemHeadingLevel,
  type PatternImage,
  type PatternLink,
} from "../_internal/types";

/** Up to two initials from a name, for the portrait placeholder. */
function initials(name: string): string {
  const letters = name
    .split(/\s+/)
    .map((part) => /\p{L}/u.exec(part)?.[0] ?? "")
    .filter((letter) => letter !== "");
  const first = letters[0] ?? "";
  const last = letters.length > 1 ? (letters[letters.length - 1] ?? "") : "";
  return `${first}${last}`.toUpperCase();
}

/** Square monogram shown when there is no approved portrait. Decorative. */
function Monogram({ name, className }: { name: string; className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cx(
        "flex aspect-[4/5] w-full items-center justify-center rounded-md border border-tone-border bg-tone-bg text-h2 font-semibold text-tone-muted",
        className,
      )}
    >
      {initials(name)}
    </div>
  );
}

export interface PersonCardProps {
  /** Matches PersonView.name (PersonSummary carries it as `title`). */
  name: string;
  role?: string | undefined;
  /** Profile link. The name becomes the link; the whole card is its target. */
  href?: string | undefined;
  /** Areas of expertise, shown as tags. */
  expertise?: readonly string[] | undefined;
  /** Approved portrait. Optional: a monogram stands in without it. */
  portrait?: PatternImage | undefined;
  headingLevel?: ItemHeadingLevel | undefined;
  className?: string | undefined;
}

/** Portrait, name, role and expertise (Stage 9 section 17 "Person card"). */
export function PersonCard({
  name,
  role,
  href,
  expertise,
  portrait,
  headingLevel = 3,
  className,
}: PersonCardProps) {
  if (!hasText(name)) return null;
  const tags = (expertise ?? []).filter(hasText);
  return (
    <article
      data-kind="person"
      className={cx("group relative flex h-full min-w-0 flex-col gap-(--space-4)", className)}
    >
      {/* A single-column phone layout caps the portrait so one card does not fill the screen. */}
      {portrait ? (
        <PatternMedia image={portrait} className="aspect-[4/5] max-w-64 rounded-md sm:max-w-none" />
      ) : (
        <Monogram name={name} className="max-w-64 sm:max-w-none" />
      )}
      <div className="min-w-0">
        <Heading level={headingLevel} size="h4" className="min-w-0">
          {href ? (
            <a
              href={href}
              className="text-tone-heading no-underline after:absolute after:inset-0 after:content-[''] hover:underline hover:underline-offset-4"
            >
              {name}
            </a>
          ) : (
            name
          )}
        </Heading>
        {hasText(role) ? (
          <p className="m-0 mt-(--space-1) text-small text-tone-muted">{role}</p>
        ) : null}
        {tags.length > 0 ? (
          <ul className="m-0 mt-(--space-3) flex list-none flex-wrap gap-(--space-2) p-0">
            {tags.map((tag, index) => (
              <Tag as="li" key={`${tag}-${index}`}>
                {tag}
              </Tag>
            ))}
          </ul>
        ) : null}
      </div>
    </article>
  );
}

export interface PersonHeroProps {
  name: string;
  role?: string | undefined;
  /** Short introduction, plain text. */
  intro?: string | undefined;
  /** Approved portrait. Optional: the hero works without it. */
  portrait?: PatternImage | undefined;
  /** Verified external profile links only. */
  links?: readonly PatternLink[] | undefined;
  /** Further content, for example the rendered biography. */
  children?: ReactNode;
  /** Outline level of the name. Defaults to 1 (a profile page's H1). */
  headingLevel?: 1 | 2;
  className?: string | undefined;
}

/** Profile heading: name, role, introduction, portrait when approved, verified links. */
export function PersonHero({
  name,
  role,
  intro,
  portrait,
  links,
  children,
  headingLevel = 1,
  className,
}: PersonHeroProps) {
  if (!hasText(name)) return null;
  const verified = (links ?? []).filter((link) => hasText(link.label) && hasText(link.href));
  return (
    <div
      data-kind="person-hero"
      className={cx(
        "grid min-w-0 gap-x-(--space-7) gap-y-(--space-6)",
        "md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]",
        className,
      )}
    >
      <div className="min-w-0 max-w-xs md:max-w-none">
        {portrait ? (
          <PatternMedia image={portrait} className="aspect-[4/5] rounded-md" />
        ) : (
          <Monogram name={name} />
        )}
      </div>
      <div className="min-w-0">
        <Heading level={headingLevel} size="h1">
          {name}
        </Heading>
        {hasText(role) ? (
          <p className="m-0 mt-(--space-3) text-body-l text-tone-muted">{role}</p>
        ) : null}
        {hasText(intro) ? (
          <p className="m-0 mt-(--space-5) max-w-(--container-prose) text-body-l text-tone-text text-pretty">
            {intro}
          </p>
        ) : null}
        {verified.length > 0 ? (
          <ul className="m-0 mt-(--space-5) flex list-none flex-wrap gap-x-(--space-5) gap-y-(--space-2) p-0">
            {verified.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  className="inline-flex items-center gap-(--space-2) font-semibold text-tone-link underline underline-offset-4 hover:text-tone-link-hover"
                >
                  <span>{link.label}</span>
                  <Icon name="arrow-up-right" size={16} />
                </a>
              </li>
            ))}
          </ul>
        ) : null}
        {children ? <div className="mt-(--space-6)">{children}</div> : null}
      </div>
    </div>
  );
}
