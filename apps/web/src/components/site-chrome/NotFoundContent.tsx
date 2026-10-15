import { ctas, routes } from "@vitalos/cms";
import { Button, PageHero } from "@vitalos/ui";
import { heroPhotograph } from "../../lib/view-mapping/hero-images";
import { ClosingBand } from "../../templates/commercial/bands";

/**
 * The 404 body, on the compact dark hero of every page (pages redesign, 15 Oct 2026). The text
 * states a fact and offers two routes that always exist: the contact page (locked CTA copy) and
 * the home page. No marketing copy.
 */
export function NotFoundContent() {
  return (
    <main id="main" tabIndex={-1}>
      <PageHero
        tone="dark"
        size="title"
        backdrop={heroPhotograph}
        title="Page not found"
        lead="This page does not exist or is no longer available."
        actions={
          <>
            <Button href={routes.contact()} variant="secondary" size="lg" arrow>
              {ctas.primary}
            </Button>
            <Button variant="text" href={routes.home()}>
              Go to the homepage
            </Button>
          </>
        }
      />
      <ClosingBand />
    </main>
  );
}
