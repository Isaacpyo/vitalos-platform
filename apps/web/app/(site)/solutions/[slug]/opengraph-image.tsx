import { loadDocument } from "../../../../src/templates/commercial/load";
import { ogContentType, ogSize, renderOgImage } from "../../../../src/features/seo/og/og-image";

export const alt = "A Vitalos solution";
export const size = ogSize;
export const contentType = ogContentType;

export { generateStaticParams } from "./page";

export default async function Image({ params }: Readonly<{ params: Promise<{ slug: string }> }>) {
  const doc = await loadDocument("solution", (await params).slug);
  return renderOgImage({ eyebrow: "Solution", title: doc?.title ?? "Solution" });
}
