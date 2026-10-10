import type { Metadata } from "next";
import { navLabels, routes } from "@vitalos/cms";
import { pageMetadata } from "../../../src/templates/institutional/metadata";
import { loadTrustOverview } from "../../../src/templates/trust/load";
import { TrustOverview } from "../../../src/templates/trust/TrustOverview";

export async function generateMetadata(): Promise<Metadata> {
  const { page, topics } = await loadTrustOverview();
  return pageMetadata({
    path: routes.trust(),
    title: page?.heading ?? navLabels.trustCentre,
    seo: page?.seo,
    // Neither a Trust document nor a published topic: nothing to index yet.
    noindex: page === null && topics.length === 0,
  });
}

export default async function TrustRoute() {
  return <TrustOverview data={await loadTrustOverview()} />;
}
