import type { Metadata } from "next";
import { navLabels, routes } from "@vitalos/cms";
import { requireGateOpen } from "../../../src/features/publication-gates/gates";
import { pageMetadata } from "../../../src/templates/institutional/metadata";
import { loadWorkIndex } from "../../../src/templates/work/load";
import { WorkIndex } from "../../../src/templates/work/WorkIndex";

export async function generateMetadata(): Promise<Metadata> {
  await requireGateOpen("work");
  const { page } = await loadWorkIndex();
  return pageMetadata({
    path: routes.work(),
    title: page?.heading ?? navLabels.work,
    seo: page?.seo,
    // A Work page with no route-page document has nothing of its own to index.
    noindex: page === null,
  });
}

export default async function WorkPage() {
  // Below the publication gate the index does not exist (ADR-022): 404, never a thin page.
  await requireGateOpen("work");
  return <WorkIndex data={await loadWorkIndex()} />;
}
