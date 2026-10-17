import { brandName, industryNames, offerNames, practiceNames, solutionNames } from "@vitalos/cms";
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
  // AI & Data and AI Transformation: never a chip, a brain or a robot (brand book; ADR-044).
  [practiceNames[2]]: "dataflow",
  [practiceNames[3]]: "window",
  [practiceNames[4]]: "server",
  // Labs, the sixth area beside the five practices (run decision 1).
  Labs: "flask",
  // Solutions (Stage 8 section 11).
  [solutionNames[0]]: "stages",
  [solutionNames[1]]: "workflow",
  [solutionNames[2]]: "layers",
  [solutionNames[3]]: "code",
  [solutionNames[4]]: "chart",
  [solutionNames[5]]: "shield",
  // Industries (Stage 8 section 13).
  [industryNames[0]]: "shield",
  [industryNames[1]]: "window",
  [industryNames[2]]: "workflow",
  [industryNames[3]]: "chart",
};

/**
 * Offers (Stage 8 section 12), kept apart because an offer can share its name with a solution
 * (Application Modernisation). Added for the pages redesign (15 Oct 2026).
 */
const byOffer: Readonly<Record<string, IconName>> = {
  [offerNames[0]]: "compass",
  [offerNames[1]]: "gauge",
  [offerNames[2]]: "search",
  [offerNames[3]]: "flask",
  [offerNames[4]]: "window",
  [offerNames[5]]: "layers",
  [offerNames[6]]: "link",
  [offerNames[7]]: "workflow",
  [offerNames[8]]: "chart",
  [offerNames[9]]: "users",
  [offerNames[10]]: "shield",
  [offerNames[11]]: "server",
  [offerNames[12]]: "target",
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
  const name = normalise(title);
  if (kind === "offer") return byOffer[name] ?? fallback.offer;
  return byName[name] ?? fallback[kind];
}
