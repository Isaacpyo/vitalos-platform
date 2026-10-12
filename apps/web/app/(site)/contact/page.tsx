import type { Metadata } from "next";
import { ctas, navLabels, routes } from "@vitalos/cms";
import { getEnv, getFeatures } from "@vitalos/config";
import { Container, Display, Icon, IconTile, Lead, Section } from "@vitalos/ui";
import { RichText } from "../../../src/components/rich-text";
import { buildMetadata } from "../../../src/features/seo/metadata";
import { getContentSource } from "../../../src/lib/cms/get-content-source";
import { submitEnquiryAction } from "../../../src/features/enquiries/server-action";
import { ContactAlternative } from "../../../src/components/contact/ContactAlternative";
import { EnquiryForm } from "../../../src/components/contact/EnquiryForm";
import { parseContactSearchParams } from "../../../src/components/contact/contact-params";
import type { ContactSearchParams } from "../../../src/components/contact/contact-params";
import { resolveContactPage } from "../../../src/components/contact/contact-view";
import { buildIntentOptions } from "../../../src/components/contact/labels";

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
  const turnstileSiteKey = features.turnstile ? env.turnstile.siteKey : undefined;

  return (
    <main id="main" tabIndex={-1}>
      <Section tone="light" spacing="default">
        <Container
          size="wide"
          className="grid gap-x-(--space-8) gap-y-(--space-7) lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]"
        >
          {/* Heading, intro and the ways to reach us first (reading and focus order), then the
              form. Heading and intro come from the CMS; locked copy is the only fallback. */}
          <div className="min-w-0 lg:pt-(--space-5)">
            <span className="inline-flex items-center gap-(--space-2) rounded-md border border-tone-border px-(--space-3) py-(--space-1) text-small font-medium text-tone-heading">
              <Icon name="mail" size={16} />
              {navLabels.contact}
            </span>
            <Display className="mt-(--space-5)">{page?.heading ?? ctas.primary}</Display>
            {page?.intro ? (
              <Lead className="mt-(--space-5) text-tone-muted">{page.intro}</Lead>
            ) : null}
            <ul className="m-0 mt-(--space-7) flex list-none flex-col gap-(--space-6) p-0">
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
          {/* The form card starts at md: below it the Turnstile widget (300px fixed) needs the
              full width to fit a 320px viewport (WCAG 1.4.10). The topic is a select in the form. */}
          <div
            data-tone="muted"
            className="min-w-0 text-tone-text md:rounded-xl md:border md:border-tone-border md:bg-tone-bg md:p-(--space-7)"
          >
            {form.available ? (
              <EnquiryForm
                action={submitEnquiryAction}
                sourcePath={SOURCE_PATH}
                privacyNoticeVersion={form.privacyNoticeVersion}
                idempotencyKey={crypto.randomUUID()}
                intentOptions={buildIntentOptions(page?.routes)}
                prefill={prefill}
                turnstileSiteKey={turnstileSiteKey}
                contactEmail={settings.contactEmail}
                successMessage={page?.successMessage}
              />
            ) : (
              <ContactAlternative contactEmail={settings.contactEmail} />
            )}
          </div>
        </Container>
      </Section>
    </main>
  );
}
