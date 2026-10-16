import { navLabels } from "@vitalos/cms";
import { loadRoutePage } from "../../../src/templates/commercial/load";
import { ogContentType, ogSize, renderOgImage } from "../../../src/features/seo/og/og-image";

export const alt = "What We Do at Vitalos";
export const size = ogSize;
export const contentType = ogContentType;

export default async function Image() {
  const page = await loadRoutePage("what-we-do");
  return renderOgImage({ eyebrow: navLabels.whatWeDo, title: page?.heading ?? navLabels.whatWeDo });
}
