import { Children, Fragment, isValidElement, useId } from "react";
import type { ComponentPropsWithoutRef, ReactElement, ReactNode } from "react";
import {
  Container,
  Icon,
  PageHero,
  Reveal,
  RevealItem,
  Section,
  SectionHeading,
  TerminalCTA,
} from "@vitalos/ui";
import type { PatternLink, RevealItemProps, SectionSpacing, SectionTone } from "@vitalos/ui";
import { ctas, homeSections, routes } from "@vitalos/cms";
import type { Crumb } from "../../lib/view-mapping/breadcrumbs";
import { heroPhotograph } from "../../lib/view-mapping/hero-images";
import { contactHref } from "../../lib/view-mapping/hrefs";
import { VisibleBreadcrumb } from "../../components/site-chrome/visible-breadcrumb";

/** The homepage's closing heading (locked copy), closing every page. */
const closingHeading =
  homeSections.find((section) => section.key === "finalConversion")?.visibleHeading ?? ctas.primary;

/**
 * Building blocks shared by the commercial templates (home, practices, solutions, offers,
 * industries, how we work). They add layout only: every word comes from props, which come from
 * view models, locked copy or the structural labels in `lib/view-mapping/labels.ts`.
 */

export interface PageIntroProps {
  /** The page's trail: visible above the eyebrow below the top level (VisibleBreadcrumb). */
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
  /** The compact hero of a detail page (smaller title, shorter band); top-level pages omit it. */
  compact?: boolean | undefined;
  /** Media beside the copy from lg: the page's illustration, photograph or MediaSlot. */
  media?: ReactNode;
}

/**
 * First band of a page: the homepage hero's language (pages redesign, 15 Oct 2026). A dark band
 * under the clear header with the hero photograph, rounded bottom corners, the eyebrow, h1, lead
 * and actions, and optional media on the right. The page has no other h1.
 */
export function PageIntro({
  crumbs,
  eyebrow,
  title,
  lead,
  actions,
  children,
  compact,
  media,
}: PageIntroProps) {
  return (
    <PageHero
      tone="dark"
      backdrop={heroPhotograph}
      size={compact ? "title" : "display"}
      before={
        crumbs ? (
          <VisibleBreadcrumb
            trail={crumbs.map((crumb) => ({ name: crumb.label, path: crumb.path }))}
          />
        ) : undefined
      }
      title={title}
      eyebrow={eyebrow}
      lead={lead}
      actions={actions}
      media={media}
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
        {/* A stagger group: the cards and rows inside (CardGrid, RowList, StatementList) enter one
            after another once the band scrolls into view; other content stays still. */}
        <Reveal stagger delay={heading ? 1 : 0} className={heading ? "mt-(--space-7)" : undefined}>
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
    // Two columns only when there are two or more statements: a lone statement keeps a full-width
    // rule instead of a half-width one.
    <ul
      className={`m-0 grid list-none grid-cols-1 gap-x-(--space-7) p-0 ${shown.length > 1 ? "md:grid-cols-2" : ""}`}
    >
      {shown.map((item, index) => (
        <RevealItem
          as="li"
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
        </RevealItem>
      ))}
    </ul>
  );
}

/**
 * Marks each item of a list as a member of the surrounding Band's entrance sequence. In a list
 * (`ul`), an `<li>` becomes a RevealItem rendered as `li` with every one of its props kept; any
 * other child is left as it is (a `<div>` is never put inside a `<ul>`). In a block, each child is
 * wrapped. Outside a Band (no group above it) the items never move.
 */
function asRevealItems(children: ReactNode, container: "list" | "block"): ReactNode {
  return Children.map(children, (child) => {
    if (!isValidElement(child)) return child;
    if (child.type === "li") {
      const { children: content, ...props } = (
        child as ReactElement<ComponentPropsWithoutRef<"li">>
      ).props;
      return (
        <RevealItem as="li" {...(props as RevealItemProps)}>
          {content}
        </RevealItem>
      );
    }
    return container === "list" ? child : <RevealItem>{child}</RevealItem>;
  });
}

/** Rows (PracticeRow, OfferRow, ...) closed by a rule, so the last row has its own bottom edge. */
export function RowList({ children }: Readonly<{ children: ReactNode }>) {
  return <div className="border-b border-tone-border">{asRevealItems(children, "block")}</div>;
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
      {asRevealItems(children, "list")}
    </ul>
  );
}

/**
 * The end of every page: the homepage's closing card (TerminalCTA `feature`, owner direction 15 Oct
 * 2026) with the locked closing heading, the page's own action and an onward link. The card sits
 * on a light band, so it never merges with the midnight footer that follows.
 */
export function ClosingBand({
  primary,
  secondary,
}: Readonly<{
  /** The page's own action; defaults to Talk to Vitalos. */
  primary?: PatternLink | undefined;
  /** Defaults to Explore what we do; `null` leaves it out (for example on What We Do itself). */
  secondary?: PatternLink | null | undefined;
}>) {
  const onward =
    secondary === null
      ? undefined
      : (secondary ?? { label: ctas.secondary, href: routes.whatWeDo() });
  return (
    <TerminalCTA
      variant="feature"
      heading={closingHeading}
      primary={primary ?? { label: ctas.primary, href: contactHref() }}
      {...(onward ? { secondary: onward } : {})}
    />
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
