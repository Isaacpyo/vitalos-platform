import { solutionNames } from "@vitalos/cms";
import type { SolutionShowcaseImage } from "@vitalos/ui";

/**
 * Illustrations for the six solutions on the homepage (owner-supplied, 15 Oct 2026;
 * docs/brand/asset-approval.md). Chosen here by the LOCKED solution names, like the icons, so
 * content carries no presentation; a solution without one (a fixture) shows its icon instead.
 * Square, transparent WebP served from apps/web/public.
 */
const slugByName: Readonly<Record<string, string>> = {
  [solutionNames[0]]: "ai-transformation",
  [solutionNames[1]]: "business-process-modernisation",
  [solutionNames[2]]: "digital-product-transformation",
  [solutionNames[3]]: "application-modernisation",
  [solutionNames[4]]: "data-intelligence-transformation",
  [solutionNames[5]]: "technology-recovery-reliability",
};

/** The illustration for a solution, by its title; undefined when there is none. */
export function solutionImageFor(title: string): SolutionShowcaseImage | undefined {
  const slug = slugByName[title.trim()];
  if (!slug) return undefined;
  const base = `/images/solutions/${slug}`;
  return {
    src: `${base}-800.webp`,
    srcSet: `${base}-480.webp 480w, ${base}-800.webp 800w`,
    width: 800,
    height: 800,
  };
}
