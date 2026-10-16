import { navLabels } from "@vitalos/cms";
import { loadRoutePage } from "../../../src/templates/commercial/load";
import { ogContentType, ogSize, renderOgImage } from "../../../src/features/seo/og/og-image";

export const alt = "Industries Vitalos works in";
export const size = ogSize;
export const contentType = ogContentType;

export default async function Image() {
  const page = await loadRoutePage("industries");
  return renderOgImage({
    eyebrow: navLabels.industries,
    title: page?.heading ?? navLabels.industries,
  });
}
