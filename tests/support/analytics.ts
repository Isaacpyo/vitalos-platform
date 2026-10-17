import type { Page } from "@playwright/test";

/**
 * Analytics with the provider stubbed (ADR-046): every `track()` call announces itself as a
 * `vitalos:analytics` window event; this records them in `window.__analytics` from the first
 * script on the page. The e2e builds run with `NEXT_PUBLIC_ANALYTICS_PROVIDER=none`, so nothing is
 * sent anywhere; `/_vercel/*` is also stubbed in case a build has the provider on.
 */
export interface RecordedEvent {
  name: string;
  properties: Record<string, string>;
}

export async function recordAnalytics(page: Page): Promise<void> {
  await page.route("**/_vercel/**", (route) =>
    route.fulfill({ status: 200, contentType: "text/javascript", body: "" }),
  );
  await page.addInitScript(() => {
    const events: unknown[] = [];
    (window as unknown as { __analytics: unknown[] }).__analytics = events;
    window.addEventListener("vitalos:analytics", (event) => {
      events.push((event as CustomEvent).detail);
    });
    // Keep outbound clicks on the page: the listener still sees the click.
    window.addEventListener(
      "click",
      (event) => {
        const link = event.target instanceof Element ? event.target.closest("a[href]") : null;
        if (
          link &&
          new URL(link.getAttribute("href") ?? "", location.href).origin !== location.origin
        ) {
          event.preventDefault();
        }
      },
      { capture: true },
    );
  });
}

/** Waits until `SiteAnalytics` has attached its listeners (after hydration). */
export async function analyticsReady(page: Page): Promise<void> {
  await page.locator('html[data-analytics="ready"]').waitFor({ state: "attached" });
}

export async function recordedEvents(page: Page): Promise<RecordedEvent[]> {
  return page.evaluate(
    () => (window as unknown as { __analytics: RecordedEvent[] }).__analytics ?? [],
  );
}

/** Personal data must never appear in an event (ADR-046). */
export const PERSONAL_DATA = /@|example applicant|applicant@|\?/i;
