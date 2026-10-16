import { navLabels } from "@vitalos/cms";
import { structuralLabels } from "../../../src/lib/view-mapping/labels";
import { ogContentType, ogSize, renderOgImage } from "../../../src/features/seo/og/og-image";

export const alt = "Frequently asked questions about Vitalos";
export const size = ogSize;
export const contentType = ogContentType;

export default function Image() {
  return renderOgImage({ eyebrow: navLabels.faq, title: structuralLabels.faq });
}
