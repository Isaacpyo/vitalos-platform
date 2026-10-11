import type { Metadata } from "next";
import { navLabels, routes } from "@vitalos/cms";
import { requireGateOpen } from "../../../src/features/publication-gates/gates";
import { CareersIndex } from "../../../src/templates/careers/CareersIndex";
import { loadCareersIndex } from "../../../src/templates/careers/load";
import { pageMetadata } from "../../../src/templates/institutional/metadata";

export async function generateMetadata(): Promise<Metadata> {
  await requireGateOpen("careers");
  const { page } = await loadCareersIndex();
  return pageMetadata({
    path: routes.careers(),
    title: page?.heading ?? navLabels.careers,
    seo: page?.seo,
    noindex: page === null,
  });
}

export default async function CareersPage() {
  // No open roles means no Careers section: 404, never a dead top-level page (Stage 8 §19).
  await requireGateOpen("careers");
  return <CareersIndex data={await loadCareersIndex()} />;
}
