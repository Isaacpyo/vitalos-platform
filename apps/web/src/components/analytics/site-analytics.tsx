"use client";

import { useEffect } from "react";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { routes } from "@vitalos/cms";
import { analyticsEnabled } from "../../features/analytics/vercel-sink";
import {
  RELAY_EVENT,
  currentPage,
  relayEventTypes,
  slugifyLabel,
  track,
} from "../../features/analytics/track";
import type { RelayEventType } from "../../features/analytics/track";

/** Page URLs are sent without their query string: a query can carry a reference or an intent. */
const withoutQuery = <T extends { url: string }>(event: T): T => ({
  ...event,
  url: event.url.split("?")[0] ?? event.url,
});

/** Forms that report a first interaction (`data-analytics-form` on the `<form>`). */
type TrackedForm = "enquiry" | "application";

const relayEvents = {
  opened: "relay_opened",
  question: "relay_question",
  handoff: "relay_handoff",
} as const;

/** The CTA label: an explicit accessible name first, then the visible text. */
const labelOf = (link: Element) =>
  slugifyLabel(link.getAttribute("aria-label") ?? link.textContent ?? "");

/**
 * Cookieless analytics for the whole site (docs/seo/DECISIONS.md 23, ADR-046): Vercel Web
 * Analytics page views and Speed Insights field data (Core Web Vitals at p75), loaded only when
 * `NEXT_PUBLIC_ANALYTICS_PROVIDER=vercel`. Both scripts are served from this origin
 * (`/_vercel/…`), so the CSP needs no third-party source.
 *
 * Events are recorded by delegated listeners, so page markup needs no analytics code:
 * - `cta_click`: a `Button` link (`data-cta`) or any link to the contact page;
 * - `outbound_click`: a link to another host (the host only);
 * - `enquiry_started` / `application_started`: the first interaction with a form marked
 *   `data-analytics-form`, once per form per page view;
 * - `relay_*`: the widget's `vitalos:relay` events.
 * `track()` is a no-op towards the provider while analytics is off.
 */
export function SiteAnalytics() {
  useEffect(() => {
    const contact = routes.contact();
    const started = new WeakSet<HTMLFormElement>();

    const onClick = (event: MouseEvent) => {
      const link = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (!link) return;
      let href: URL;
      try {
        href = new URL(link.getAttribute("href") ?? "", window.location.href);
      } catch {
        return;
      }
      const page = currentPage();
      if (href.protocol !== "http:" && href.protocol !== "https:") return;
      if (href.origin !== window.location.origin) {
        track("outbound_click", { host: href.hostname.toLowerCase(), page });
        return;
      }
      if (link.hasAttribute("data-cta") || href.pathname === contact) {
        const label = labelOf(link);
        if (label) track("cta_click", { label, page });
      }
    };

    const onFormStart = (event: Event) => {
      const form =
        event.target instanceof Element
          ? event.target.closest<HTMLFormElement>("form[data-analytics-form]")
          : null;
      if (!form || started.has(form)) return;
      started.add(form);
      const kind = form.dataset.analyticsForm as TrackedForm | undefined;
      if (kind === "enquiry") track("enquiry_started", { page: currentPage() });
      if (kind === "application" && form.dataset.roleSlug) {
        track("application_started", { roleSlug: form.dataset.roleSlug });
      }
    };

    const onRelay = (event: Event) => {
      const type = (event as CustomEvent<{ type?: unknown }>).detail?.type;
      if (!relayEventTypes.includes(type as RelayEventType)) return;
      track(relayEvents[type as RelayEventType], { page: currentPage() });
    };

    document.addEventListener("click", onClick, { capture: true });
    document.addEventListener("focusin", onFormStart, { capture: true });
    document.addEventListener("input", onFormStart, { capture: true });
    window.addEventListener(RELAY_EVENT, onRelay);
    return () => {
      document.removeEventListener("click", onClick, { capture: true });
      document.removeEventListener("focusin", onFormStart, { capture: true });
      document.removeEventListener("input", onFormStart, { capture: true });
      window.removeEventListener(RELAY_EVENT, onRelay);
    };
  }, []);

  if (!analyticsEnabled) return null;
  return (
    <>
      <Analytics beforeSend={withoutQuery} />
      <SpeedInsights beforeSend={withoutQuery} />
    </>
  );
}
