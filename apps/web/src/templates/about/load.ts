import "server-only";
import { cache } from "react";
import type { PublicationGates, RoutePageView } from "@vitalos/cms";
import { getContentSource } from "../../lib/cms/get-content-source";

export interface AboutData {
  page: RoutePageView | null;
  gates: PublicationGates;
}

export const loadAbout = cache(async (): Promise<AboutData> => {
  const source = await getContentSource();
  const [page, gates] = await Promise.all([
    source.getRoutePage("about"),
    source.getPublicationGates(),
  ]);
  return { page, gates };
});
