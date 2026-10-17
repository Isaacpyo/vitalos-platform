import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { routes } from "@vitalos/cms";
import { JsonLd } from "../../../src/components/json-ld";
import { loadChromeContent } from "../../../src/components/site-chrome/load";
import { structuralLabels } from "../../../src/lib/view-mapping/labels";
import { loadRoutePage } from "../../../src/templates/commercial/load";
import { pageGraph, pageMetadata } from "../../../src/templates/commercial/seo";
import {
  SolutionIndexTemplate,
  solutionsTrail,
} from "../../../src/templates/solution/SolutionIndexTemplate";

export async function generateMetadata(): Promise<Metadata> {
  const page = await loadRoutePage("solutions");
  return pageMetadata({
    path: routes.solutions(),
    title: page?.heading ?? structuralLabels.solutions,
    seo: page?.seo,
  });
}

export default async function SolutionsPage() {
  const [page, { solutions }] = await Promise.all([
    loadRoutePage("solutions"),
    loadChromeContent(),
  ]);
  if (!page && solutions.length === 0) notFound();
  return (
    <>
      <JsonLd
        data={pageGraph({
          trail: solutionsTrail(),
          name: page?.heading ?? structuralLabels.solutions,
          description: page?.intro,
          type: "CollectionPage",
          items: solutions.map((d) => ({ name: d.title, path: routes.solution(d.slug) })),
        })}
      />
      <SolutionIndexTemplate page={page} solutions={solutions} />
    </>
  );
}
