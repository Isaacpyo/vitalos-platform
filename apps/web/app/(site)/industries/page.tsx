import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { navLabels, routes } from "@vitalos/cms";
import { JsonLd } from "../../../src/components/json-ld";
import { isDraftModeEnabled } from "../../../src/lib/cms/draft";
import { getContentSource } from "../../../src/lib/cms/get-content-source";
import { loadRoutePage, requireIndexGate } from "../../../src/templates/commercial/load";
import { breadcrumbNode, pageMetadata } from "../../../src/templates/commercial/seo";
import {
  IndustryIndexTemplate,
  industriesTrail,
} from "../../../src/templates/industry/IndustryIndexTemplate";

export async function generateMetadata(): Promise<Metadata> {
  const page = await loadRoutePage("industries");
  return pageMetadata({
    path: routes.industries(),
    title: page?.heading ?? navLabels.industries,
    seo: page?.seo,
  });
}

export default async function IndustriesPage() {
  // The Industries gate: 404 until at least one industry is published (ADR-022).
  await requireIndexGate("industries");
  const source = await getContentSource();
  const [page, industries, draft] = await Promise.all([
    loadRoutePage("industries"),
    source.listSummaries("industry"),
    isDraftModeEnabled(),
  ]);
  if (!page && industries.length === 0 && !draft) notFound();
  return (
    <>
      <JsonLd data={breadcrumbNode(industriesTrail())} />
      <IndustryIndexTemplate page={page} industries={industries} draft={draft} />
    </>
  );
}
