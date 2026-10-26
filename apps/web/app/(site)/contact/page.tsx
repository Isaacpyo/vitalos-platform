import type { Metadata } from "next";
import { ctas, navLabels, routes } from "@vitalos/cms";
import { getEnv, getFeatures } from "@vitalos/config";
import { Container, IconTile, PageHero, Section } from "@vitalos/ui";
import { RichText } from "../../../src/components/rich-text";
import { heroPhotograph } from "../../../src/lib/view-mapping/hero-images";
import { buildMetadata } from "../../../src/features/seo/metadata";
import { getContentSource } from "../../../src/lib/cms/get-content-source";
import { submitEnquiryAction } from "../../../src/features/enquiries/server-action";
import { ContactAlternative } from "../../../src/components/contact/ContactAlternative";
import { EnquiryForm } from "../../../src/components/contact/EnquiryForm";
import { parseContactSearchParams } from "../../../src/components/contact/contact-params";
import type { ContactSearchParams } from "../../../src/components/contact/contact-params";
import { resolveContactPage } from "../../../src/components/contact/contact-view";
import { buildIntentOptions } from "../../../src/components/contact/labels";
import { loadChromeContent } from "../../../src/components/site-chrome/load";
import { healthcareIntents, isHealthcareIntent } from "@vitalos/validation/enquiry";
import { Breadcrumbs, homeCrumb } from "../../../src/templates/institutional/breadcrumbs";

export async function generateMetadata(): Promise<Metadata> {
  const source = await getContentSource();
  const [page, chrome] = await Promise.all([
    source.getRoutePage("contact"),
    source.getSiteChrome(),
  ]);
  // No description is set from code: copy comes from the CMS.
  return buildMetadata({
    path: routes.contact(),
    title: page?.heading ?? navLabels.contact,
    seo: page?.seo,
    defaultSeo: chrome.settings.defaultSeo,
  });
}

/** Bare path recorded as the enquiry's source: no query string, so no tracking values or ids. */
const SOURCE_PATH = routes.contact();

export default async function ContactPage({
  searchParams,
}: Readonly<{ searchParams: Promise<ContactSearchParams> }>) {
  const env = getEnv();
  const features = getFeatures();
  const [{ page, settings, form }, query] = await Promise.all([
    resolveContactPage({
      source: await getContentSource(),
      enquiryPersistence: features.enquiryPersistence,
      configuredPrivacyNoticeVersion: env.enquiry.privacyNoticeVersion,
    }),
    searchParams,
  ]);
  const prefill = parseContactSearchParams(query);
  // The Health & Care topics appear once the Health & Care lead page is served (in production:
  // published), or when the visitor arrives with one (Website Build Pack, 25 Oct 2026).
  const healthcareTopicsShown =
    isHealthcareIntent(prefill.intent) ||
    (await loadChromeContent()).leadPages?.some((industry) => industry.slug === "health-care") ===
      true;
  const turnstileSiteKey = features.turnstile ? env.turnstile.siteKey : undefined;

  return (
    <main id="main" tabIndex={-1}>
      <Breadcrumbs
        trail={[homeCrumb, { name: navLabels.contact, path: routes.contact() }]}
        page={{
          type: "ContactPage",
          name: page?.heading ?? ctas.primary,
          description: page?.intro,
        }}
      />
      {/* The compact dark hero of every page (pages redesign, 15 Oct 2026). Heading and intro come
          from the CMS; locked copy is the only fallback. */}
      <PageHero
        tone="dark"
        size="title"
        backdrop={heroPhotograph}
        eyebrow={navLabels.contact}
        title={page?.heading ?? ctas.primary}
        lead={page?.intro}
      />
      <Section tone="light" spacing="default">
        <Container
          size="wide"
          className="grid gap-x-(--space-8) gap-y-(--space-7) lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]"
        >
          {/* The form card starts at md: below it the Turnstile widget (300px fixed) needs the
              full width to fit a 320px viewport (WCAG 1.4.10). The topic is a select in the form.
              Raised like the homepage cards, and pulled up into the hero from lg. First in the reading
              order on every screen; the right-hand column from lg. */}
          <div
            data-tone="muted"
            className="relative z-10 min-w-0 text-tone-text md:rounded-2xl md:border md:border-tone-border md:bg-tone-bg md:p-(--space-7) md:shadow-floating lg:col-start-2 lg:row-start-1 lg:-mt-(--space-10)"
          >
            {form.available ? (
              <EnquiryForm
                action={submitEnquiryAction}
                sourcePath={SOURCE_PATH}
                privacyNoticeVersion={form.privacyNoticeVersion}
                idempotencyKey={crypto.randomUUID()}
                intentOptions={buildIntentOptions(
                  page?.routes,
                  healthcareTopicsShown ? [] : healthcareIntents,
                )}
                prefill={prefill}
                turnstileSiteKey={turnstileSiteKey}
                contactEmail={settings.contactEmail}
                successMessage={page?.successMessage}
              />
            ) : (
              <ContactAlternative contactEmail={settings.contactEmail} />
            )}
          </div>
          {/* The ways to reach us: after the form on small screens (owner direction, 16 and 17 Oct
              2026), in the left column from lg. */}
          <div className="min-w-0 lg:col-start-1 lg:row-start-1 lg:pt-(--space-5)">
            <ul className="m-0 flex list-none flex-col gap-(--space-6) p-0">
              {settings.contactEmail ? (
                <li className="flex items-center gap-(--space-4)">
                  <IconTile name="mail" />
                  <div className="min-w-0">
                    <p className="m-0 text-small text-tone-muted">Email</p>
                    <a
                      href={`mailto:${settings.contactEmail}`}
                      className="text-body-l font-semibold text-tone-heading underline-offset-4 hover:underline"
                    >
                      {settings.contactEmail}
                    </a>
                  </div>
                </li>
              ) : null}
              {page?.expectations && page.expectations.length > 0 ? (
                <li className="flex gap-(--space-4)">
                  <IconTile name="check" />
                  <div className="min-w-0">
                    <p className="m-0 text-small text-tone-muted">What happens next</p>
                    <RichText value={page.expectations} className="mt-(--space-1) text-small" />
                  </div>
                </li>
              ) : null}
            </ul>
          </div>
        </Container>
      </Section>
    </main>
  );
}
