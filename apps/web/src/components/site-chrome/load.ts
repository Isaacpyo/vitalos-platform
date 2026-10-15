import "server-only";
import { cache } from "react";
import type { PublicationGates } from "@vitalos/cms";
import { getSiteStateOrClosed } from "../../features/content/site-state";
import { getContentSource } from "../../lib/cms/get-content-source";
import { buildFooterModel, buildHeaderModel } from "./nav-model";
import type { ChromeContent, FooterModel, HeaderModel } from "./nav-model";

/**
 * Everything the shell needs from the content source, read once per request. Summaries are
 * titles and slugs only, so the shell stays light; a failed read of one list degrades that
 * column instead of the whole page.
 */
export const loadChromeContent = cache(async (): Promise<ChromeContent> => {
  const source = await getContentSource();
  const [chrome, practices, solutions, offers, trustTopics, legalPages, state] = await Promise.all([
    source.getSiteChrome(),
    source.listSummaries("practice"),
    source.listSummaries("solution"),
    source.listSummaries("offer"),
    source.listSummaries("trustItem"),
    source.listSummaries("legalPage"),
    getSiteStateOrClosed(),
  ]);
  return {
    gates: withContentSections(chrome.gates, state.insightsOpen),
    settings: chrome.settings,
    practices,
    solutions,
    offers,
    trustTopics,
    legalPages,
  };
});

/**
 * Insights is opened in the Super Admin (`insights_open`, ADR-035), not by the CMS gate: the
 * navigation, footer and homepage follow the admin's site state, failing closed.
 */
export function withContentSections(
  gates: PublicationGates,
  insightsOpen: boolean,
): PublicationGates {
  return { ...gates, open: { ...gates.open, insights: insightsOpen } };
}

export interface SiteChromeModel {
  header: HeaderModel;
  footer: FooterModel;
}

export async function loadSiteChrome(): Promise<SiteChromeModel> {
  const content = await loadChromeContent();
  return { header: buildHeaderModel(content), footer: buildFooterModel(content) };
}
