import { routes } from "@vitalos/cms";
import { Button, Container, Section } from "@vitalos/ui";
import type { CareersPageView } from "../../features/content/careers/load";
import { careersCopy, filterGroups, groupRoles } from "../../features/content/careers/model";
import type { CareersFilter } from "../../features/content/careers/model";
import { PageMain } from "../institutional/page-main";
import { InsightsHero, TalkBand, monoLabel } from "../insights/parts";
import { HtmlSection, RoleList } from "./parts";

const pad = (index: number) => String(index + 1).padStart(2, "0");

/**
 * `/careers` (brief 6.1): hero, how we work, open roles by practice (with filters as links when
 * more than six are open), the empty state, the optional settings sections and the closing band.
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

  return (
    <PageMain>
      <InsightsHero eyebrow={careersCopy.eyebrow} title={copy.heading} intro={copy.intro}>
        {open ? (
          <div className="mt-(--space-6)">
            <Button href="#open-roles">{careersCopy.seeOpenRoles}</Button>
          </div>
        ) : null}
      </InsightsHero>

      {copy.values.length > 0 || copy.statements.length > 0 ? (
        <Section tone="light" spacing="default" aria-labelledby="how-we-work">
          <Container size="wide">
            <h2 id="how-we-work" className="m-0 text-h2 text-tone-heading">
              {careersCopy.howWeWork}
            </h2>
            {copy.values.length > 0 ? (
              <ol className="m-0 mt-(--space-6) grid list-none grid-cols-1 gap-x-(--space-6) gap-y-(--space-3) p-0 sm:grid-cols-2 lg:grid-cols-5">
                {copy.values.map((value, index) => (
                  <li
                    key={value}
                    className="flex items-baseline gap-(--space-3) border-t border-tone-border pt-(--space-3)"
                  >
                    <span className={`${monoLabel} text-tone-eyebrow`} aria-hidden="true">
                      {pad(index)}
                    </span>
                    <span className="text-body text-tone-heading">{value}</span>
                  </li>
                ))}
              </ol>
            ) : null}
            {copy.statements.map((statement) => (
              <p
                key={statement}
                className="mt-(--space-5) max-w-(--container-prose) text-body-l text-tone-text"
              >
                {statement}
              </p>
            ))}
          </Container>
        </Section>
      ) : null}

      <Section
        tone="light"
        spacing="default"
        aria-labelledby="open-roles"
        className="border-t border-tone-border"
      >
        <Container size="wide">
          <h2 id="open-roles" className="m-0 text-h2 text-tone-heading">
            {careersCopy.openRoles}
          </h2>
          {filters.length > 0 ? (
            <nav
              aria-label={careersCopy.filterBy}
              className="mt-(--space-5) flex flex-col gap-(--space-3)"
            >
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
            groups.map((group) => (
              <section
                key={group.practice.key}
                aria-labelledby={`practice-${group.practice.key}`}
                className="mt-(--space-7)"
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
            <div className="mt-(--space-5) max-w-(--container-prose)">
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
        </Container>
      </Section>

      {sections.benefits ||
      sections.process ||
      sections.salaryPolicy ||
      sections.equalOpportunities ? (
        <Section as="div" tone="light" spacing="default" className="border-t border-tone-border">
          <Container size="wide">
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
      ) : null}

      <TalkBand />
    </PageMain>
  );
}
