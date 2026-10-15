import { routes } from "@vitalos/cms";
import { Button, Container, Section } from "@vitalos/ui";
import { JsonLd } from "../../components/json-ld";
import type { RolePageView } from "../../features/content/careers/load";
import {
  applyLink,
  careersCopy,
  privacyNoticeHref,
  roleFacts,
} from "../../features/content/careers/model";
import { CAREERS_BASE } from "../../features/content/routes";
import type { JsonLdNode } from "../../features/seo/json-ld";
import { PageMain } from "../institutional/page-main";
import { TalkBand, monoLabel } from "../insights/parts";
import { ApplicationForm } from "./ApplicationForm";
import { FactsGrid, HtmlSection } from "./parts";

function Breadcrumb({ practice }: Readonly<{ practice: string }>) {
  return (
    <nav aria-label="Breadcrumb" className={`${monoLabel} text-tone-muted`}>
      <a href={CAREERS_BASE} className="text-tone-link underline underline-offset-4">
        {careersCopy.eyebrow}
      </a>
      <span aria-hidden="true"> / </span>
      <span>{practice.toUpperCase()}</span>
    </nav>
  );
}

/**
 * A role (brief 6.2). Open: breadcrumb, H1, dek, facts, the apply action, the role's sections and
 * the application form. Closed: the closed notice and a link to open roles, nothing else.
 */
export function RoleTemplate({
  view,
  jsonLd,
  turnstileSiteKey,
}: Readonly<{
  view: RolePageView;
  jsonLd: readonly (JsonLdNode | Record<string, unknown> | null)[];
  turnstileSiteKey?: string | undefined;
}>) {
  if (view.kind === "closed") {
    const { role } = view;
    return (
      <PageMain>
        <Section as="div" tone="light" spacing="default">
          <Container size="wide">
            <Breadcrumb practice={role.practice.label} />
            <h1 className="mt-(--space-4) max-w-[22ch] text-h1 text-tone-heading text-balance">
              {role.title}
            </h1>
            <p className={`${monoLabel} mt-(--space-4) text-tone-muted`}>
              {careersCopy.closedLabel(role.closedAt.short)}
            </p>
            <p className="mt-(--space-4) text-body-l text-tone-text">
              {careersCopy.closedText(role.closedAt.long)}
            </p>
            <p className="mt-(--space-5)">
              <a
                href={routes.careers()}
                className="text-body text-tone-link underline underline-offset-4"
              >
                {careersCopy.seeOpenRoles}
              </a>
            </p>
          </Container>
        </Section>
        <TalkBand />
      </PageMain>
    );
  }

  const { role, sections } = view;
  const apply = applyLink(role);
  const privacy = privacyNoticeHref(role.privacy.noticeUrl);

  return (
    <PageMain>
      <JsonLd data={jsonLd as JsonLdNode[]} />
      <article aria-labelledby="role-title">
        <Section as="div" tone="light" spacing="default" className="border-b border-tone-border">
          <Container size="wide">
            <Breadcrumb practice={role.practice.label} />
            <h1
              id="role-title"
              className="mt-(--space-4) max-w-[22ch] text-h1 text-tone-heading text-balance"
            >
              {role.title}
            </h1>
            <p className="mt-(--space-5) max-w-(--container-prose) text-body-l text-tone-muted">
              {role.summary}
            </p>
            <div className="mt-(--space-6)">
              <FactsGrid facts={roleFacts(role)} />
            </div>
            {apply ? (
              <div className="mt-(--space-6)">
                {apply.external ? (
                  <Button href={apply.href} rel="noopener noreferrer">
                    {careersCopy.applyForRole}
                    <span className="sr-only"> ({careersCopy.opensNewSite})</span>
                  </Button>
                ) : (
                  <Button href={apply.href}>{careersCopy.applyForRole}</Button>
                )}
                {apply.external ? (
                  <p className="mt-(--space-2) text-small text-tone-muted" aria-hidden="true">
                    This {careersCopy.opensNewSite}.
                  </p>
                ) : null}
              </div>
            ) : null}
          </Container>
        </Section>

        <Section as="div" tone="light" spacing="default">
          {/* The band's own padding is the gap above the first section (no extra margin). */}
          <Container size="wide" className="[&>section:first-child]:mt-0">
            {sections.map((section) => (
              <HtmlSection
                key={section.key}
                id={`role-${section.key}`}
                heading={section.heading}
                html={section.html}
              />
            ))}

            {role.apply.mode === "form" ? (
              <section
                id="apply"
                aria-labelledby="apply-heading"
                className="mt-(--space-8) scroll-mt-(--space-8) border-t border-tone-border pt-(--space-7)"
              >
                <h2 id="apply-heading" className="m-0 mb-(--space-5) text-h2 text-tone-heading">
                  {careersCopy.applyForRole}
                </h2>
                {privacy ? (
                  <ApplicationForm
                    roleSlug={role.slug}
                    roleTitle={role.title}
                    privacyNoticeUrl={privacy}
                    turnstileSiteKey={turnstileSiteKey}
                  />
                ) : (
                  <p className="m-0 text-body-l text-tone-text">{careersCopy.notOpenYet}</p>
                )}
              </section>
            ) : null}
          </Container>
        </Section>
      </article>
      <TalkBand />
    </PageMain>
  );
}
