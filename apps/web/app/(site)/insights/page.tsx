import type { Metadata } from "next";
import { navLabels, routes } from "@vitalos/cms";
import { requireGateOpen } from "../../../src/features/publication-gates/gates";
import { InsightsIndex } from "../../../src/templates/insights/InsightsIndex";
import { loadInsightsIndex } from "../../../src/templates/insights/load";
import { pageMetadata } from "../../../src/templates/institutional/metadata";

export async function generateMetadata(): Promise<Metadata> {
  await requireGateOpen("insights");
  const { page } = await loadInsightsIndex();
  return pageMetadata({
    path: routes.insights(),
    title: page?.heading ?? navLabels.insights,
    seo: page?.seo,
    noindex: page === null,
  });
}

export default async function InsightsPage() {
  // Below the publication gate there is no Insights section: 404, never a "coming soon" page.
  await requireGateOpen("insights");
  return <InsightsIndex data={await loadInsightsIndex()} />;
}
