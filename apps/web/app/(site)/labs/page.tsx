import type { Metadata } from "next";
import { navLabels, routes } from "@vitalos/cms";
import { requireGateOpen } from "../../../src/features/publication-gates/gates";
import { pageMetadata } from "../../../src/templates/institutional/metadata";
import { LabsIndex } from "../../../src/templates/labs/LabsIndex";
import { loadLabsIndex } from "../../../src/templates/labs/load";

export async function generateMetadata(): Promise<Metadata> {
  await requireGateOpen("labs");
  const { page } = await loadLabsIndex();
  return pageMetadata({
    path: routes.labs(),
    title: page?.heading ?? navLabels.labs,
    seo: page?.seo,
    noindex: page === null,
  });
}

export default async function LabsPage() {
  await requireGateOpen("labs");
  return <LabsIndex data={await loadLabsIndex()} />;
}
