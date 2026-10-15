import "server-only";
import { cache } from "react";
import type { PublicationGates, RoutePageView } from "@vitalos/cms";
import { loadChromeContent } from "../../components/site-chrome/load";
import { getContentSource } from "../../lib/cms/get-content-source";

export interface AboutData {
  page: RoutePageView | null;
  gates: PublicationGates;
}

export const loadAbout = cache(async (): Promise<AboutData> => {
  const source = await getContentSource();
  // Gates from the chrome: Careers follows the Super Admin's `careers_open` (ADR-039).
  const [page, { gates }] = await Promise.all([source.getRoutePage("about"), loadChromeContent()]);
  return { page, gates };
});
