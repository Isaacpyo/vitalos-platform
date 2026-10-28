import { ogContentType, ogSize, renderOgImage } from "../../../src/features/seo/og/og-image";

/** One generated Open Graph image for the AI & Data section; its pages inherit it. */
export const alt = "Vitalos AI & Data: from AI potential to production reality";
export const size = ogSize;
export const contentType = ogContentType;

export default function Image() {
  return renderOgImage({
    eyebrow: "Vitalos AI & Data",
    title: "From AI potential to production reality.",
  });
}
