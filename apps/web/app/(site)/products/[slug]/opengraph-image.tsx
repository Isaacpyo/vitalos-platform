import { navLabels, productBySlug } from "@vitalos/cms";
import { ogContentType, ogSize, renderOgImage } from "../../../../src/features/seo/og/og-image";

export const alt = "A Vitalos product";
export const size = ogSize;
export const contentType = ogContentType;

export { generateStaticParams } from "./page";

export default async function Image({ params }: Readonly<{ params: Promise<{ slug: string }> }>) {
  const product = productBySlug((await params).slug);
  return renderOgImage({
    eyebrow: navLabels.products,
    title: product?.name ?? navLabels.products,
  });
}
