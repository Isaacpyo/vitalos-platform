import { navLabels } from "@vitalos/cms";
import { loadRoutePage } from "../../../src/templates/commercial/load";
import { ogContentType, ogSize, renderOgImage } from "../../../src/features/seo/og/og-image";

export const alt = "How Vitalos works";
export const size = ogSize;
export const contentType = ogContentType;

export default async function Image() {
  const page = await loadRoutePage("how-we-work");
  return renderOgImage({
    eyebrow: navLabels.howWeWork,
    title: page?.heading ?? navLabels.howWeWork,
  });
}
