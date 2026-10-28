import { ogContentType, ogSize, renderOgImage } from "../../../../src/features/seo/og/og-image";

export const alt = "Vitalos AI & Data approach";
export const size = ogSize;
export const contentType = ogContentType;

export default function Image() {
  return renderOgImage({
    eyebrow: "Vitalos AI & Data",
    title: "Our approach: from problem to live system.",
  });
}
