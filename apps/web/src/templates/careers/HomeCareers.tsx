import { routes } from "@vitalos/cms";
import { useId } from "react";
import { Button, Container, Eyebrow, Heading, Section } from "@vitalos/ui";
import type { SectionTone } from "@vitalos/ui";
import { careersCopy } from "../../features/content/careers/model";
import type { HomeData } from "../../features/content/schemas";

/** The first sentence of a paragraph (brief 6.5 shows only the intro's first sentence). */
export const firstSentence = (text: string): string => {
  const match = /^(.+?[.!?])(\s|$)/.exec(text.trim());
  return match?.[1] ?? text.trim();
};

/**
 * The homepage Careers section (brief 6.5, owner decision 17 Oct 2026: a banner, not a list of
 * roles), from the admin's `home` read, directly after the Insights section: one card with the
 * eyebrow, the section heading, the intro's first sentence (or, with no roles open, the admin's
 * message) and a single button to the careers page. Absent when the admin returns no section.
 */
export function HomeCareers({
  section,
  tone = "muted",
}: Readonly<{ section: NonNullable<HomeData["careers"]>; tone?: SectionTone }>) {
  const headingId = useId();
  const hasRoles = section.roles.length > 0;
  const text = hasRoles
    ? section.intro && firstSentence(section.intro)
    : section.message || (section.intro && firstSentence(section.intro));
  return (
    <Section tone={tone} spacing="default" aria-labelledby={headingId}>
      <Container size="wide">
        <div className="flex flex-col gap-(--space-6) rounded-2xl border border-tone-border bg-tone-bg p-(--space-6) md:flex-row md:items-center md:justify-between md:p-(--space-8)">
          <div className="min-w-0 max-w-(--container-content)">
            <Eyebrow className="mb-(--space-3)">{careersCopy.eyebrow}</Eyebrow>
            <Heading id={headingId} level={2} size="h2">
              {section.heading}
            </Heading>
            {text ? (
              <p className="m-0 mt-(--space-3) text-body-l text-tone-text text-pretty">{text}</p>
            ) : null}
          </div>
          <Button href={routes.careers()} size="lg" arrow className="shrink-0">
            {hasRoles ? careersCopy.seeOpenRoles : careersCopy.aboutCareers}
          </Button>
        </div>
      </Container>
    </Section>
  );
}
