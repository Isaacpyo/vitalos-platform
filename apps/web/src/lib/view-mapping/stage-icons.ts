import type { IconName } from "@vitalos/ui";

/**
 * Line icons for the nine delivery stages on the lifecycle ring (ADR-044), replacing the glossy
 * discs cut from the owner-supplied "Blue Circular Workflow Cycle" image (finding A3). Chosen by
 * the LOCKED stage names (`howWeWorkStages`); a stage without one shows a plain disc.
 */
const iconByStage: Readonly<Record<string, IconName>> = {
  Qualify: "filter",
  Discover: "search",
  Define: "target",
  Design: "ruler",
  Engineer: "code",
  Validate: "success",
  Release: "release",
  Operate: "gauge",
  Improve: "cycle",
};

/** The line icon for a stage, by its title; undefined when there is none. */
export function stageIconFor(title: string): IconName | undefined {
  return iconByStage[title.trim()];
}
