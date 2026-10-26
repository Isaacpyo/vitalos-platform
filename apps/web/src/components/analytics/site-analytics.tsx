"use client";

import { useEffect } from "react";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { routes } from "@vitalos/cms";
import { analyticsEnabled, vercelAnalyticsSink } from "../../features/analytics/vercel-sink";

/**
 * The product slug a server-rendered link to a product's own site carries (`data-product`). Read
 * from the link, not from `@vitalos/cms`, so the product copy stays out of the client bundle.
 */
const productOf = (link: Element) => link.getAttribute("data-product") || undefined;

/**
 * The CTA a contact link stands for: a Health & Care intent (Website Build Pack, 25 Oct 2026) is
 * its own CTA; every other contact link is "Talk to Vitalos". Only the fixed intent name is sent,
 * never the query string.
 */
export function ctaIdFor(href: URL): string {
  const intent = href.searchParams.get("intent");
  return intent === "healthcare-audit" || intent === "healthcare-partner"
    ? intent
    : "talk-to-vitalos";
}

/** Page URLs are sent without their query string: a query can carry a reference or an intent. */
const withoutQuery = <T extends { url: string }>(event: T): T => ({
  ...event,
  url: event.url.split("?")[0] ?? event.url,
});

/**
 * Cookieless analytics for the whole site (docs/seo/DECISIONS.md 23): Vercel Web Analytics page
 * views, Speed Insights field data (Core Web Vitals at p75), and one delegated listener for
 * "Talk to Vitalos" clicks (any link to the contact page) and for links to a Vitalos product's
 * own site (`outbound_click`). Renders nothing and loads nothing
 * unless `NEXT_PUBLIC_ANALYTICS_PROVIDER=vercel`. Both scripts are served from this origin
 * (`/_vercel/…`), so the CSP is unchanged.
 */
export function SiteAnalytics() {
  useEffect(() => {
    if (!analyticsEnabled) return;
    const contact = routes.contact();
    const onClick = (event: MouseEvent) => {
      const link = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (!link) return;
      const href = new URL(link.getAttribute("href") ?? "", window.location.href);
      const product = href.origin !== window.location.origin && productOf(link);
      if (product) {
        vercelAnalyticsSink.track("outbound_click", {
          destination: product,
          route: window.location.pathname,
        });
        return;
      }
      if (href.origin !== window.location.origin || href.pathname !== contact) return;
      vercelAnalyticsSink.track("primary_cta_click", {
        ctaId: ctaIdFor(href),
        route: window.location.pathname,
      });
    };
    document.addEventListener("click", onClick, { capture: true });
    return () => document.removeEventListener("click", onClick, { capture: true });
  }, []);

  if (!analyticsEnabled) return null;
  return (
    <>
      <Analytics beforeSend={withoutQuery} />
      <SpeedInsights beforeSend={withoutQuery} />
    </>
  );
}
