import type { ReactNode } from "react";
import { cx } from "../../primitives/_internal/cx";
import { Container, type ContainerSize } from "../../primitives/Container";
import { CTAGroup } from "../../primitives/CTAGroup";
import { Display } from "../../primitives/Display";
import { Eyebrow } from "../../primitives/Eyebrow";
import { Heading } from "../../primitives/Heading";
import { Lead } from "../../primitives/Lead";
import { Section } from "../../primitives/Section";
import { hasText } from "../_internal/types";
import { HeroArtwork, type ArtworkSpec } from "../artwork/HeroArtwork";

export interface PageHeroProps {
  /** The page's single h1. */
  title: string;
  eyebrow?: string | undefined;
  lead?: string | undefined;
  /** Rendered above the eyebrow, for example the breadcrumb. */
  before?: ReactNode;
  /** Rendered directly under the h1, before the lead (a maturity badge, a status). */
  afterTitle?: ReactNode;
  /** Actions under the lead, usually one primary link. */
  actions?: ReactNode;
  /** Extra content at the end of the hero (a definition list, a summary). */
  children?: ReactNode;
  /** display: large display type (commercial pages); title: the H1 role (content pages). */
  size?: "display" | "title";
  /** Width of the content, matching the bands that follow (wide by default). */
  containerSize?: ContainerSize | undefined;
  /**
   * `dark`: the homepage hero's language for a top-level page (and the dark detail pages of the
   * What We Do and Industries families): a midnight band that starts under the clear header
   * (SiteHeader `overlay`), with rounded bottom corners. `light` (default): the compact light hero
   * of a reading page (offers, articles, roles, legal, Trust topics; ADR-044): an off-white band
   * under the solid header, closed by a hairline rule.
   */
  tone?: "light" | "dark" | undefined;
  /**
   * The page family's brand-system artwork (ADR-044), drawn on the right of the band; the item
   * seed gives each practice, solution, offer or industry its own variant.
   */
  artwork?: ArtworkSpec | undefined;
  /** Media beside the copy from lg (a line diagram, a MediaSlot, a summary panel). */
  media?: ReactNode;
  className?: string | undefined;
}

/**
 * First band of a page. Every string comes from props; the artwork is decorative and hidden from
 * assistive technology, and it never sits behind the text: from md it fills the right of the band,
 * and below md the light hero shows none (the dark hero shows a strip under the copy instead).
 */
export function PageHero({
  title,
  eyebrow,
  lead,
  before,
  afterTitle,
  actions,
  children,
  size = "display",
  containerSize = "wide",
  tone = "light",
  artwork,
  media,
  className,
}: PageHeroProps) {
  if (tone === "dark") {
    return (
      <DarkPageHero
        {...{ title, eyebrow, lead, before, afterTitle, actions, size, containerSize, artwork }}
        media={media}
        className={className}
      >
        {children}
      </DarkPageHero>
    );
  }
  return (
    <Section
      as="div"
      tone="muted"
      spacing="compact"
      data-hero="light"
      className={cx("relative isolate overflow-hidden border-b border-tone-border", className)}
    >
      {artwork ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-0 -z-10 hidden w-[42%] md:block"
        >
          <HeroArtwork {...artwork} className="size-full" />
        </div>
      ) : null}
      <Container
        size={containerSize}
        className={cx(
          "grid items-start gap-x-(--space-8) gap-y-(--space-7)",
          media ? "lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]" : undefined,
        )}
      >
        <div className={cx("min-w-0", artwork && !media ? "md:max-w-[58%]" : undefined)}>
          {before ? <div className="mb-(--space-6)">{before}</div> : null}
          {hasText(eyebrow) ? <Eyebrow className="mb-(--space-3)">{eyebrow}</Eyebrow> : null}
          {size === "display" ? (
            <Display size="l" as="h1" className="max-w-(--container-content) break-words">
              {title}
            </Display>
          ) : (
            <Heading level={1} className="max-w-(--container-content) break-words">
              {title}
            </Heading>
          )}
          {afterTitle ? <div className="mt-(--space-4)">{afterTitle}</div> : null}
          {hasText(lead) ? (
            <Lead className="mt-(--space-5) max-w-(--container-prose)">{lead}</Lead>
          ) : null}
          {actions ? <CTAGroup className="mt-(--space-6)">{actions}</CTAGroup> : null}
          {children ? <div className="mt-(--space-7)">{children}</div> : null}
        </div>
        {media ? <div className="min-w-0">{media}</div> : null}
      </Container>
    </Section>
  );
}

