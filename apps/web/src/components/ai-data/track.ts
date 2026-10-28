import { vercelAnalyticsSink } from "../../features/analytics/vercel-sink";
import type { AnalyticsEventName, AnalyticsEventProperties } from "../../features/analytics/events";

/**
 * Browser-side tracking for the AI & Data experience. Goes through the same cookieless Vercel sink
 * as the rest of the site (a no-op unless NEXT_PUBLIC_ANALYTICS_PROVIDER=vercel). Every call is
 * type-checked against the closed taxonomy in `features/analytics/events.ts`: slugs and enums
 * only, never free text.
 */
export function track<E extends AnalyticsEventName>(
  name: E,
  properties: AnalyticsEventProperties<E>,
): void {
  vercelAnalyticsSink.track(name, properties);
}

const fired = new Set<string>();

/** Tracks an event once per page view, for funnel events such as `workflow_started`. */
export function trackOnce<E extends AnalyticsEventName>(
  name: E,
  properties: AnalyticsEventProperties<E>,
): void {
  const key = `${name}:${JSON.stringify(properties)}`;
  if (fired.has(`once:${name}`)) return;
  fired.add(`once:${name}`);
  fired.add(key);
  track(name, properties);
}

export const currentRoute = (): string =>
  typeof window === "undefined" ? "/ai-data" : window.location.pathname;
