import { solutionNames } from "@vitalos/cms";
import type { LineDiagramName } from "@vitalos/ui";

/**
 * Line diagrams for the six solutions (ADR-044), replacing the glossy 3D illustrations (findings
 * A2 and A3). Chosen by the LOCKED solution names, like the icons; a solution without one (a
 * fixture) shows its icon instead. AI Transformation is the AI journey as an abstract staircase,
 * never a brain, a chip or a robot.
 */
const diagramByName: Readonly<Record<string, LineDiagramName>> = {
  [solutionNames[0]]: "ai-journey",
  [solutionNames[1]]: "process",
  [solutionNames[2]]: "product",
  [solutionNames[3]]: "application",
  [solutionNames[4]]: "data",
  [solutionNames[5]]: "reliability",
};

/** The line diagram for a solution, by its title; undefined when there is none. */
export function solutionDiagramFor(title: string): LineDiagramName | undefined {
  return diagramByName[title.trim()];
}
