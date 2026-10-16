import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { routes } from "@vitalos/cms";
import { structuralSeo } from "@vitalos/cms/repo";
import { requireGateOpen } from "../../../../src/features/publication-gates/gates";
import { pageMetadata } from "../../../../src/templates/institutional/metadata";
import { LabTypePage } from "../../../../src/templates/labs/LabTypePage";
import { listLabTypeParams, loadLabType } from "../../../../src/templates/labs/load";
import { isLabType, labTypeLabel } from "../../../../src/templates/labs/map";

type Params = { type: string };

export async function generateStaticParams(): Promise<Params[]> {
  return listLabTypeParams();
}

export async function generateMetadata({
  params,
}: Readonly<{ params: Promise<Params> }>): Promise<Metadata> {
  const { type } = await params;
  if (!isLabType(type)) notFound();
  await requireGateOpen("labs");
  const data = await loadLabType(type);
  if (!data) notFound();
  return pageMetadata({
    path: routes.labType(type),
    title: labTypeLabel(type),
    description: structuralSeo.labTypes[type]?.description,
  });
}

export default async function LabTypeRoute({ params }: Readonly<{ params: Promise<Params> }>) {
  const { type } = await params;
  // Unknown type: 404. A known type with no published assets also 404s (no empty category pages).
  if (!isLabType(type)) notFound();
  await requireGateOpen("labs");
  const data = await loadLabType(type);
  if (!data) notFound();
  return <LabTypePage data={data} />;
}
