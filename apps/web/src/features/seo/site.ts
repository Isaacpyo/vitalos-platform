import { brandName } from "@vitalos/cms";

/**
 * Site-wide SEO configuration (docs/seo/STRATEGY.md §1). The canonical origin is not here: it is
 * `NEXT_PUBLIC_SITE_URL`, validated by @vitalos/config (default target `https://vitalos.co.uk`,
 * DECISIONS 2), and read through `getSeoContext()`.
 */
export const seoSite = {
  name: brandName,
  /** BCP 47 for `<html lang>` and JSON-LD `inLanguage`. One language, so no hreflang. */
  language: "en-GB",
  /** Open Graph locale. */
  ogLocale: "en_GB",
  /** `%s | Vitalos`: topic first, brand last. */
  titleTemplate: `%s | ${brandName}`,
  /** Limits checked by tests and `pnpm seo:check` (Google truncates around these lengths). */
  limits: { titleMax: 60, descriptionMin: 120, descriptionMax: 155 },
  /** Static fallback Open Graph image (1200×630), used when no generated image applies. */
  defaultOgImage: { url: "/og/vitalos-default.png", width: 1200, height: 630 },
} as const;

/** The host search engines may index: the host of the canonical origin (no scheme). */
export const canonicalHost = (siteUrl: string): string => new URL(siteUrl).host;

/**
 * True only when a request reaches the canonical host of an indexable deployment. Every other
 * host (a `*.vercel.app` alias of production, a preview, localhost) is kept out of search
 * engines (DECISIONS 9).
 */
export function isIndexableRequest(
  context: { indexable: boolean; siteUrl: string },
  host: string | null | undefined,
): boolean {
  if (!context.indexable || !host) return false;
  return host.toLowerCase() === canonicalHost(context.siteUrl).toLowerCase();
}
