import type { MetadataRoute } from "next";
import { absoluteUrl, routes } from "@vitalos/cms";

/**
 * Crawler policy. Only the `production` deploy env is indexable; every other environment
 * (local, preview, staging) disallows everything, in addition to the `X-Robots-Tag: noindex,
 * nofollow` header that `next.config.ts` sets for the same environments (ADR-020). Whether an
 * environment is indexable is decided once, by `@vitalos/config` (`features.indexable`).
 *
 * In production `/api/` is disallowed (endpoints, not pages). `/_next/` stays crawlable: search
 * engines need the CSS and JavaScript to render pages.
 */
export function robotsPolicy(input: { indexable: boolean; siteUrl: string }): MetadataRoute.Robots {
  if (!input.indexable) {
    return { rules: [{ userAgent: "*", disallow: "/" }] };
  }
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: "/api/" }],
    sitemap: absoluteUrl(input.siteUrl, routes.sitemap()),
  };
}
