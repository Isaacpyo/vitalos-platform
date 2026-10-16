import { loadDocument } from "../../../../src/templates/commercial/load";
import { ogContentType, ogSize, renderOgImage } from "../../../../src/features/seo/og/og-image";

export const alt = "A Vitalos offer";
export const size = ogSize;
export const contentType = ogContentType;

export { generateStaticParams } from "./page";

export default async function Image({ params }: Readonly<{ params: Promise<{ slug: string }> }>) {
  const doc = await loadDocument("offer", (await params).slug);
  return renderOgImage({ eyebrow: "Offer", title: doc?.title ?? "Offer" });
}
