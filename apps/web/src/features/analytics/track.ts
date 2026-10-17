import type { AnalyticsEventName, AnalyticsEventProperties } from "./events";
import { vercelAnalyticsSink } from "./vercel-sink";

/**
 * The one way browser code records an analytics event (ADR-046):
 *
 *   track("cta_click", { label: "talk-to-vitalos", page: "/" });
 *
 * Names and properties are checked against the taxonomy (`events.ts`) at compile time; the
 * taxonomy holds no personal data by construction (slugs, paths, hosts). Every event is:
 *
 * 1. announced on `window` as a `vitalos:analytics` CustomEvent (`ANALYTICS_EVENT`), so tests
 *    can observe the wiring with the provider stubbed. Nothing leaves the page this way;
 * 2. forwarded to Vercel Web Analytics when `NEXT_PUBLIC_ANALYTICS_PROVIDER=vercel`.
 *
 * Analytics must never break a journey, so nothing here throws.
 */
export const ANALYTICS_EVENT = "vitalos:analytics";

export interface AnalyticsEventDetail {
  name: AnalyticsEventName;
  properties: Record<string, string>;
}

export function track<E extends AnalyticsEventName>(
  name: E,
  properties: AnalyticsEventProperties<E>,
): void {
  try {
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent<AnalyticsEventDetail>(ANALYTICS_EVENT, {
          detail: { name, properties: { ...properties } as Record<string, string> },
        }),
      );
    }
    vercelAnalyticsSink.track(name, properties);
  } catch {
    // Analytics is best effort.
  }
}

/**
 * Relay's contract with the site (ADR-046): the widget (`@vitalos/relay-widget`) dispatches
 * `new CustomEvent("vitalos:relay", { detail: { type: "opened" | "question" | "handoff" } })` on
 * `window`. The widget never imports the site; `SiteAnalytics` maps these to `relay_*` events.
 */
export const RELAY_EVENT = "vitalos:relay";
export const relayEventTypes = ["opened", "question", "handoff"] as const;
export type RelayEventType = (typeof relayEventTypes)[number];

/** "Talk to Vitalos" → `talk-to-vitalos`; empty when nothing usable is left. */
export function slugifyLabel(value: string): string {
  return value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64)
    .replace(/-+$/g, "");
}

/** The current path without query string or fragment, limited to the taxonomy's characters. */
export function currentPage(): string {
  if (typeof window === "undefined") return "/";
  const path = window.location.pathname;
  return /^\/[A-Za-z0-9\-._~/]*$/.test(path) && path.length <= 200 ? path : "/";
}
