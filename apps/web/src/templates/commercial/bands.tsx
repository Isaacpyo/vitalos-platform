import { Fragment, useId } from "react";
import type { ReactNode } from "react";
import {
  Breadcrumb,
  Button,
  CTAGroup,
  Container,
  ContentGap,
  Icon,
  PageHero,
  Reveal,
  Section,
  SectionHeading,
} from "@vitalos/ui";
import type { PatternLink, SectionSpacing, SectionTone } from "@vitalos/ui";
import { crumbsToUi } from "../../lib/view-mapping/breadcrumbs";
import type { Crumb } from "../../lib/view-mapping/breadcrumbs";

/**
 * Building blocks shared by the commercial templates (home, practices, solutions, offers,
 * industries, how we work). They add layout only: every word comes from props, which come from
 * view models, locked copy or the structural labels in `lib/view-mapping/labels.ts`.
 */

export interface PageIntroProps {
  crumbs?: readonly Crumb[] | undefined;
  /** Small category line above the title (locked copy or CMS text). */
  eyebrow?: string | undefined;
  /** The page's single h1. */
  title: string;
  lead?: string | undefined;
  /** Actions beside the lead, usually one primary link. */
  actions?: ReactNode;
  /** Extra content under the lead (for example a definition list). */
  children?: ReactNode;
}

/**
 * First band of a page (the owner comp's page hero): breadcrumb, eyebrow, h1, lead and actions
 * on a light field with a decorative angled plane. The page has no other h1.
 */
export function PageIntro({ crumbs, eyebrow, title, lead, actions, children }: PageIntroProps) {
  return (
    <PageHero
      title={title}
      eyebrow={eyebrow}
      lead={lead}
      before={crumbs && crumbs.length > 1 ? <Breadcrumb items={crumbsToUi(crumbs)} /> : undefined}
      actions={actions}
    >
      {children}
    </PageHero>
  );
}

export interface BandProps {
  tone?: SectionTone;
  spacing?: SectionSpacing;
  /** Visible heading of the band. Without one the band is an unnamed container. */
  heading?: string | undefined;
  /** Categorisation line above the heading. */
  eyebrow?: string | undefined;
  /** Short introduction beside the heading (the comp's split section header). */
  intro?: string | undefined;
  /** One onward link beside the heading. */
  link?: PatternLink | undefined;
  children: ReactNode;
  className?: string;
}

/**
 * A page band with an optional h2. A band with a heading is a named region; without one it is a
 * plain container (an unnamed section is not a landmark, so no empty landmark is exposed).
 */
export function Band({
  tone = "light",
  spacing = "default",
  heading,
  eyebrow,
  intro,
  link,
  children,
  className,
}: BandProps) {
  const headingId = useId();
  return (
    <Section
      tone={tone}
      spacing={spacing}
      {...(heading ? { "aria-labelledby": headingId } : { as: "div" as const })}
      {...(className ? { className } : {})}
    >
      <Container size="wide">
        {heading ? (
          <Reveal>
            <SectionHeading
              id={headingId}
              title={heading}
              eyebrow={eyebrow}
              intro={intro}
              link={link}
            />
          </Reveal>
        ) : null}
        <Reveal delay={heading ? 1 : 0} className={heading ? "mt-(--space-7)" : undefined}>
          {children}
        </Reveal>
      </Container>
    </Section>
  );
}

/** Heading level for the items of a band: h3 under a heading, h2 when the band has none. */
export const itemLevel = (heading: string | undefined): 2 | 3 => (heading ? 3 : 2);

/** A band's content that is a plain list of statements (problems, signals, capabilities...). */
export function StatementList({ items }: Readonly<{ items: readonly string[] }>) {
  const shown = items.filter((item) => item.trim() !== "");
  if (shown.length === 0) return null;
  return (
    <ul className="m-0 grid list-none grid-cols-1 gap-x-(--space-7) p-0 md:grid-cols-2">
      {shown.map((item, index) => (
        <li
          key={`${item}-${index}`}
          className="flex min-w-0 items-start gap-(--space-4) border-t border-tone-border py-(--space-5) text-body-l text-tone-text text-pretty"
        >
          <span
            aria-hidden="true"
            className="mt-(--space-1) inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-tone-tile-bg text-tone-tile-fg"
          >
            <Icon name="check" size={16} />
          </span>
          <span className="min-w-0">{item}</span>
        </li>
      ))}
    </ul>
  );
}

/** Rows (PracticeRow, OfferRow, ...) closed by a rule, so the last row has its own bottom edge. */
export function RowList({ children }: Readonly<{ children: ReactNode }>) {
  return <div className="border-b border-tone-border">{children}</div>;
}

const cardColumns = {
  2: "md:grid-cols-2",
  3: "md:grid-cols-2 lg:grid-cols-3",
  /** The comp's row of five solution cards: two, then three, then all five abreast. */
  5: "sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5",
} as const;

/** Cards in a responsive grid; for a few high-value items, never a wall. */
export function CardGrid({
  children,
  columns = 2,
}: Readonly<{ children: ReactNode; columns?: keyof typeof cardColumns }>) {
  return (
    <ul className={`m-0 grid list-none grid-cols-1 gap-(--space-5) p-0 ${cardColumns[columns]}`}>
      {children}
    </ul>
  );
}

/**
 * Closing action of a detail page: one primary link on a quiet band (the midnight footer follows
 * directly, so a dark band here would merge with it).
 */
export function ClosingAction({ link }: Readonly<{ link: PatternLink }>) {
  return (
    <Section as="div" tone="muted" spacing="compact">
      <Container size="wide">
        <CTAGroup>
          <Button href={link.href} size="lg">
            {link.label}
          </Button>
        </CTAGroup>
      </Container>
    </Section>
  );
}

/** A band factory: returns the band for the given surface tone, or null when it has no data. */
export type BandFactory = (tone: SectionTone) => ReactNode | null;

/**
 * Renders the bands that have content and alternates their surface (muted, light, muted ...) so
 * consecutive bands are always distinguishable, whichever of them are absent.
 */
export function renderBands(
  factories: readonly BandFactory[],
  first: Exclude<SectionTone, "dark"> = "muted",
): ReactNode {
  let tone: Exclude<SectionTone, "dark"> = first;
  const out: ReactNode[] = [];
  factories.forEach((factory, index) => {
    const node = factory(tone);
    if (node === null || node === undefined || node === false) return;
    out.push(<Fragment key={index}>{node}</Fragment>);
    tone = tone === "muted" ? "light" : "muted";
  });
  return out;
}

/** The band to show for an empty section: an editor notice in Draft Mode, nothing otherwise. */
export function gapBand(draft: boolean, section: string, tone: SectionTone): ReactNode | null {
  if (!draft) return null;
  return (
    <Band tone={tone}>
      <SectionGap draft section={section} />
    </Band>
  );
}

/**
 * Editor notice for a section that has no content (Draft Mode only; renders nothing for
 * visitors, who simply do not get the section).
 */
export function SectionGap({ draft, section }: Readonly<{ draft: boolean; section: string }>) {
  return (
    <ContentGap
      draft={draft}
      title={`${section}: no content yet`}
      description="Add content for this section in Sanity. Visitors do not see the section until it has content."
    />
  );
}
