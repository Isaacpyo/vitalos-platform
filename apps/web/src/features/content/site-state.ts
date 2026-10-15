import "server-only";
import { notFound } from "next/navigation";
import { isDraftModeRequest } from "./preview";
import { CLOSED_SITE_STATE } from "./readers";
import type { SiteStateData } from "./schemas";
import { getContentReaders } from "./server";

/**
 * Open and closed (brief A6, ADR-039 4). Insights and Careers are closed unless the admin's
 * `site-state` says otherwise; with no `CONTENT_API_BASE_URL` they are closed and nothing calls
 * out. A closed section's pages are 404 (the proxy answers that first, server-rendered; these
 * guards are the pages' own backstop). Previews still work while a section is closed.
 */

/** `next build` sets this phase; a failed read then must not fail the build. */
export const isBuildPhase = (): boolean => process.env["NEXT_PHASE"] === "phase-production-build";

/**
 * Cached site state (tag `site`). At runtime a failure throws (nothing is cached, ISR keeps the
 * last good page); during `next build` an unreachable admin reads as closed so the build passes
 * and the page is regenerated within the TTL.
 */
export async function getSiteState(): Promise<SiteStateData> {
  try {
    return await getContentReaders().siteState();
  } catch (error) {
    if (isBuildPhase()) return CLOSED_SITE_STATE;
    throw error;
  }
}

/**
 * Site state for chrome (navigation, footer, homepage): fails closed on any error, so a section
 * never appears because of a failure and the shell never errors because of the admin.
 */
export async function getSiteStateOrClosed(): Promise<SiteStateData> {
  try {
    return await getContentReaders().siteState();
  } catch {
    return CLOSED_SITE_STATE;
  }
}

async function requireOpen(section: "insightsOpen" | "careersOpen"): Promise<SiteStateData> {
  const state = await getSiteState();
  if (!state[section] && !(await isDraftModeRequest())) notFound();
  return state;
}

/** `notFound()` unless Insights is open (or this is a preview). */
export const requireInsightsOpen = (): Promise<SiteStateData> => requireOpen("insightsOpen");

/** `notFound()` unless Careers is open (or this is a preview). */
export const requireCareersOpen = (): Promise<SiteStateData> => requireOpen("careersOpen");
