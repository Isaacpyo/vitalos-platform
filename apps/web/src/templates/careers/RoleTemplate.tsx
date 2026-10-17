import { routes } from "@vitalos/cms";
import { Button, Container, Section } from "@vitalos/ui";
import { JsonLd } from "../../components/json-ld";
import { ShareMenu } from "../../components/share-menu";
import type { RolePageView } from "../../features/content/careers/load";
import {
  applyLink,
  careersCopy,
  privacyNoticeHref,
  roleFacts,
} from "../../features/content/careers/model";
import type { JsonLdNode } from "../../features/seo/json-ld";
import { PageMain } from "../institutional/page-main";
import { InsightsHero, monoLabel } from "../insights/parts";
import { ApplicationForm } from "./ApplicationForm";
import { FactsGrid, HtmlSection } from "./parts";
import { heroArtwork } from "../../lib/view-mapping/hero-artwork";

/** The apply action for the hero and the end of the page; an external site says so. */
function ApplyButton({
  apply,
  onDark = false,
}: Readonly<{ apply: NonNullable<ReturnType<typeof applyLink>>; onDark?: boolean }>) {
  const variant = onDark ? "secondary" : "primary";
  return apply.external ? (
    <Button href={apply.href} rel="noopener noreferrer" variant={variant} size="lg" arrow>
      {careersCopy.applyForRole}
      <span className="sr-only"> ({careersCopy.opensNewSite})</span>
    </Button>
  ) : (
    <Button href={apply.href} variant={variant} size="lg" arrow>
      {careersCopy.applyForRole}
    </Button>
  );
}

/**
 * A role (brief 6.2) in the site's design: the compact dark hero (practice, H1, dek, the apply
 * action and the facts), then the role's sections and the application form. As the redesign set
 * it, the page ends with its own apply action and the Share menu, not the client closing card.
 * Closed: the closed notice and a link to open roles, nothing else.
 */
export function RoleTemplate({
  view,
  url,
  jsonLd,
  turnstileSiteKey,
}: Readonly<{
  view: RolePageView;
  /** The role's canonical URL, for the Share menu. */
  url: string;
  jsonLd: readonly (JsonLdNode | Record<string, unknown> | null)[];
  turnstileSiteKey?: string | undefined;
}>) {
  if (view.kind === "closed") {
    const { role } = view;
    return (
      <PageMain>
        <InsightsHero
          tone="light"
          artwork={heroArtwork("careers", role.slug)}
          eyebrow={role.practice.label}
          title={role.title}
          intro={careersCopy.closedText(role.closedAt.long)}
        >
          <p className={`${monoLabel} m-0 text-tone-muted`}>
            {careersCopy.closedLabel(role.closedAt.short)}
          </p>
        </InsightsHero>
        <Section as="div" tone="light" spacing="default">
          <Container size="wide">
            <Button href={routes.careers()} arrow>
              {careersCopy.seeOpenRoles}
            </Button>
          </Container>
        </Section>
      </PageMain>
    );
  }

  const { role, sections } = view;
  const apply = applyLink(role);
  const privacy = privacyNoticeHref(role.privacy.noticeUrl);

  return (
    <PageMain>
      <JsonLd data={jsonLd as JsonLdNode[]} />
      <article aria-label={role.title}>
        <InsightsHero
          tone="light"
          artwork={heroArtwork("careers", role.slug)}
          eyebrow={role.practice.label}
          title={role.title}
          intro={role.summary}
          actions={apply ? <ApplyButton apply={apply} /> : undefined}
        >
          <FactsGrid facts={roleFacts(role)} />
          {apply?.external ? (
            <p className="m-0 text-small text-tone-muted" aria-hidden="true">
              This {careersCopy.opensNewSite}.
            </p>
          ) : null}
        </InsightsHero>

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
                className="mt-(--space-8) scroll-mt-(--size-header) rounded-2xl border border-tone-border bg-tone-bg p-(--space-6) md:p-(--space-7)"
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
            ) : apply ? (
              <div className="mt-(--space-8)">
                <ApplyButton apply={apply} />
              </div>
            ) : null}

            <div className="mt-(--space-7)">
              <ShareMenu url={url} title={role.title} menuLabel={careersCopy.shareMenu} />
            </div>
          </Container>
        </Section>
      </article>
    </PageMain>
  );
}
