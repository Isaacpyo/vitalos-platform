import "server-only";
import { cache } from "react";
import type { PublicationGates } from "@vitalos/cms";
import { getEnv } from "@vitalos/config";
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
  const [
    chrome,
    practices,
    solutions,
    offers,
    industries,
    labAssets,
    trustTopics,
    legalPages,
    state,
  ] = await Promise.all([
    source.getSiteChrome(),
    source.listSummaries("practice"),
    source.listSummaries("solution"),
    source.listSummaries("offer"),
    source.listSummaries("industry"),
    source.listSummaries("labAsset"),
    source.listSummaries("trustItem"),
    source.listSummaries("legalPage"),
    getSiteStateOrClosed(),
  ]);
  return {
    gates: withContentSections(chrome.gates, state),
    settings: chrome.settings,
    practices,
    solutions,
    offers,
    industries,
    labAssets,
    trustTopics,
    legalPages,
    // Presentation flags (ADR-045): the header variant and the podcast footer block.
    navVariant: getEnv().site.navVariant,
    podcastEnabled: getEnv().site.podcastEnabled,
  };
});

/**
 * Insights and Careers are opened in the Super Admin (`insights_open`, `careers_open`, ADR-039),
 * not by the CMS gates: the navigation, footer, About and homepage follow the admin's site state,
 * failing closed.
 */
export function withContentSections(
  gates: PublicationGates,
  state: { insightsOpen: boolean; careersOpen: boolean },
): PublicationGates {
  return {
    ...gates,
    open: { ...gates.open, insights: state.insightsOpen, careers: state.careersOpen },
  };
}

export interface SiteChromeModel {
  header: HeaderModel;
  footer: FooterModel;
}

export async function loadSiteChrome(): Promise<SiteChromeModel> {
  const content = await loadChromeContent();
  return { header: buildHeaderModel(content), footer: buildFooterModel(content) };
}
