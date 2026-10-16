import { navLabels } from "@vitalos/cms";
import { getSiteStateOrClosed } from "../../../src/features/content/site-state";
import { ogContentType, ogSize, renderOgImage } from "../../../src/features/seo/og/og-image";

/**
 * The Insights index's Open Graph image (docs/seo/DECISIONS.md 21): the admin's heading while the
 * section is open, the section name otherwise. It reads the site state (tag `site`), so it
 * follows the admin's copy; it never fails, so the build never depends on the admin.
 */
export const alt = "Vitalos Insights";
export const size = ogSize;
export const contentType = ogContentType;

export default async function Image() {
  const state = await getSiteStateOrClosed();
  return renderOgImage({
    eyebrow: navLabels.insights,
    title: state.insightsOpen ? state.insights.heading : navLabels.insights,
  });
}
