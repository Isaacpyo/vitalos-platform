import type { Metadata } from "next";
import { routes } from "@vitalos/cms";
import { Button } from "@vitalos/ui";
import { TrackOnMount } from "../../../../../src/components/analytics/track-on-mount";
import { AiDataPage } from "../../../../../src/components/ai-data/chrome";
import { ArrowLink, Band, Eyebrow } from "../../../../../src/components/ai-data/primitives";
import { RichText } from "../../../../../src/components/rich-text";
import { getContentSource } from "../../../../../src/lib/cms/get-content-source";

const title = "Your enquiry has been received";

/** Enquiry references are `VIT-` and twelve hex digits; anything else is not shown. */
const referencePattern = /^VIT-[0-9A-F]{12}$/i;

/** A receipt is never indexed and is not in the sitemap. */
export const metadata: Metadata = {
  title: "Enquiry received",
  robots: { index: false, follow: false },
};

/**
 * Where an accepted AI & Data enquiry lands (`?ref=` carries the reference, an opaque id, not
 * personal data). What happens next is the main contact page's own copy.
 */
export default async function AiDataThankYouPage({
  searchParams,
}: Readonly<{ searchParams: Promise<{ ref?: string | string[] }> }>) {
  const [{ ref }, page] = await Promise.all([
    searchParams,
    (await getContentSource()).getRoutePage("contact"),
  ]);
  const reference = typeof ref === "string" && referencePattern.test(ref) ? ref.toUpperCase() : "";
  return (
    <AiDataPage current="contact">
      <TrackOnMount
        name="contact_submit"
        properties={{ outcome: "success", route: routes.aiData.contact() }}
      />
      <Band tone="dark" grid labelledBy="aid-received">
        <div className="flex max-w-(--container-prose) flex-col gap-(--space-5)">
          <Eyebrow>Vitalos AI &amp; Data</Eyebrow>
          <h1 id="aid-received" className="m-0 text-h1 text-aid-heading">
            {title}
          </h1>
          {reference ? (
            <p role="status" className="m-0 text-body-l text-aid-text">
              Your reference is <strong className="font-mono text-aid-heading">{reference}</strong>.
              Keep it if you need to refer to this enquiry.
            </p>
          ) : null}
          {page?.successMessage ? <p className="m-0 text-aid-text">{page.successMessage}</p> : null}
          <div className="flex flex-col gap-(--space-4) pt-(--space-2) sm:flex-row sm:items-center">
            <Button href={routes.aiData.demonstrator()} variant="secondary" size="lg">
              See the demonstrator
            </Button>
            <ArrowLink href={routes.aiData.home()}>Back to Vitalos AI &amp; Data</ArrowLink>
          </div>
        </div>
      </Band>
      {page?.expectations && page.expectations.length > 0 ? (
        <Band tone="light" labelledBy="aid-next-steps">
          <div className="flex max-w-(--container-prose) flex-col gap-(--space-5)">
            <h2 id="aid-next-steps" className="m-0 text-h2 text-aid-heading">
              What happens next
            </h2>
            <RichText value={page.expectations} />
          </div>
        </Band>
      ) : null}
    </AiDataPage>
  );
}
