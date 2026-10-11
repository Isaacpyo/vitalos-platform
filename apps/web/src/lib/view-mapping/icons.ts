import { brandName, industryNames, practiceNames, solutionNames } from "@vitalos/cms";
import type { IconName } from "@vitalos/ui";

/**
 * Decorative subject icons for cards and rows (the owner comp's icon tiles, ADR-023). Icons are
 * chosen here, by the LOCKED names, so content never carries presentation and an unknown title
 * (a new document, a fixture) falls back to a neutral icon for its kind. Icons are always beside
 * the visible title and hidden from assistive technology.
 */
export type IconKind = "practice" | "solution" | "industry" | "offer" | "lab" | "insight";

const byName: Readonly<Record<string, IconName>> = {
  // Practices (Stage 8 section 5).
  [practiceNames[0]]: "compass",
  [practiceNames[1]]: "code",
  [practiceNames[2]]: "chip",
  [practiceNames[3]]: "window",
  [practiceNames[4]]: "server",
  // Solutions (Stage 8 section 11).
  [solutionNames[0]]: "chip",
  [solutionNames[1]]: "workflow",
  [solutionNames[2]]: "layers",
  [solutionNames[3]]: "code",
  [solutionNames[4]]: "chart",
  // Industries (Stage 8 section 13).
  [industryNames[0]]: "shield",
  [industryNames[1]]: "window",
  [industryNames[2]]: "workflow",
  [industryNames[3]]: "chart",
};

const fallback: Readonly<Record<IconKind, IconName>> = {
  practice: "layers",
  solution: "workflow",
  industry: "building",
  offer: "document",
  lab: "flask",
  insight: "document",
};

const normalise = (title: string): string => {
  const trimmed = title.trim();
  const prefix = `${brandName} `;
  return trimmed.startsWith(prefix) ? trimmed.slice(prefix.length) : trimmed;
};

/** The icon for an item of the given kind, by its title. */
export function iconFor(kind: IconKind, title: string): IconName {
  return byName[normalise(title)] ?? fallback[kind];
}
