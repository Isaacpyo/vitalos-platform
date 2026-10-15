import type { Metadata } from "next";
import { ctas, routes } from "@vitalos/cms";
import { Button, Container, PageHero, Section } from "@vitalos/ui";
import { getContentSource } from "../../../../src/lib/cms/get-content-source";
import { heroPhotograph } from "../../../../src/lib/view-mapping/hero-images";
import { RichText } from "../../../../src/components/rich-text";

/** The receipt's title: the same words the form showed in place before this page existed. */
const title = "Your enquiry has been received";

/** Enquiry references are `VIT-` and twelve hex digits; anything else is not shown. */
const referencePattern = /^VIT-[0-9A-F]{12}$/i;

/**
 * Static, so the title is in place as soon as the redirect lands (async metadata streams in after
 * a client navigation). A receipt is never indexed and is not in the sitemap.
 */
export const metadata: Metadata = {
  title,
  robots: { index: false, follow: false },
};

/**
 * Where an accepted enquiry lands (owner direction, 15 Oct 2026; it used to confirm in place on
 * the contact page). The compact dark hero carries the receipt: the reference from the link, the
 * CMS success message and onward actions; then what happens next, the contact page's own copy.
 * The reference is an opaque id, not personal data; it is shown only when it has the reference
 * format. A visit without one still reads correctly.
 */
export default async function ThankYouPage({
  searchParams,
}: Readonly<{ searchParams: Promise<{ ref?: string | string[] }> }>) {
  const [{ ref }, page] = await Promise.all([
    searchParams,
    (await getContentSource()).getRoutePage("contact"),
  ]);
  const reference = typeof ref === "string" && referencePattern.test(ref) ? ref.toUpperCase() : "";
  return (
    <main id="main" tabIndex={-1}>
      <PageHero
        tone="dark"
        size="title"
        backdrop={heroPhotograph}
        eyebrow={ctas.primary}
        title={title}
        lead={page?.successMessage}
        actions={
          <>
            <Button href={routes.whatWeDo()} variant="secondary" size="lg" arrow>
              {ctas.secondary}
            </Button>
            <Button variant="text" href={routes.home()}>
              Go to the homepage
            </Button>
          </>
        }
      >
        {reference ? (
          <p role="status" className="m-0 text-body-l">
            Your reference is <strong>{reference}</strong>. Keep it if you need to refer to this
            enquiry.
          </p>
        ) : null}
      </PageHero>
      {/* What happens next: the contact page's own expectations (CMS copy), on a light band. */}
      {page?.expectations && page.expectations.length > 0 ? (
        <Section tone="light" aria-labelledby="next-steps">
          <Container size="wide">
            <h2 id="next-steps" className="m-0 text-h2 text-tone-heading">
              What happens next
            </h2>
            <RichText
              value={page.expectations}
              className="mt-(--space-5) max-w-(--container-prose)"
            />
          </Container>
        </Section>
      ) : null}
    </main>
  );
}
