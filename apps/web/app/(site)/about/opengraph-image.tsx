import { navLabels } from "@vitalos/cms";
import { loadRoutePage } from "../../../src/templates/commercial/load";
import { ogContentType, ogSize, renderOgImage } from "../../../src/features/seo/og/og-image";

export const alt = "About Vitalos";
export const size = ogSize;
export const contentType = ogContentType;

export default async function Image() {
  const page = await loadRoutePage("about");
  return renderOgImage({ eyebrow: navLabels.about, title: page?.heading ?? navLabels.about });
}
