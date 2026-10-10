"use client";

import { ctas, routes } from "@vitalos/cms";
import { Button, Container, Heading, Lead, Section, Small } from "@vitalos/ui";

/**
 * Error boundary for rendering errors below the root layout. The error message is never shown
 * (it may contain internals); the digest is a reference the team can match to server logs
 * (Next.js replaces server error messages with a digest in production).
 */
export default function ErrorPage({
  error,
  reset,
}: Readonly<{ error: Error & { digest?: string }; reset: () => void }>) {
  return (
    <main id="main" tabIndex={-1}>
      <Section as="div" spacing="large">
        <Container>
          <Heading level={1}>Something went wrong</Heading>
          <Lead className="mt-(--space-4)">
            We could not load this page. You can try again, or contact us if the problem continues.
          </Lead>
          {error.digest ? (
            <Small className="mt-(--space-3) block">
              Reference: <code>{error.digest}</code>
            </Small>
          ) : null}
          <div className="mt-(--space-6) flex flex-wrap items-center gap-(--space-5)">
            <Button onClick={() => reset()}>Try again</Button>
            <Button variant="text" href={routes.contact()}>
              {ctas.primary}
            </Button>
          </div>
        </Container>
      </Section>
    </main>
  );
}
