import type { ReactNode } from "react";
import { routes } from "@vitalos/cms";
import { Button, Container, Section, SectionHeading } from "@vitalos/ui";
import type { SectionTone } from "@vitalos/ui";
import { MediaSlot, mediaSlotRenders } from "../../components/media-slot";
import type { CareersPageView } from "../../features/content/careers/load";
import { careersCopy, filterGroups, groupRoles } from "../../features/content/careers/model";
import type { CareersFilter } from "../../features/content/careers/model";
import { PageMain } from "../institutional/page-main";
import { renderBands } from "../commercial/bands";
import { InsightsHero, TalkBand, monoLabel } from "../insights/parts";
import { HtmlSection, RoleList } from "./parts";
import { heroArtwork } from "../../lib/view-mapping/hero-artwork";

/** A careers band: a named region with the site's section heading, on the given surface. */
function CareersBand({
  id,
  tone,
  heading,
  children,
}: Readonly<{ id: string; tone: SectionTone; heading: string; children: ReactNode }>) {
  return (
    <Section
      tone={tone}
      spacing="default"
      aria-labelledby={id}
      className="scroll-mt-(--size-header)"
    >
      <Container size="wide">
        <SectionHeading id={id} title={heading} />
        <div className="mt-(--space-7)">{children}</div>
      </Container>
    </Section>
  );
}

/**
 * `/careers` (brief 6.1) in the site's design: the full dark hero with the `careers.hero` image
 * slot, open roles by practice (with filters as links when more than six are open),
 * the empty state, the optional settings sections, then the closing card. Bands alternate their
 * surface like every other page.
 */
export function CareersTemplate({
  view,
  filter,
}: Readonly<{ view: CareersPageView; filter?: CareersFilter }>) {
  const { page, sections } = view;
  const { copy } = page;
  const groups = groupRoles(page, filter);
  const filters = filterGroups(page, filter);
  const open = page.total > 0;

  const openRoles = (tone: SectionTone) => (
    <CareersBand id="open-roles" tone={tone} heading={careersCopy.openRoles}>
      {filters.length > 0 ? (
        <nav aria-label={careersCopy.filterBy} className="flex flex-col gap-(--space-3)">
          {filters.map((group) => (
            <div
              key={group.dimension}
              className="flex flex-wrap items-baseline gap-x-(--space-4) gap-y-(--space-2)"
            >
              <span className={`${monoLabel} text-tone-muted`}>{group.label}</span>
              {group.options.map((option) => (
                <a
                  key={option.href}
                  href={option.href}
                  {...(option.current ? { "aria-current": "page" as const } : {})}
                  className={`text-body underline-offset-4 ${option.current ? "font-semibold text-tone-heading underline" : "text-tone-link underline"}`}
                >
                  {option.label}
                </a>
              ))}
            </div>
          ))}
          {filter ? (
            <a
              href={routes.careers()}
              className="text-body text-tone-link underline underline-offset-4"
            >
              {careersCopy.allRoles}
            </a>
          ) : null}
        </nav>
      ) : null}

      {open && groups.length > 0 ? (
        groups.map((group, index) => (
          <section
            key={group.practice.key}
            aria-labelledby={`practice-${group.practice.key}`}
            className={index === 0 && filters.length === 0 ? "" : "mt-(--space-7)"}
          >
            <h3
              id={`practice-${group.practice.key}`}
              className={`${monoLabel} m-0 mb-(--space-3) text-tone-muted`}
            >
              {group.practice.label} ({group.roles.length})
            </h3>
            <RoleList roles={group.roles} headingLevel={4} />
          </section>
        ))
      ) : (
        <div className={`max-w-(--container-prose) ${filters.length > 0 ? "mt-(--space-5)" : ""}`}>
          <p className="m-0 text-body-l text-tone-text">{copy.emptyState}</p>
          {copy.associatesLine ? (
            <>
              <p className="mt-(--space-4) text-body text-tone-text">{copy.associatesLine}</p>
              <p className="mt-(--space-3)">
                <a
                  href={routes.contact("careers")}
                  className="text-body text-tone-link underline underline-offset-4"
                >
                  {careersCopy.introduceYourself}
                </a>
              </p>
            </>
          ) : null}
        </div>
      )}
    </CareersBand>
  );

  const policies = (tone: SectionTone) =>
    sections.benefits ||
    sections.process ||
    sections.salaryPolicy ||
    sections.equalOpportunities ? (
      <Section as="div" tone={tone} spacing="default">
        <Container size="wide" className="[&>section:first-child]:mt-0">
          {sections.benefits ? (
            <HtmlSection id="benefits" heading={careersCopy.benefits} html={sections.benefits} />
          ) : null}
          {sections.process ? (
            <HtmlSection id="process" heading={careersCopy.howWeHire} html={sections.process} />
          ) : null}
          {sections.salaryPolicy ? (
            <HtmlSection
              id="salary-policy"
              heading={careersCopy.salaryPolicy}
              html={sections.salaryPolicy}
            />
          ) : null}
          {sections.equalOpportunities ? (
            <HtmlSection
              id="equal-opportunities"
              heading={careersCopy.equalOpportunities}
              html={sections.equalOpportunities}
            />
          ) : null}
        </Container>
      </Section>
    ) : null;

  return (
    <PageMain>
      <InsightsHero
        artwork={heroArtwork("careers")}
        full
        eyebrow={careersCopy.eyebrow}
        title={copy.heading}
        intro={copy.intro}
        media={
          mediaSlotRenders("careers.hero") ? <MediaSlot id="careers.hero" priority /> : undefined
        }
        actions={
          open ? (
            <Button href="#open-roles" variant="secondary" size="lg" arrow>
              {careersCopy.seeOpenRoles}
            </Button>
          ) : undefined
        }
      />
      {renderBands([openRoles, policies], "light")}
      <TalkBand />
    </PageMain>
  );
}
