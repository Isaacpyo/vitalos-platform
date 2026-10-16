import { loadDocument } from "../../../../src/templates/commercial/load";
import { ogContentType, ogSize, renderOgImage } from "../../../../src/features/seo/og/og-image";

export const alt = "An industry Vitalos works in";
export const size = ogSize;
export const contentType = ogContentType;

export { generateStaticParams } from "./page";

export default async function Image({ params }: Readonly<{ params: Promise<{ slug: string }> }>) {
  const doc = await loadDocument("industry", (await params).slug);
  return renderOgImage({ eyebrow: "Industry", title: doc?.title ?? "Industry" });
}
