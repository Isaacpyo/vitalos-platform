import { routes } from "@vitalos/cms";
import type { SectionTone } from "@vitalos/ui";
import { careersCopy } from "../../features/content/careers/model";
import type { HomeData } from "../../features/content/schemas";
import { Band } from "../commercial/bands";
import { RoleList } from "./parts";

/** The first sentence of a paragraph (brief 6.5 shows only the intro's first sentence). */
export const firstSentence = (text: string): string => {
  const match = /^(.+?[.!?])(\s|$)/.exec(text.trim());
  return match?.[1] ?? text.trim();
};

/**
 * The homepage Careers section (brief 6.5), from the admin's `home` read, directly after the
 * Insights section, as a homepage band: the section heading with the intro's first sentence and
 * the onward link, then up to five role rows. With no roles open it shows the admin's message
 * (and the associates line when enabled), or is absent when the admin returns no section.
 */
export function HomeCareers({
  section,
  tone = "muted",
}: Readonly<{ section: NonNullable<HomeData["careers"]>; tone?: SectionTone }>) {
  const hasRoles = section.roles.length > 0;
  return (
    <Band
      tone={tone}
      eyebrow={careersCopy.eyebrow}
      heading={section.heading}
      intro={section.intro ? firstSentence(section.intro) : undefined}
      link={{
        label: hasRoles ? careersCopy.allOpenRoles : careersCopy.aboutCareers,
        href: routes.careers(),
      }}
    >
      {hasRoles ? (
        <RoleList roles={section.roles} headingLevel={3} />
      ) : (
        <div className="max-w-(--container-prose) border-t border-tone-border pt-(--space-5)">
          {section.message ? (
            <p className="m-0 text-body-l text-tone-text">{section.message}</p>
          ) : null}
          {section.associatesLine ? (
            <p className="mt-(--space-4) text-body text-tone-text">{section.associatesLine}</p>
          ) : null}
        </div>
      )}
    </Band>
  );
}
