import type { Metadata } from "next";
import { routes } from "@vitalos/cms";
import { JsonLd } from "../../../../src/components/json-ld";
import {
  loadDetailPage,
  loadDocument,
  staticParams,
} from "../../../../src/templates/commercial/load";
import { breadcrumbNode, pageMetadata } from "../../../../src/templates/commercial/seo";
import {
  SolutionTemplate,
  solutionTrail,
} from "../../../../src/templates/solution/SolutionTemplate";

type Props = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  return staticParams("solution", "slug");
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const solution = await loadDocument("solution", slug);
  if (!solution) return {};
  return pageMetadata({
    path: routes.solution(solution.slug),
    title: solution.title,
    description: solution.summary ?? solution.problemStatement,
    seo: solution.seo,
  });
}

export default async function SolutionPage({ params }: Props) {
  const { slug } = await params;
  const { doc, gates, draft } = await loadDetailPage("solution", slug);
  return (
    <>
      <JsonLd data={breadcrumbNode(solutionTrail(doc))} />
      <SolutionTemplate solution={doc} gates={gates} draft={draft} />
    </>
  );
}