/**
 * The dark page hero (owner direction, 15 Oct 2026: every page takes the homepage's design). The
 * band starts under the clear header and runs to the top; its bottom corners are rounded like the
 * homepage hero. Its artwork (ADR-044, replacing the photograph) fills the right of the band from
 * lg and runs as a strip under the copy below lg; it is static, so no pause switch is needed
 * (WCAG 2.2.2).
 * `display` is the full hero of a top-level page; `title` is the compact hero of a detail page.
 * Media sits beside the copy from lg and under it on compact screens.
 */
function DarkPageHero({
  title,
  eyebrow,
  lead,
  before,
  afterTitle,
  actions,
  children,
  size,
  containerSize,
  artwork,
  media,
  className,
}: Omit<PageHeroProps, "tone">) {
  const full = size === "display";
  return (
    <Section
      as="div"
      tone="dark"
      spacing="default"
      className={cx(
        "relative isolate -mt-(--size-header) overflow-hidden rounded-b-[1.75rem] lg:rounded-b-[3rem]",
        full
          ? "pt-[calc(var(--section-default)+var(--size-header))]"
          : "pt-[calc(var(--section-compact)+var(--size-header))] pb-(--section-compact)",
        className,
      )}
    >
      {artwork ? (
        <div
          aria-hidden="true"
          className={cx(
            "pointer-events-none absolute inset-y-0 right-0 -z-10 hidden lg:block",
            media ? "w-[46%]" : "w-[58%]",
          )}
        >
          <HeroArtwork {...artwork} className="size-full" />
        </div>
      ) : null}
      <Container
        size={containerSize ?? "wide"}
        className={cx(
          "grid items-center gap-x-(--space-8) gap-y-(--space-8)",
          media ? "lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]" : undefined,
        )}
      >
        {/* With artwork and no media, the copy keeps to the left so it never runs over the bands. */}
        <div className={cx("min-w-0", artwork && !media ? "lg:max-w-[50%]" : undefined)}>
          {before ? <div className="mb-(--space-6)">{before}</div> : null}
          {hasText(eyebrow) ? <Eyebrow className="mb-(--space-3)">{eyebrow}</Eyebrow> : null}
          {full ? (
            <Display size="l" as="h1" className="max-w-(--container-content) break-words">
              {title}
            </Display>
          ) : (
            <Heading level={1} className="max-w-(--container-content) break-words">
              {title}
            </Heading>
          )}
          {afterTitle ? <div className="mt-(--space-4)">{afterTitle}</div> : null}
          {hasText(lead) ? (
            <Lead className="mt-(--space-5) max-w-(--container-prose)">{lead}</Lead>
          ) : null}
          {actions ? <CTAGroup className="mt-(--space-7)">{actions}</CTAGroup> : null}
          {children ? <div className="mt-(--space-7)">{children}</div> : null}
        </div>
        {/* The media (illustration or photograph) shows from lg only: on phones and tablets the hero
            is the title, lead and action (owner direction, 16 Oct 2026). */}
        {media ? <div className="hidden w-full min-w-0 lg:block">{media}</div> : null}
      </Container>
      {artwork ? (
        <div
          aria-hidden="true"
          className={cx(
            "pointer-events-none mt-(--space-7) h-28 lg:hidden",
            full ? "-mb-(--section-default)" : "-mb-(--section-compact)",
          )}
        >
          <HeroArtwork {...artwork} crop="strip" className="size-full" />
        </div>
      ) : null}
    </Section>
  );
}
