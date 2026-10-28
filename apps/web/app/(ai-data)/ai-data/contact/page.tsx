import type { Metadata } from "next";
import { routes } from "@vitalos/cms";
import { getEnv, getFeatures } from "@vitalos/config";
import { aiDataOffers } from "@vitalos/validation/ai-data-enquiry";
import { IconTile } from "@vitalos/ui";
import { AiDataEnquiryForm } from "../../../../src/components/ai-data/AiDataEnquiryForm";
import { AiDataPage } from "../../../../src/components/ai-data/chrome";
import { Band, SectionHeading } from "../../../../src/components/ai-data/primitives";
import { GuidedBrief } from "../../../../src/components/ai-data/brief/GuidedBrief";
import { JsOnly, NoJsOnly } from "../../../../src/components/ai-data/brief/JsOnly";
import { isBriefAssistConfigured } from "../../../../src/features/ai-data/brief/server";
import { isTopicSlug } from "../../../../src/features/ai-data/brief/types";
import { ContactAlternative } from "../../../../src/components/contact/ContactAlternative";
import { parseContactSearchParams } from "../../../../src/components/contact/contact-params";
import type { ContactSearchParams } from "../../../../src/components/contact/contact-params";
import { resolveContactPage } from "../../../../src/components/contact/contact-view";
import { JsonLd } from "../../../../src/components/json-ld";
import { RichText } from "../../../../src/components/rich-text";
import { submitAiDataEnquiryAction } from "../../../../src/features/ai-data/enquiry/server-action";
import { aiDataGraph, aiDataMetadata } from "../../../../src/features/ai-data/seo";
import { getContentSource } from "../../../../src/lib/cms/get-content-source";

export const metadata: Metadata = aiDataMetadata("contact");

const title = "Discuss your business challenge";
const lead =
  "Tell us about the workflow you want to improve. We will ask a few questions and help you shape a short brief you can edit before you share it. Prefer a plain form? That is one click away.";

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/**
 * The AI & Data enquiry form (AID-004). The form is offered under the same conditions as the main
 * contact form (`resolveContactPage`: enquiries can be stored and a privacy notice is published);
 * otherwise the same email alternative is shown. "What happens next" is the main contact page's
 * own copy, so both forms promise the same thing.
 */
export default async function AiDataContactPage({
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
  const { utm } = parseContactSearchParams(query);
  const rawOffer = first(query.offer)?.trim();
  const offer =
    rawOffer && (aiDataOffers as readonly string[]).includes(rawOffer) ? rawOffer : undefined;
  const turnstileSiteKey = features.turnstile ? env.turnstile.siteKey : undefined;
  const rawTopic = first(query.topic)?.trim();
  const topic = isTopicSlug(rawTopic) ? rawTopic : null;
  const simple = first(query.mode) === "simple";
  const carried = new URLSearchParams();
  if (topic) carried.set("topic", topic);
  if (offer) carried.set("offer", offer);
  for (const [key, value] of Object.entries(utm ?? {})) carried.set(`utm_${key}`, String(value));
  const withMode = (mode: string | null) => {
    const params = new URLSearchParams(carried);
    if (mode) params.set("mode", mode);
    const text = params.toString();
    return `${routes.aiData.contact()}${text ? `?${text}` : ""}`;
  };
  const guidedHref = withMode(null);
  const simpleHref = withMode("simple");
  const simpleForm = form.available ? (
    <AiDataEnquiryForm
      action={submitAiDataEnquiryAction}
      privacyNoticeVersion={form.privacyNoticeVersion}
      idempotencyKey={crypto.randomUUID()}
      prefill={{ offer, utm }}
      turnstileSiteKey={turnstileSiteKey}
      contactEmail={settings.contactEmail}
    />
  ) : null;

  return (
    <AiDataPage current="contact">
      <JsonLd data={aiDataGraph("contact", title, lead)} />
      <Band tone="dark" grid spacing="compact" labelledBy="aid-contact-title">
        <SectionHeading
          id="aid-contact-title"
          level={1}
          eyebrow="Contact"
          title={title}
          lead={lead}
        />
      </Band>
      <Band tone="muted" spacing="compact">
        <div className="grid gap-x-(--space-8) gap-y-(--space-7) lg:grid-cols-[minmax(0,7fr)_minmax(0,4fr)]">
          <div
            data-aid-tone="light"
            className="min-w-0 rounded-lg border border-aid-border p-(--space-4) sm:p-(--space-7)"
          >
            {form.available ? (
              <div className="flex flex-col gap-(--space-6)">
                <nav aria-label="Ways to get in touch">
                  <ul className="m-0 flex list-none flex-wrap gap-(--space-2) p-0">
                    {[
                      { label: "Guided brief", href: guidedHref, current: !simple },
                      { label: "Simple form", href: simpleHref, current: simple },
                    ].map((item) => (
                      <li key={item.label}>
                        <a
                          href={item.href}
                          aria-current={item.current ? "page" : undefined}
                          className="inline-flex min-h-11 items-center rounded-full border border-aid-control-border px-(--space-5) font-semibold text-aid-heading no-underline transition-colors duration-(--duration-feedback) hover:bg-aid-chip-bg aria-[current=page]:border-aid-action aria-[current=page]:bg-aid-action aria-[current=page]:text-aid-action-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-aid-focus"
                        >
                          {item.label}
                        </a>
                      </li>
                    ))}
                  </ul>
                </nav>
                {simple ? (
                  simpleForm
                ) : (
                  <>
                    <JsOnly>
                      <GuidedBrief
                        aiAvailable={isBriefAssistConfigured()}
                        initialTopic={topic}
                        idempotencyKey={crypto.randomUUID()}
                        action={submitAiDataEnquiryAction}
                        privacyNoticeVersion={form.privacyNoticeVersion}
                        offer={offer}
                        utm={utm}
                        turnstileSiteKey={turnstileSiteKey}
                        contactEmail={settings.contactEmail}
                        simpleFormHref={simpleHref}
                      />
                    </JsOnly>
                    <NoJsOnly>{simpleForm}</NoJsOnly>
                  </>
                )}
              </div>
            ) : (
              <ContactAlternative contactEmail={settings.contactEmail} />
            )}
          </div>
          <aside aria-labelledby="aid-next" className="flex min-w-0 flex-col gap-(--space-6)">
            <h2 id="aid-next" className="m-0 text-h3 text-aid-heading">
              What happens next
            </h2>
            {page?.expectations && page.expectations.length > 0 ? (
              <RichText value={page.expectations} className="text-aid-text" />
            ) : null}
            <ul className="m-0 flex list-none flex-col gap-(--space-5) border-t border-aid-border p-0 pt-(--space-5)">
              <li className="flex gap-(--space-4)">
                <IconTile name="document" />
                <p className="m-0 text-small text-aid-text">
                  Your enquiry is recorded first, so nothing is lost if a notification is delayed.
                  You will see a reference number when it has been received.
                </p>
              </li>
              {settings.contactEmail ? (
                <li className="flex gap-(--space-4)">
                  <IconTile name="mail" />
                  <div className="min-w-0">
                    <p className="m-0 text-small text-aid-muted">Prefer email?</p>
                    <a
                      href={`mailto:${settings.contactEmail}`}
                      className="font-semibold text-aid-link underline underline-offset-4 hover:text-aid-link-hover"
                    >
                      {settings.contactEmail}
                    </a>
                  </div>
                </li>
              ) : null}
            </ul>
          </aside>
        </div>
      </Band>
    </AiDataPage>
  );
}
