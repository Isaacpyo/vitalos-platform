import { draftMode } from "next/headers";
import { VisualEditing } from "next-sanity/visual-editing";
import { apiRoutes } from "@vitalos/cms";
import { Button, Container, Section } from "@vitalos/ui";

/**
 * Shown only while Draft Mode is on (editors reaching the site through Sanity Presentation).
 * Visitors never see it and it adds no markup. It is a banner in the page flow (not a fixed
 * bar, so it can never cover focused content) with a way out: a POST form to the disable route,
 * which also works without JavaScript.
 *
 * `VisualEditing` (Sanity overlays and live refresh) is mounted here, in draft only, so it is
 * absent from every visitor's response.
 */
export async function DraftIndicator() {
  const { isEnabled } = await draftMode();
  if (!isEnabled) return null;
  return (
    <>
      <Section as="aside" tone="dark" spacing="compact" role="status" aria-label="Draft mode">
        <Container
          size="wide"
          className="flex flex-wrap items-center justify-between gap-(--space-4)"
        >
          <p>Draft mode is on. You are viewing unpublished content.</p>
          <form method="post" action={apiRoutes.draftModeDisable}>
            <Button type="submit" variant="secondary" size="sm">
              Exit draft mode
            </Button>
          </form>
        </Container>
      </Section>
      <VisualEditing />
    </>
  );
}
