import { navLabels } from "@vitalos/cms";
import { loadRoutePage } from "../../../src/templates/commercial/load";
import { ogContentType, ogSize, renderOgImage } from "../../../src/features/seo/og/og-image";

export const alt = "Vitalos products";
export const size = ogSize;
export const contentType = ogContentType;

export default async function Image() {
  const page = await loadRoutePage("products");
  return renderOgImage({
    eyebrow: navLabels.products,
    title: page?.heading ?? navLabels.products,
  });
}
