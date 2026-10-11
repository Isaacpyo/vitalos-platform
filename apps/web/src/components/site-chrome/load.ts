import "server-only";
import { cache } from "react";
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
  const [chrome, practices, solutions, offers, trustTopics, legalPages] = await Promise.all([
    source.getSiteChrome(),
    source.listSummaries("practice"),
    source.listSummaries("solution"),
    source.listSummaries("offer"),
    source.listSummaries("trustItem"),
    source.listSummaries("legalPage"),
  ]);
  return {
    gates: chrome.gates,
    settings: chrome.settings,
    practices,
    solutions,
    offers,
    trustTopics,
    legalPages,
  };
});

export interface SiteChromeModel {
  header: HeaderModel;
  footer: FooterModel;
}

export async function loadSiteChrome(): Promise<SiteChromeModel> {
  const content = await loadChromeContent();
  return { header: buildHeaderModel(content), footer: buildFooterModel(content) };
}
