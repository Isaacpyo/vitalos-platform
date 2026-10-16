import type { MetadataRoute } from "next";
import { absoluteUrl, routes } from "@vitalos/cms";
import {
  aiAssistantAgents,
  aiTrainingAgents,
  allowAiTraining as defaultAllowAiTraining,
  disallowedPaths,
  searchEngineAgents,
} from "./crawler-policy";

/**
 * robots.txt. Only the canonical host of the `production` deploy env is crawlable (ADR-018,
 * ADR-020, DECISIONS 9); every other environment or host gets `Disallow: /` with no sitemap, in
 * addition to the `X-Robots-Tag: noindex, nofollow` header from `next.config.ts`.
 *
 * In production, a crawler obeys only the most specific group that names it, so every named
 * group repeats the same rules as `*`: allow everything except `/api/` (endpoints, not pages).
 * `/_next/` stays crawlable: search engines need the CSS and JavaScript to render pages. Training
 * crawlers get the same rules or `Disallow: /`, depending on the flag in `crawler-policy.ts`.
 */
export function robotsPolicy(input: {
  /** The request may be indexed (production and the canonical host). */
  indexable: boolean;
  siteUrl: string;
  allowAiTraining?: boolean;
}): MetadataRoute.Robots {
  if (!input.indexable) {
    return { rules: [{ userAgent: "*", disallow: "/" }] };
  }
  const allowTraining = input.allowAiTraining ?? defaultAllowAiTraining;
  const open = { allow: "/", disallow: [...disallowedPaths] };
  return {
    rules: [
      { userAgent: "*", ...open },
      { userAgent: [...searchEngineAgents], ...open },
      { userAgent: [...aiAssistantAgents], ...open },
      allowTraining
        ? { userAgent: [...aiTrainingAgents], ...open }
        : { userAgent: [...aiTrainingAgents], disallow: "/" },
    ],
    sitemap: absoluteUrl(input.siteUrl, routes.sitemap()),
  };
}
