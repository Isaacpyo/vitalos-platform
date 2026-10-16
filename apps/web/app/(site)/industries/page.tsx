import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { navLabels, routes } from "@vitalos/cms";
import { JsonLd } from "../../../src/components/json-ld";
import { getContentSource } from "../../../src/lib/cms/get-content-source";
import { loadRoutePage, requireIndexGate } from "../../../src/templates/commercial/load";
import { pageGraph, pageMetadata } from "../../../src/templates/commercial/seo";
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
  const [page, industries] = await Promise.all([
    loadRoutePage("industries"),
    source.listSummaries("industry"),
  ]);
  if (!page && industries.length === 0) notFound();
  return (
    <>
      <JsonLd
        data={pageGraph({
          trail: industriesTrail(),
          name: page?.heading ?? navLabels.industries,
          description: page?.intro,
          type: "CollectionPage",
        })}
      />
      <IndustryIndexTemplate page={page} industries={industries} />
    </>
  );
}
