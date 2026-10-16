import { navLabels } from "@vitalos/cms";
import { loadTrustTopic } from "../../../../src/templates/trust/load";
import { ogContentType, ogSize, renderOgImage } from "../../../../src/features/seo/og/og-image";

export const alt = "A Vitalos Trust Centre topic";
export const size = ogSize;
export const contentType = ogContentType;

export { generateStaticParams } from "./page";

export default async function Image({ params }: Readonly<{ params: Promise<{ topic: string }> }>) {
  const data = await loadTrustTopic((await params).topic);
  return renderOgImage({
    eyebrow: navLabels.trustCentre,
    title: data?.view.title ?? navLabels.trustCentre,
  });
}
