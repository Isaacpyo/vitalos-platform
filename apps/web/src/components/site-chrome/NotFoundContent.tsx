import { ctas, routes } from "@vitalos/cms";
import { Button, Container, Heading, Lead, Section } from "@vitalos/ui";

/**
 * The 404 body. The text states a fact and offers two routes that always exist: the home page and
 * the contact page (locked CTA copy). No marketing copy.
 */
export function NotFoundContent() {
  return (
    <main id="main" tabIndex={-1}>
      <Section as="div" spacing="large">
        <Container>
          <Heading level={1}>Page not found</Heading>
          <Lead className="mt-(--space-4)">
            This page does not exist or is no longer available.
          </Lead>
          <div className="mt-(--space-6) flex flex-wrap items-center gap-(--space-5)">
            <Button href={routes.contact()}>{ctas.primary}</Button>
            <Button variant="text" href={routes.home()}>
              Go to the homepage
            </Button>
          </div>
        </Container>
      </Section>
    </main>
  );
}
