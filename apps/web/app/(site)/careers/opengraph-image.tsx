import { navLabels } from "@vitalos/cms";
import { loadCareersPage } from "../../../src/features/content/careers/load";
import { getSiteStateOrClosed } from "../../../src/features/content/site-state";
import { ogContentType, ogSize, renderOgImage } from "../../../src/features/seo/og/og-image";

/**
 * The Careers page's Open Graph image (docs/seo/DECISIONS.md 21): the admin's heading while the
 * section is open, the section name otherwise or when the read fails. Through the cached readers,
 * so it carries their tags; it never fails, so the build never depends on the admin.
 */
export const alt = "Careers at Vitalos";
export const size = ogSize;
export const contentType = ogContentType;

async function heading(): Promise<string> {
  try {
    if (!(await getSiteStateOrClosed()).careersOpen) return navLabels.careers;
    return (await loadCareersPage()).page.copy.heading;
  } catch {
    return navLabels.careers;
  }
}

export default async function Image() {
  return renderOgImage({ eyebrow: navLabels.careers, title: await heading() });
}
