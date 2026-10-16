import { navLabels } from "@vitalos/cms";
import { loadRolePage } from "../../../../src/features/content/careers/load";
import { ogContentType, ogSize, renderOgImage } from "../../../../src/features/seo/og/og-image";

/**
 * A role's Open Graph image on the site's one template (docs/seo/DECISIONS.md 21): "Careers" and
 * the practice in mono, the role title. It reads through the same cached reader as the page, so
 * it carries the role's tags and updates when the role does.
 */
export const alt = "A role at Vitalos";
export const size = ogSize;
export const contentType = ogContentType;

/** Generated on first request, then cached (ISR) with the role's tags. */
export const generateStaticParams = (): { slug: string }[] => [];

export default async function OpenGraphImage({
  params,
}: Readonly<{ params: Promise<{ slug: string }> }>) {
  const { role } = await loadRolePage((await params).slug);
  return renderOgImage({
    eyebrow: `${navLabels.careers} · ${role.practice.label}`,
    title: role.title,
  });
}
