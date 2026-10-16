import { descriptor, proposition } from "@vitalos/cms";
import { ogContentType, ogSize, renderOgImage } from "../../src/features/seo/og/og-image";

export const alt = "Vitalos: Modernise. Build. Adopt AI.";
export const size = ogSize;
export const contentType = ogContentType;

/** The homepage's social image (docs/seo/DECISIONS.md 21). Other pages inherit it unless they have their own. */
export default function Image() {
  return renderOgImage({ eyebrow: descriptor, title: proposition });
}
