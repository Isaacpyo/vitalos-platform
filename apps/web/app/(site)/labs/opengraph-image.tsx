import { navLabels } from "@vitalos/cms";
import { loadRoutePage } from "../../../src/templates/commercial/load";
import { ogContentType, ogSize, renderOgImage } from "../../../src/features/seo/og/og-image";

export const alt = "Vitalos Labs";
export const size = ogSize;
export const contentType = ogContentType;

export default async function Image() {
  const page = await loadRoutePage("labs");
  return renderOgImage({ eyebrow: navLabels.labs, title: page?.heading ?? navLabels.labs });
}
