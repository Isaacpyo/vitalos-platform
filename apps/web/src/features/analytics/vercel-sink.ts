import { track } from "@vercel/analytics";
import type { AnalyticsEventName, AnalyticsEventProperties } from "./events";
import type { AnalyticsSink } from "./sink";

/**
 * Vercel Web Analytics adapter (docs/seo/DECISIONS.md 23). Cookieless. A no-op unless
 * `NEXT_PUBLIC_ANALYTICS_PROVIDER=vercel` (inlined at build). Custom events need a Vercel Pro
 * plan; on Hobby they are dropped and page views still count.
 *
 * This runs in the browser, so it imports the taxonomy's types only: every call site is checked
 * against `events.ts` at compile time. The zod schemas (`createValidatingSink`) stay on the
 * server, because zod in the client bundle would add weight to every page and its `eval` probe
 * breaks the CSP. The runtime guard below only keeps the payload flat and short.
 */
export const analyticsEnabled = process.env.NEXT_PUBLIC_ANALYTICS_PROVIDER === "vercel";

const flat = (properties: object): properties is Record<string, string> =>
  Object.values(properties).every((value) => typeof value === "string" && value.length <= 200);

export const vercelAnalyticsSink: AnalyticsSink = {
  track<E extends AnalyticsEventName>(name: E, properties: AnalyticsEventProperties<E>) {
    if (!analyticsEnabled || !flat(properties)) return;
    track(name, properties);
  },
};
