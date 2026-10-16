import { track } from "@vercel/analytics";
import { createValidatingSink, noopAnalyticsSink } from "./sink";
import type { AnalyticsSink } from "./sink";

/**
 * Vercel Web Analytics adapter (docs/seo/DECISIONS.md 23). Cookieless; events carry only the
 * taxonomy's non-personal properties (events.ts), validated before they leave the page. A no-op
 * unless `NEXT_PUBLIC_ANALYTICS_PROVIDER=vercel` (inlined at build). Custom events need a Vercel
 * Pro plan; on Hobby they are dropped and page views still count.
 */
export const analyticsEnabled = process.env.NEXT_PUBLIC_ANALYTICS_PROVIDER === "vercel";

export const vercelAnalyticsSink: AnalyticsSink = analyticsEnabled
  ? createValidatingSink({
      track(name, properties) {
        track(name, properties as Record<string, string>);
      },
    })
  : noopAnalyticsSink;
