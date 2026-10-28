import { ogContentType, ogSize, renderOgImage } from "../../../../src/features/seo/og/og-image";

export const alt = "Discuss your business challenge with Vitalos AI & Data";
export const size = ogSize;
export const contentType = ogContentType;

export default function Image() {
  return renderOgImage({ eyebrow: "Vitalos AI & Data", title: "Discuss your business challenge." });
}
