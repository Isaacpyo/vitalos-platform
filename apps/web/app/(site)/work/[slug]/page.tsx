import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { routes } from "@vitalos/cms";
import { isDetailIndexableNow } from "../../../../src/features/publication-gates/gates";
import { pageMetadata } from "../../../../src/templates/institutional/metadata";
import { CaseStudyPage } from "../../../../src/templates/work/CaseStudyPage";
import { listCaseStudyParams, loadCaseStudy } from "../../../../src/templates/work/load";

type Params = { slug: string };

export async function generateStaticParams(): Promise<Params[]> {
  return listCaseStudyParams();
}

export async function generateMetadata({
  params,
}: Readonly<{ params: Promise<Params> }>): Promise<Metadata> {
  const { slug } = await params;
  const data = await loadCaseStudy(slug);
  if (!data) notFound();
  return pageMetadata({
    path: routes.caseStudy(slug),
    title: data.study.title,
    description: data.study.summary,
    seo: data.study.seo,
    // Detail pages stay reachable below the Work gate but are not indexed (ADR-022).
    noindex: !(await isDetailIndexableNow("work")),
  });
}

export default async function CaseStudyRoute({ params }: Readonly<{ params: Promise<Params> }>) {
  const { slug } = await params;
  const data = await loadCaseStudy(slug);
  if (!data) notFound();
  return <CaseStudyPage data={data} />;
}
