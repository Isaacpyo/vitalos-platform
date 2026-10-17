import "server-only";
import { cache } from "react";
import type { PublicationGates, RoutePageView, SiteSettingsView } from "@vitalos/cms";
import { getEnv } from "@vitalos/config";
import { loadChromeContent } from "../../components/site-chrome/load";
import { getContentSource } from "../../lib/cms/get-content-source";
import type { ProofApproachItem } from "../../lib/view-mapping/proof-approach";
import { loadRoutePage } from "../commercial/load";
import { loadProofApproach } from "../commercial/proof-load";
import { sixPracticeShowcaseItems } from "../../lib/view-mapping/showcase";
import type { PracticeShowcaseItem } from "@vitalos/ui";
import { orderByLockedNames } from "../../lib/view-mapping/ordering";
import { practiceNames } from "@vitalos/cms";
import type { ExploreIntros } from "./map";

export interface AboutData {
  page: RoutePageView | null;
  gates: PublicationGates;
  /** The six practices (Vitalos Labs last while its gate is open). */
  practices: readonly PracticeShowcaseItem[];
  /** "How we prove it" items (finding B3). */
  proof: readonly ProofApproachItem[];
  /** The Founder section (`ABOUT_FOUNDER_ENABLED`, ADR-045). */
  founderEnabled: boolean;
  /** Company facts from site settings: legal name, company number, contact email. */
  settings: Pick<SiteSettingsView, "legalName" | "companyNumber" | "contactEmail">;
  /** The onward pages' own introductions, for the Explore cards. */
  intros: ExploreIntros;
}

export const loadAbout = cache(async (): Promise<AboutData> => {
  const source = await getContentSource();
  // Gates from the chrome: Careers follows the Super Admin's `careers_open` (ADR-039).
  const [page, chrome, labs, howWeWork, trust, careers, proof] = await Promise.all([
    source.getRoutePage("about"),
    loadChromeContent(),
    loadRoutePage("labs"),
    loadRoutePage("how-we-work"),
    loadRoutePage("trust"),
    loadRoutePage("careers"),
    loadProofApproach(),
  ]);
  const { gates, settings } = chrome;
  return {
    page,
    gates,
    practices: sixPracticeShowcaseItems(orderByLockedNames(chrome.practices, practiceNames), {
      gates,
      intro: labs?.intro,
    }),
    proof,
    founderEnabled: getEnv().site.aboutFounderEnabled,
    settings: {
      ...(settings.legalName ? { legalName: settings.legalName } : {}),
      ...(settings.companyNumber ? { companyNumber: settings.companyNumber } : {}),
      ...(settings.contactEmail ? { contactEmail: settings.contactEmail } : {}),
    },
    intros: {
      "how-we-work": howWeWork?.intro,
      trust: trust?.intro,
      careers: careers?.intro,
    },
  };
});
