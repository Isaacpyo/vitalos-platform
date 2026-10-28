import { ogContentType, ogSize, renderOgImage } from "../../../../src/features/seo/og/og-image";

export const alt = "Vitalos AI & Data demonstrator";
export const size = ogSize;
export const contentType = ogContentType;

export default function Image() {
  return renderOgImage({
    eyebrow: "Vitalos AI & Data",
    title: "Supplier statement reconciliation, shown end to end.",
  });
}
