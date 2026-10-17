import type { ReactNode } from "react";
import { routes } from "@vitalos/cms";
import { TextLink } from "@vitalos/ui";
import {
  aboutVitalos,
  closesLine,
  practicesLine,
  roleFactsLine,
  rolePathOf,
} from "../../features/content/careers/model";
import type { Fact, RoleSummaryData } from "../../features/content/careers/model";
import { CardArrow, monoLabel } from "../insights/card";

/**
 * Building blocks of the Careers pages (brief 6.1, 6.2, 6.5) in the site's design (pages
 * redesign, 15 Oct 2026): hairline rows with the round arrow, as the site's other row lists.
 * Tokens only.
 */

/** A role as a full-width link row: title, mono facts, salary, closing date, the round arrow. */
export function RoleRow({
  role,
  headingLevel = 3,
}: Readonly<{ role: RoleSummaryData; headingLevel?: 2 | 3 | 4 }>) {
  const Title = `h${headingLevel}` as "h3";
  const closes = closesLine(role);
  return (
    <article className="group relative flex items-center justify-between gap-(--space-5) border-b border-tone-border py-(--space-6)">
      <div className="flex min-w-0 flex-col gap-(--space-2)">
        <Title className="m-0 text-h3 text-tone-heading text-balance">
          <a
            href={rolePathOf(role.slug)}
            className="after:absolute after:inset-0 hover:text-tone-link-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tone-focus"
          >
            {role.title}
          </a>
        </Title>
        <p className={`${monoLabel} m-0 text-tone-muted`}>{roleFactsLine(role)}</p>
        {role.salary ? <p className="m-0 text-body text-tone-text">{role.salary.label}</p> : null}
        {closes ? <p className="m-0 text-small text-tone-muted">{closes}</p> : null}
      </div>
      <CardArrow />
    </article>
  );
}

export function RoleList({
  roles,
  headingLevel = 3,
}: Readonly<{ roles: readonly RoleSummaryData[]; headingLevel?: 2 | 3 | 4 }>) {
  return (
    <ul className="m-0 list-none border-t border-tone-border p-0">
      {roles.map((role) => (
        <li key={role.id}>
          <RoleRow role={role} headingLevel={headingLevel} />
        </li>
      ))}
    </ul>
  );
}

/** The role's facts between hairlines: mono labels, plain values. */
export function FactsGrid({ facts }: Readonly<{ facts: readonly Fact[] }>) {
  return (
    <dl className="m-0 grid grid-cols-1 gap-x-(--space-6) gap-y-(--space-4) border-y border-tone-border py-(--space-5) sm:grid-cols-2 lg:grid-cols-4">
      {facts.map((fact) => (
        <div key={fact.label} className="min-w-0">
          <dt className={`${monoLabel} text-tone-muted`}>{fact.label}</dt>
          <dd className="m-0 mt-(--space-1) text-body text-tone-heading">{fact.value}</dd>
        </div>
      ))}
    </dl>
  );
}

const proseClasses =
  "text-body-l text-tone-text [&_a]:text-tone-link [&_a]:underline [&_a]:underline-offset-4 [&_li]:my-(--space-2) [&_ol]:list-decimal [&_ol]:pl-(--space-5) [&_p]:my-(--space-4) [&_ul]:list-disc [&_ul]:pl-(--space-5) [&_h2]:text-h3 [&_h3]:text-body-l [&_h3]:font-semibold";

/**
 * The hiring process as its own panel (review 17 Oct 2026, B7): the role's text, else the careers
 * default. The caller renders it only when there is text, so an empty setting shows nothing.
 */
export function ProcessBlock({
  id,
  heading,
  html,
}: Readonly<{ id: string; heading: string; html: string }>) {
  return (
    <section
      aria-labelledby={id}
      className="mt-(--space-8) max-w-[68ch] rounded-2xl border border-tone-border bg-tone-tile-bg p-(--space-6) md:p-(--space-7)"
    >
      <h2 id={id} className="m-0 text-h2 text-tone-heading">
        {heading}
      </h2>
      <div
        className={`mt-(--space-4) ${proseClasses} [&_ol>li]:marker:font-mono [&_ol>li]:marker:text-tone-muted [&>:last-child]:mb-0`}
        // Sanitised by the site's one renderer (role or settings context).
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </section>
  );
}

/**
 * "About Vitalos" at the end of a role (review 17 Oct 2026, B7): the locked proposition and the
 * six-practices line, both from `@vitalos/cms` exports, with links to About and What We Do.
 */
export function AboutVitalosStrip({ id = "about-vitalos" }: Readonly<{ id?: string }>) {
  return (
    <section
      aria-labelledby={id}
      className="mt-(--space-8) flex flex-col gap-(--space-4) border-t border-tone-border pt-(--space-7) md:flex-row md:items-start md:justify-between md:gap-(--space-8)"
    >
      <div className="max-w-[68ch]">
        <h2 id={id} className="m-0 text-h3 text-tone-heading">
          {aboutVitalos.heading}
        </h2>
        <p className="m-0 mt-(--space-3) text-body-l text-tone-text">{aboutVitalos.lead}</p>
        <p className="m-0 mt-(--space-3) text-body text-tone-text">{practicesLine()}</p>
      </div>
      <ul className="m-0 flex list-none flex-col gap-(--space-3) p-0 md:shrink-0">
        <li>
          <TextLink href={routes.about()}>{aboutVitalos.aboutLink}</TextLink>
        </li>
        <li>
          <TextLink href={routes.whatWeDo()}>{aboutVitalos.whatWeDoLink}</TextLink>
        </li>
      </ul>
    </section>
  );
}

/** A titled block of rendered (sanitised) Markdown. */
export function HtmlSection({
  id,
  heading,
  html,
  children,
}: Readonly<{ id: string; heading: string; html?: string; children?: ReactNode }>) {
  return (
    <section aria-labelledby={id} className="mt-(--space-8) max-w-[68ch]">
      <h2 id={id} className="m-0 text-h2 text-tone-heading">
        {heading}
      </h2>
      {html ? (
        <div
          className={`mt-(--space-4) ${proseClasses}`}
          // Sanitised by the site's one renderer (role or settings context).
          dangerouslySetInnerHTML={{ __html: html }}
        />
      ) : null}
      {children}
    </section>
  );
}
