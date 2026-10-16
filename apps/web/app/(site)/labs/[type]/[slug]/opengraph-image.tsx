import { navLabels } from "@vitalos/cms";
import { loadLabAsset } from "../../../../../src/templates/labs/load";
import { labTypeLabel } from "../../../../../src/templates/labs/map";
import { ogContentType, ogSize, renderOgImage } from "../../../../../src/features/seo/og/og-image";

export const alt = "A Vitalos Labs asset";
export const size = ogSize;
export const contentType = ogContentType;

export { generateStaticParams } from "./page";

export default async function Image({
  params,
}: Readonly<{ params: Promise<{ type: string; slug: string }> }>) {
  const { type, slug } = await params;
  const data = await loadLabAsset(type, slug);
  return renderOgImage({
    eyebrow: data ? `${navLabels.labs} · ${labTypeLabel(data.type)}` : navLabels.labs,
    title: data?.asset.title ?? navLabels.labs,
  });
}
