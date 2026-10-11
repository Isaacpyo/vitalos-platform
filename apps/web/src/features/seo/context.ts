import "server-only";
import { getEnv, getFeatures } from "@vitalos/config";

/** Deployment facts SEO output depends on. Resolved from the validated server environment. */
export interface SeoContext {
  /** Origin of the site, no path (`NEXT_PUBLIC_SITE_URL`, normalised by @vitalos/config). */
  siteUrl: string;
  /** True only for the production deploy env. */
  indexable: boolean;
}

export function getSeoContext(): SeoContext {
  return { siteUrl: getEnv().siteUrl, indexable: getFeatures().indexable };
}
