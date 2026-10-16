import { loadDocument } from "../../../../src/templates/commercial/load";
import { ogContentType, ogSize, renderOgImage } from "../../../../src/features/seo/og/og-image";

export const alt = "A Vitalos practice";
export const size = ogSize;
export const contentType = ogContentType;

export { generateStaticParams } from "./page";

export default async function Image({
  params,
}: Readonly<{ params: Promise<{ practice: string }> }>) {
  const doc = await loadDocument("practice", (await params).practice);
  return renderOgImage({ eyebrow: "Practice", title: doc?.title ?? "Practice" });
}
