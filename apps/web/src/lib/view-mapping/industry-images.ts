import { industryNames } from "@vitalos/cms";
import type { IndustryShowcaseImage } from "@vitalos/ui";

/**
 * Photographs for the four industries on the homepage (owner-supplied, 15 Oct 2026;
 * docs/brand/asset-approval.md). Chosen by the LOCKED industry names, like the icons, so content
 * carries no presentation; an industry without one (a fixture) keeps the plain glass panel.
 */
const slugByName: Readonly<Record<string, string>> = {
  [industryNames[0]]: "health-care",
  [industryNames[1]]: "retail-commerce-consumer",
  [industryNames[2]]: "operations-industry-logistics",
  [industryNames[3]]: "growth-technology",
};

/** The photograph for an industry, by its title; undefined when there is none. */
export function industryImageFor(title: string): IndustryShowcaseImage | undefined {
  const slug = slugByName[title.trim()];
  if (!slug) return undefined;
  const base = `/images/industries/${slug}`;
  return {
    src: `${base}-1200.webp`,
    srcSet: `${base}-640.webp 640w, ${base}-1200.webp 1200w`,
    width: 1200,
    height: 900,
  };
}
