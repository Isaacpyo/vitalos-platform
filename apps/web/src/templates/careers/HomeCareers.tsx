import { useId } from "react";
import { routes } from "@vitalos/cms";
import { Button, Container, Section } from "@vitalos/ui";
import { careersCopy } from "../../features/content/careers/model";
import type { HomeData } from "../../features/content/schemas";
import { WithFullStop, monoLabel } from "../insights/parts";
import { RoleList } from "./parts";

/** The first sentence of a paragraph (brief 6.5 shows only the intro's first sentence). */
export const firstSentence = (text: string): string => {
  const match = /^(.+?[.!?])(\s|$)/.exec(text.trim());
  return match?.[1] ?? text.trim();
};

/**
 * The homepage Careers section (brief 6.5), from the admin's `home` read, directly after the
 * Insights section: a muted band with a hairline above; the heading column (5 of 12) and up to
 * five role rows (7 of 12). With no roles open it shows the admin's message (and the associates
 * line when enabled), or is absent when the admin returns no section.
 */
export function HomeCareers({ section }: Readonly<{ section: NonNullable<HomeData["careers"]> }>) {
  const headingId = useId();
  const hasRoles = section.roles.length > 0;
  return (
    <Section
      tone="muted"
      spacing="default"
      aria-labelledby={headingId}
      className="border-t border-tone-border"
    >
      <Container size="wide" className="grid gap-x-(--space-8) gap-y-(--space-6) lg:grid-cols-12">
        <div className="lg:col-span-5">
          <p className={`${monoLabel} m-0 text-tone-eyebrow`}>{careersCopy.eyebrow}</p>
          <h2 id={headingId} className="mt-(--space-3) text-h2 text-tone-heading text-balance">
            <WithFullStop text={section.heading} />
          </h2>
          {section.intro ? (
            <p className="mt-(--space-4) text-body-l text-tone-muted">
              {firstSentence(section.intro)}
            </p>
          ) : null}
          <p className="mt-(--space-5)">
            <Button href={routes.careers()} variant="text" arrow>
              {hasRoles ? careersCopy.allOpenRoles : careersCopy.aboutCareers}
            </Button>
          </p>
        </div>
        <div className="lg:col-span-7">
          {hasRoles ? (
            <RoleList roles={section.roles} headingLevel={3} />
          ) : (
            <div className="border-t border-tone-border pt-(--space-5)">
              {section.message ? (
                <p className="m-0 text-body-l text-tone-text">{section.message}</p>
              ) : null}
              {section.associatesLine ? (
                <p className="mt-(--space-4) text-body text-tone-text">{section.associatesLine}</p>
              ) : null}
            </div>
          )}
        </div>
      </Container>
    </Section>
  );
}
