import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { routes } from "@vitalos/cms";
import { isDetailIndexableNow } from "../../../../../src/features/publication-gates/gates";
import { pageMetadata } from "../../../../../src/templates/institutional/metadata";
import { LabAssetPage } from "../../../../../src/templates/labs/LabAssetPage";
import { listLabAssetParams, loadLabAsset } from "../../../../../src/templates/labs/load";

type Params = { type: string; slug: string };

export async function generateStaticParams(): Promise<Params[]> {
  return listLabAssetParams();
}

export async function generateMetadata({
  params,
}: Readonly<{ params: Promise<Params> }>): Promise<Metadata> {
  const { type, slug } = await params;
  const data = await loadLabAsset(type, slug);
  if (!data) notFound();
  return pageMetadata({
    path: routes.labAsset(data.type, slug),
    title: data.asset.title,
    description: data.asset.summary,
    seo: data.asset.seo,
    // Reachable but not indexed while the Labs section is below its gate (ADR-022).
    noindex: !(await isDetailIndexableNow("labs")),
  });
}

export default async function LabAssetRoute({ params }: Readonly<{ params: Promise<Params> }>) {
  const { type, slug } = await params;
  const data = await loadLabAsset(type, slug);
  if (!data) notFound();
  return <LabAssetPage data={data} />;
}
