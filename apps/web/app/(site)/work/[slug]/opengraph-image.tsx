import { navLabels } from "@vitalos/cms";
import { loadCaseStudy } from "../../../../src/templates/work/load";
import { ogContentType, ogSize, renderOgImage } from "../../../../src/features/seo/og/og-image";

export const alt = "A Vitalos case study";
export const size = ogSize;
export const contentType = ogContentType;

export { generateStaticParams } from "./page";

export default async function Image({ params }: Readonly<{ params: Promise<{ slug: string }> }>) {
  const data = await loadCaseStudy((await params).slug);
  return renderOgImage({ eyebrow: navLabels.work, title: data?.study.title ?? navLabels.work });
}
