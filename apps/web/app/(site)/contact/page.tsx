import type { Metadata } from "next";
import { ctas, navLabels, routes } from "@vitalos/cms";
import { getEnv, getFeatures } from "@vitalos/config";
import { Container, PageHero, Section, Stack } from "@vitalos/ui";
import { RichText } from "../../../src/components/rich-text";
import { buildMetadata } from "../../../src/features/seo/metadata";
import { getContentSource } from "../../../src/lib/cms/get-content-source";
import { submitEnquiryAction } from "../../../src/features/enquiries/server-action";
import { ContactAlternative } from "../../../src/components/contact/ContactAlternative";
import { EnquiryForm } from "../../../src/components/contact/EnquiryForm";
import { IntentRoutes } from "../../../src/components/contact/IntentRoutes";
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
      {/* Heading and intro come from the CMS; locked copy is the only fallback. */}
      <PageHero size="title" title={page?.heading ?? ctas.primary} lead={page?.intro} />
      <Section tone="muted" spacing="default">
        <Container
          size="wide"
          className="grid gap-x-(--space-8) gap-y-(--space-7) lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)]"
        >
          {/* What happens next and the intent routes first (reading and focus order), then the form. */}
          <Stack gap={6} className="min-w-0">
            <RichText value={page?.expectations} />
            {form.available ? <IntentRoutes routes={page?.routes ?? []} /> : null}
          </Stack>
          {/* The form card starts at md: below it the Turnstile widget (300px fixed) needs the
              full width to fit a 320px viewport (WCAG 1.4.10). */}
          <div
            data-tone="light"
            className="min-w-0 text-tone-text md:rounded-lg md:border md:border-tone-border md:bg-tone-bg md:p-(--space-7)"
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
