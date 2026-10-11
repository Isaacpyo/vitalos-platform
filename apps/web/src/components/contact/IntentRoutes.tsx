import { routes } from "@vitalos/cms";
import type { ContactRouteView } from "@vitalos/cms";
import { Heading, Stack, TextLink } from "@vitalos/ui";

export interface IntentRoutesProps {
  routes: readonly ContactRouteView[];
}

/**
 * Editor-defined ways to start a conversation (`ContactPageView.routes`). Each one links back to
 * this page with `?intent=` so the form opens with the topic chosen. Renders nothing without data.
 */
export function IntentRoutes({ routes: items }: IntentRoutesProps) {
  if (items.length === 0) return null;
  return (
    <nav aria-labelledby="contact-routes-heading">
      <Heading level={2} size="h3" id="contact-routes-heading">
        Choose a topic
      </Heading>
      <Stack as="ul" gap={4} className="mt-(--space-4)">
        {items.map((item) => (
          <li key={item.intent}>
            <TextLink href={routes.contact(item.intent)}>{item.label}</TextLink>
            {item.description ? (
              <p className="mt-(--space-1) text-small text-tone-muted">{item.description}</p>
            ) : null}
          </li>
        ))}
      </Stack>
    </nav>
  );
}
