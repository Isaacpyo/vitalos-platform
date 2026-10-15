import { useId } from "react";
import { navLabels, routes } from "@vitalos/cms";
import {
  AuroraBackdrop,
  Button,
  CTAGroup,
  Container,
  IndustryShowcase,
  Lead,
  MotionPause,
  ProcessCycle,
  Reveal,
  Section,
  SectionHeading,
} from "@vitalos/ui";
import type { IndustryShowcaseItem, PatternLink, ProcessCycleStage } from "@vitalos/ui";
import { heroMotionPauseLabel } from "../../lib/view-mapping/labels";
import { itemLevel } from "./bands";

/**
 * The homepage's two dark bands, shared by every page that carries them (pages redesign, 15 Oct
 * 2026). They set their own dark tone; in `renderBands` they still count in the alternation.
 */

/**
 * From strategy to production: an introduction beside the delivery lifecycle as a ring of the
 * nine locked stages (ProcessCycle) on the dark band. Pointing at, focusing or clicking a stage
 * presents its summary. `action` defaults to the How We Work page; `null` leaves it out (on How
 * We Work itself).
 */
export function LifecycleBand({
  title,
  intro,
  stages,
  eyebrow = navLabels.howWeWork,
  action,
}: Readonly<{
  title: string;
  intro?: string | undefined;
  stages: readonly ProcessCycleStage[];
  eyebrow?: string | undefined;
  action?: PatternLink | null | undefined;
}>) {
  const headingId = useId();
  const link =
    action === null
      ? undefined
      : (action ?? { label: navLabels.howWeWork, href: routes.howWeWork() });
  return (
    <Section tone="dark" aria-labelledby={headingId} className="relative isolate overflow-hidden">
      <span
        aria-hidden="true"
        className="absolute top-1/2 right-[-10%] -z-10 size-[46rem] -translate-y-1/2 rounded-full bg-blue-600/20 blur-3xl"
      />
      <Container
        size="wide"
        className="grid gap-x-(--space-8) gap-y-(--space-8) xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] xl:items-center"
      >
        <Reveal>
          <SectionHeading id={headingId} eyebrow={eyebrow} title={title} />
          {intro ? <Lead className="mt-(--space-5)">{intro}</Lead> : null}
          {link ? (
            <CTAGroup className="mt-(--space-6)">
              <Button href={link.href} arrow>
                {link.label}
              </Button>
            </CTAGroup>
          ) : null}
        </Reveal>
        <ProcessCycle stages={stages} label={navLabels.howWeWork} className="pb-(--space-6)" />
      </Container>
    </Section>
  );
}

/**
 * Industries: the expanding glass panels (IndustryShowcase) over the drifting aurora, with its own
 * pause switch (ADR-024's 15 Oct amendment). Without a title the band is an unnamed container.
 */
export function IndustryBand({
  title,
  items,
  eyebrow = navLabels.industries,
  link,
}: Readonly<{
  title: string | undefined;
  items: readonly IndustryShowcaseItem[];
  eyebrow?: string | undefined;
  link?: PatternLink | null | undefined;
}>) {
  const headingId = useId();
  const onward =
    link === null
      ? undefined
      : (link ?? { label: navLabels.industries, href: routes.industries() });
  if (items.length === 0) return null;
  return (
    <Section
      tone="dark"
      data-motion-scope=""
      {...(title ? { "aria-labelledby": headingId } : { as: "div" as const })}
      className="relative isolate overflow-hidden"
    >
      <AuroraBackdrop />
      <MotionPause
        label={heroMotionPauseLabel}
        className="absolute right-(--space-4) bottom-(--space-4) z-10"
      />
      <Container size="wide">
        {title ? (
          <Reveal>
            <SectionHeading id={headingId} title={title} eyebrow={eyebrow} link={onward} />
          </Reveal>
        ) : null}
        <IndustryShowcase
          className={title ? "mt-(--space-7)" : undefined}
          headingLevel={itemLevel(title)}
          items={items}
        />
      </Container>
    </Section>
  );
}
