import { loadRoutePage } from "../../../src/templates/commercial/load";
import { ogContentType, ogSize, renderOgImage } from "../../../src/features/seo/og/og-image";

export const alt = "Vitalos solutions";
export const size = ogSize;
export const contentType = ogContentType;

export default async function Image() {
  const page = await loadRoutePage("solutions");
  return renderOgImage({ eyebrow: "Solutions", title: page?.heading ?? "Solutions" });
}
