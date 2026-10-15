import { howWeWorkStages } from "@vitalos/cms";

/**
 * Round illustrations of the nine delivery stages for the homepage lifecycle ring, cut from the
 * owner-supplied "Blue Circular Workflow Cycle" image (15 Oct 2026; docs/brand/asset-approval.md).
 * Chosen by the LOCKED stage names; a stage without one shows a plain disc.
 */
const stageSlugs = new Map<string, string>(
  howWeWorkStages.map((stage) => [stage, stage.toLowerCase()]),
);

export function stageImageFor(
  title: string,
): { src: string; width: number; height: number } | undefined {
  const slug = stageSlugs.get(title.trim());
  return slug ? { src: `/images/how-we-work/${slug}.webp`, width: 192, height: 192 } : undefined;
}
