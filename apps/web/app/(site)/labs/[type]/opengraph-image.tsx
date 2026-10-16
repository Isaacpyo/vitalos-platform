import { navLabels } from "@vitalos/cms";
import { isLabType, labTypeLabel } from "../../../../src/templates/labs/map";
import { ogContentType, ogSize, renderOgImage } from "../../../../src/features/seo/og/og-image";

export const alt = "A Vitalos Labs category";
export const size = ogSize;
export const contentType = ogContentType;

export { generateStaticParams } from "./page";

export default async function Image({ params }: Readonly<{ params: Promise<{ type: string }> }>) {
  const { type } = await params;
  return renderOgImage({
    eyebrow: navLabels.labs,
    title: isLabType(type) ? labTypeLabel(type) : navLabels.labs,
  });
}
