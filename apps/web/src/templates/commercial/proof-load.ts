import "server-only";
import { cache } from "react";
import { loadChromeContent } from "../../components/site-chrome/load";
import { proofApproachItems } from "../../lib/view-mapping/proof-approach";
import type { ProofApproachItem } from "../../lib/view-mapping/proof-approach";
import { loadRoutePage } from "./load";

/** The "How we prove it" items for the homepage and About, read once per request. */
export const loadProofApproach = cache(async (): Promise<ProofApproachItem[]> => {
  const [chrome, howWeWork, labs, trust, insights] = await Promise.all([
    loadChromeContent(),
    loadRoutePage("how-we-work"),
    loadRoutePage("labs"),
    loadRoutePage("trust"),
    loadRoutePage("insights"),
  ]);
  return proofApproachItems({
    gates: chrome.gates,
    howWeWorkBody: howWeWork?.body,
    labsBody: labs?.body,
    labAssets: chrome.labAssets,
    trustBody: trust?.body,
    insightsIntro: insights?.intro,
  });
});
