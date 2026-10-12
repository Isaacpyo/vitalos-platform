import type { ReactNode } from "react";
import { Container, Eyebrow, Heading, Lead, PageHero, Section, Stack } from "@vitalos/ui";
import type { HeadingLevel, ContainerSize, SectionTone } from "@vitalos/ui";

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
 * The page's first band (the owner comp's page hero, ADR-023): eyebrow, the single
 * H1, an optional lead, then anything beneath them, on a light field with a decorative plane.
 */
export function PageHeroBand({
  crumbs,
  title,
  eyebrow,
  lead,
  afterTitle,
  size = "content",
  children,
}: Readonly<{
  /** Content width; match the PageBand that follows. */
  size?: ContainerSize;
  /** Invisible BreadcrumbList JSON-LD element (Breadcrumbs); no visible trail. */
  crumbs?: ReactNode;
  title: string;
  eyebrow?: string | undefined;
  lead?: string | undefined;
  /** Rendered directly under the H1, before the lead (for example the maturity badge). */
  afterTitle?: ReactNode;
  children?: ReactNode;
}>) {
  return (
    <>
      {crumbs}
      <PageHero
        size="title"
        containerSize={size}
        title={title}
        eyebrow={eyebrow}
        lead={lead}
        afterTitle={afterTitle}
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
