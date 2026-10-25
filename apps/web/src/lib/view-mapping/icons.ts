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
  [practiceNames[2]]: "chip",
  [practiceNames[3]]: "window",
  [practiceNames[4]]: "server",
  // Solutions (Stage 8 section 11).
  [solutionNames[0]]: "chip",
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
  // Health & Care offers (Website Build Pack, 25 Oct 2026).
  [offerNames[13]]: "timer",
  [offerNames[14]]: "badge-check",
  [offerNames[15]]: "truck",
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

/**
 * Icons for the points of a lead page and the highlights of a case study (Website Build Pack,
 * 25 Oct 2026). Content names each point's subject with a `key` (the brief's Lucide names, as a
 * guide); this maps it onto the site's own set. An unknown key gets the neutral check.
 */
const byPointKey: Readonly<Record<string, IconName>> = {
  inbox: "inbox",
  "file-text": "document",
  unplug: "unplug",
  "shield-check": "shield",
  timer: "timer",
  plug: "plug",
  "badge-check": "badge-check",
  truck: "truck",
  search: "search",
  "flask-conical": "flask",
  rocket: "rocket",
  settings: "settings",
  check: "check",
  x: "close",
  bot: "bot",
  "package-check": "package-check",
  stethoscope: "stethoscope",
  lock: "lock",
  "file-lock": "file-lock",
  accessibility: "accessibility",
  handshake: "users",
  car: "car",
  "user-x": "user-x",
  "user-round": "user-round",
  palette: "palette",
  smartphone: "smartphone",
  receipt: "receipt",
  quote: "quote",
  code: "code",
};

/** The icon for a point's subject key. */
export const pointIcon = (key: string): IconName => byPointKey[key] ?? "check";
