import type { Metadata } from "next";
import { routes } from "@vitalos/cms";
import { getEnv, getFeatures } from "@vitalos/config";
import { readBuildEnv } from "@vitalos/config/build";
import {
  Button,
  Container,
  Field,
  IconTile,
  PageHero,
  Section,
  StatusMessage,
  TextInput,
} from "@vitalos/ui";
import { TurnstileWidget } from "../../../src/components/contact/TurnstileWidget";
import { payCheckoutOrigin } from "../../../src/config/security-headers";
import {
  parsePayParams,
  payCheckoutUrl,
  payErrorMessages,
} from "../../../src/features/pay/pay-params";
import { getContentSource } from "../../../src/lib/cms/get-content-source";
import { heroPhotograph } from "../../../src/lib/view-mapping/hero-images";

const title = "Pay an invoice";

/** A payment utility page: never indexed, not in the sitemap. */
export const metadata: Metadata = {
  title,
  description: "Pay a Vitalos invoice securely by card through Stripe.",
  robots: { index: false, follow: false },
};

/**
 * `/pay` (AID-018). The payer enters the invoice number and payment code printed on their invoice;
 * the form posts straight to the Super Admin, which checks them and opens Stripe Checkout for the
 * balance due. Errors come back as `?error=` codes. A plain HTML form: it works without JavaScript
 * except for the security check, and card details are only ever entered on Stripe's page.
 */
export default async function PayPage({
  searchParams,
}: Readonly<{ searchParams: Promise<Record<string, string | string[] | undefined>> }>) {
  const [query, chrome] = await Promise.all([
    searchParams,
    (await getContentSource()).getSiteChrome(),
  ]);
  const params = parsePayParams(query);
  const origin = payCheckoutOrigin(readBuildEnv());
  const turnstileSiteKey = getFeatures().turnstile ? getEnv().turnstile.siteKey : undefined;
  const contactEmail = chrome.settings.contactEmail;
  const error = params.error ? payErrorMessages[params.error] : undefined;

  return (
    <main id="main" tabIndex={-1}>
      <PageHero
        tone="dark"
        size="title"
        backdrop={heroPhotograph}
        eyebrow="Payments"
        title={title}
        lead="Enter the invoice number and payment code shown on your invoice. You will pay the balance due on Stripe's secure checkout page."
      />
      <Section tone="light" spacing="default">
        <Container
          size="wide"
          className="grid gap-x-(--space-8) gap-y-(--space-7) lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]"
        >
          <div
            data-tone="muted"
            className="relative z-10 min-w-0 text-tone-text md:rounded-2xl md:border md:border-tone-border md:bg-tone-bg md:p-(--space-7) md:shadow-floating lg:col-start-2 lg:row-start-1 lg:-mt-(--space-10)"
          >
            {origin ? (
              <form
                method="post"
                action={payCheckoutUrl(origin)}
                className="flex flex-col gap-(--space-6)"
                aria-labelledby="pay-form-title"
              >
                <h2 id="pay-form-title" className="m-0 text-h3 text-tone-heading">
                  Invoice details
                </h2>
                {error ? (
                  <StatusMessage
                    variant={params.error === "paid" ? "info" : "error"}
                    title={error.title}
                  >
                    <p>{error.body}</p>
                    {contactEmail && params.error !== "verification" ? (
                      <p className="mt-(--space-2)">
                        You can also email{" "}
                        <a className="underline" href={`mailto:${contactEmail}`}>
                          {contactEmail}
                        </a>
                        .
                      </p>
                    ) : null}
                  </StatusMessage>
                ) : null}
                {params.cancelled ? (
                  <StatusMessage variant="info" title="Payment cancelled">
                    <p>Nothing was charged. You can try again whenever you are ready.</p>
                  </StatusMessage>
                ) : null}
                <Field
                  label="Invoice number"
                  id="pay-invoice"
                  required
                  hint="For example INV-2026-0001, at the top of your invoice."
                >
                  <TextInput
                    name="invoice"
                    defaultValue={params.invoice}
                    autoComplete="off"
                    spellCheck={false}
                    autoCapitalize="characters"
                    maxLength={24}
                  />
                </Field>
                <Field
                  label="Payment code"
                  id="pay-code"
                  required
                  hint="The 8-character code under “How to pay” on your invoice."
                >
                  <TextInput
                    name="code"
                    defaultValue={params.code}
                    autoComplete="off"
                    spellCheck={false}
                    autoCapitalize="characters"
                    maxLength={12}
                  />
                </Field>
                {/* Honeypot: hidden from people, filled by bots. */}
                <div className="hidden" aria-hidden="true">
                  <label>
                    Website
                    <input
                      type="text"
                      name="website"
                      tabIndex={-1}
                      autoComplete="off"
                      defaultValue=""
                    />
                  </label>
                </div>
                {turnstileSiteKey ? (
                  <TurnstileWidget siteKey={turnstileSiteKey} contactEmail={contactEmail} />
                ) : null}
                <div>
                  <Button type="submit" size="lg" arrow>
                    Continue to secure payment
                  </Button>
                </div>
                <p className="m-0 text-small text-tone-muted">
                  Payments are processed by Stripe. Your card details are entered on Stripe&rsquo;s
                  page and never reach Vitalos.
                </p>
              </form>
            ) : (
              <StatusMessage variant="info" title="Online payment is not available here">
                <p>
                  {contactEmail ? (
                    <>
                      Email{" "}
                      <a className="underline" href={`mailto:${contactEmail}`}>
                        {contactEmail}
                      </a>{" "}
                      to pay your invoice another way.
                    </>
                  ) : (
                    "Please use the payment link on your invoice."
                  )}
                </p>
              </StatusMessage>
            )}
          </div>
          <div className="min-w-0 lg:col-start-1 lg:row-start-1 lg:pt-(--space-5)">
            <ul className="m-0 flex list-none flex-col gap-(--space-6) p-0">
              <li className="flex gap-(--space-4)">
                <IconTile name="check" />
                <div className="min-w-0">
                  <p className="m-0 font-semibold text-tone-heading">Pay the balance due</p>
                  <p className="m-0 text-tone-text">
                    The amount comes from your invoice, including any part already paid.
                  </p>
                </div>
              </li>
              <li className="flex gap-(--space-4)">
                <IconTile name="shield" />
                <div className="min-w-0">
                  <p className="m-0 font-semibold text-tone-heading">Secure card payment</p>
                  <p className="m-0 text-tone-text">
                    Checkout runs on Stripe. Your invoice is marked as paid once Stripe confirms the
                    payment.
                  </p>
                </div>
              </li>
              {contactEmail ? (
                <li className="flex items-center gap-(--space-4)">
                  <IconTile name="mail" />
                  <div className="min-w-0">
                    <p className="m-0 text-small text-tone-muted">Questions about an invoice</p>
                    <a
                      href={`mailto:${contactEmail}`}
                      className="text-body-l font-semibold text-tone-heading underline-offset-4 hover:underline"
                    >
                      {contactEmail}
                    </a>
                  </div>
                </li>
              ) : null}
            </ul>
            <p className="mt-(--space-6) text-small text-tone-muted">
              Looking for something else?{" "}
              <a className="underline" href={routes.contact()}>
                Contact us
              </a>
              .
            </p>
          </div>
        </Container>
      </Section>
    </main>
  );
}
