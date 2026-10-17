import { brandName, practiceNames } from "@vitalos/cms";
import type { ArtworkSpec } from "@vitalos/ui";

/**
 * Brand-system artwork for the practices (ADR-044), replacing the owner-supplied AI-generated
 * illustrations (finding A3). Every practice draws the What We Do family's composition with its
 * own deterministic variant, seeded by the LOCKED practice name's slug, so content carries no
 * presentation. Labs, the sixth area, draws the Labs family. Any other title (a fixture, a new
 * practice) still gets a stable variant of its own.
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

const slugify = (text: string): string =>
  text
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

/** The artwork for a practice, by its title. */
export function practiceArtworkFor(title: string): ArtworkSpec {
  const name = normalise(title);
  if (name.toLowerCase() === "labs") return { family: "labs", seed: "practice" };
  return { family: "what-we-do", seed: slugByName[name] ?? slugify(name) };
}
