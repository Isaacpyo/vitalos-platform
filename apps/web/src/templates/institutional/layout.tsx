import type { ReactNode } from "react";
import { Container, Eyebrow, Heading, Lead, PageHero, Section, Stack } from "@vitalos/ui";
import type { HeadingLevel, ContainerSize, SectionTone } from "@vitalos/ui";
import { heroPhotograph } from "../../lib/view-mapping/hero-images";

/** A page band: Section plus Container. The page's own `<main>` is `PageMain`. */
export function PageBand({
  children,
  tone,
  size = "content",
  spacing = "default",
  labelledBy,
}: Readonly<{
  children: ReactNode;
  tone?: SectionTone;
  size?: ContainerSize;
  spacing?: "compact" | "default" | "large";
  /** Id of the band's heading: names the landmark. Omit for the page header band. */
  labelledBy?: string;
}>) {
  return (
    <Section
      spacing={spacing}
      {...(tone ? { tone } : {})}
      {...(labelledBy ? { "aria-labelledby": labelledBy } : { as: "div" as const })}
    >
      <Container size={size}>{children}</Container>
    </Section>
  );
}

/**
 * The page's first band: the homepage hero's language (pages redesign, 15 Oct 2026), a dark band
 * under the clear header with the hero photograph and rounded bottom corners. The eyebrow, the
 * single H1, an optional lead, then anything beneath them; optional media on the right. `full`
 * is the larger hero of a top-level page (About, Trust Centre, Careers, Insights, Labs).
 */
export function PageHeroBand({
  crumbs,
  title,
  eyebrow,
  lead,
  afterTitle,
  actions,
  media,
  full = false,
  children,
}: Readonly<{
  /** Retained for callers: every hero now uses the wide container, like the homepage. */
  size?: ContainerSize;
  /** Invisible BreadcrumbList JSON-LD element (Breadcrumbs); no visible trail. */
  crumbs?: ReactNode;
  title: string;
  eyebrow?: string | undefined;
  lead?: string | undefined;
  /** Rendered directly under the H1, before the lead (for example the maturity badge). */
  afterTitle?: ReactNode;
  /** Actions under the lead. */
  actions?: ReactNode;
  /** Media beside the copy from lg (a MediaSlot). */
  media?: ReactNode;
  /** The larger hero of a top-level page. */
  full?: boolean;
  children?: ReactNode;
}>) {
  return (
    <>
      {crumbs}
      <PageHero
        tone="dark"
        backdrop={heroPhotograph}
        size={full ? "display" : "title"}
        containerSize="wide"
        title={title}
        eyebrow={eyebrow}
        lead={lead}
        afterTitle={afterTitle}
        actions={actions}
        media={media}
      >
        {children ? <Stack gap={4}>{children}</Stack> : null}
      </PageHero>
    </>
  );
}

/** The page header: the single H1, an optional eyebrow and lead, and anything beneath them. */
export function PageHeader({
  title,
  eyebrow,
  lead,
  afterTitle,
  children,
}: Readonly<{
  title: string;
  eyebrow?: string | undefined;
  lead?: string | undefined;
  /** Rendered directly under the H1, before the lead (for example the maturity badge). */
  afterTitle?: ReactNode;
  children?: ReactNode;
}>) {
  return (
    <Stack gap={4}>
      {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
      <Heading level={1}>{title}</Heading>
      {afterTitle ? <div>{afterTitle}</div> : null}
      {lead ? <Lead>{lead}</Lead> : null}
      {children}
    </Stack>
  );
}

/** A titled content section. `id` is required so the heading can name the region. */
export function ContentSection({
  id,
  heading,
  level = 2,
  children,
}: Readonly<{
  id: string;
  heading: string;
  level?: HeadingLevel;
  children: ReactNode;
}>) {
  return (
    <section aria-labelledby={id} className="min-w-0">
      <Heading id={id} level={level} size={level <= 2 ? "h2" : "h3"}>
        {heading}
      </Heading>
      <div className="mt-(--space-5)">{children}</div>
    </section>
  );
}
