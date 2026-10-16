import { navLabels } from "@vitalos/cms";
import { loadLegalPage } from "../../../../src/templates/legal/load";
import { ogContentType, ogSize, renderOgImage } from "../../../../src/features/seo/og/og-image";

export const alt = "A Vitalos legal page";
export const size = ogSize;
export const contentType = ogContentType;

export { generateStaticParams } from "./page";

export default async function Image({ params }: Readonly<{ params: Promise<{ slug: string }> }>) {
  const page = await loadLegalPage((await params).slug);
  return renderOgImage({ eyebrow: navLabels.legal, title: page?.title ?? navLabels.legal });
}
