import { ogContentType, ogSize, renderOgImage } from "../../../src/features/seo/og/og-image";

/** Open Graph image for the AI & Data home; each section page has its own (seo:check needs og:image per page). */
export const alt = "Vitalos AI & Data: AI that takes work off your team's hands";
export const size = ogSize;
export const contentType = ogContentType;

export default function Image() {
  return renderOgImage({
    eyebrow: "Vitalos AI & Data",
    title: "AI that takes work off your team's hands.",
  });
}
