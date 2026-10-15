import { brandName, practiceNames } from "@vitalos/cms";
import type { PracticeShowcaseImage } from "@vitalos/ui";

/**
 * Illustrations for the five practices on the homepage (owner-supplied, 15 Oct 2026;
 * docs/brand/asset-approval.md). Chosen here by the LOCKED practice names, like the icons, so
 * content carries no presentation; a practice without one (a new document, a fixture) gets none.
 * Served from apps/web/public as pre-sized WebP.
 */
const slugByName: Readonly<Record<string, string>> = {
  [practiceNames[0]]: "consulting",
  [practiceNames[1]]: "engineering",
  [practiceNames[2]]: "ai-data",
  [practiceNames[3]]: "experience",
  [practiceNames[4]]: "managed-services",
};

const normalise = (title: string): string => {
  const trimmed = title.trim();
  const prefix = `${brandName} `;
  return trimmed.startsWith(prefix) ? trimmed.slice(prefix.length) : trimmed;
};

/** The illustration for a practice, by its title; undefined when there is none. */
export function practiceImageFor(title: string): PracticeShowcaseImage | undefined {
  const slug = slugByName[normalise(title)];
  if (!slug) return undefined;
  const base = `/images/practices/${slug}`;
  return {
    src: `${base}-1672.webp`,
    srcSet: `${base}-960.webp 960w, ${base}-1672.webp 1672w`,
    width: 1672,
    height: 941,
  };
}
