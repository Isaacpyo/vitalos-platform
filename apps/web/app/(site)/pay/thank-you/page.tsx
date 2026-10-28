import type { Metadata } from "next";
import { routes } from "@vitalos/cms";
import { Button, PageHero } from "@vitalos/ui";
import { normaliseInvoice } from "../../../../src/features/pay/pay-params";
import { heroPhotograph } from "../../../../src/lib/view-mapping/hero-images";

const title = "Thank you for your payment";

/** A receipt: never indexed and not in the sitemap. */
export const metadata: Metadata = {
  title,
  robots: { index: false, follow: false },
};

/**
 * Where Stripe returns a payer after checkout (AID-018). Reaching this page does not prove payment:
 * the Super Admin records the payment when Stripe confirms it (webhook or sync), so the copy says
 * exactly that. The invoice number from the link is shown only when it has the invoice format.
 */
export default async function PayThankYouPage({
  searchParams,
}: Readonly<{ searchParams: Promise<{ invoice?: string | string[] }> }>) {
  const invoice = normaliseInvoice((await searchParams).invoice);
  return (
    <main id="main" tabIndex={-1}>
      <PageHero
        tone="dark"
        size="title"
        backdrop={heroPhotograph}
        eyebrow="Payments"
        title={title}
        lead="Stripe has received your payment details. We mark the invoice as paid as soon as Stripe confirms the payment, usually within a few minutes."
        actions={
          <Button href={routes.home()} variant="secondary" size="lg" arrow>
            Go to the homepage
          </Button>
        }
      >
        {invoice ? (
          <p role="status" className="m-0 text-body-l">
            Invoice <strong>{invoice}</strong>. Keep the receipt Stripe shows or sends you for your
            records.
          </p>
        ) : null}
      </PageHero>
    </main>
  );
}
