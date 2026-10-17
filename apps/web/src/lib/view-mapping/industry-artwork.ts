import { industryNames } from "@vitalos/cms";
import type { ArtworkSpec } from "@vitalos/ui";

/**
 * Brand-system artwork for the industries (ADR-044), replacing the AI-generated photographs of
 * people at work (finding A4). Each industry draws the Industries family's composition with its
 * own deterministic variant, seeded by the LOCKED industry name's slug.
 */
const slugByName: Readonly<Record<string, string>> = {
  [industryNames[0]]: "health-care",
  [industryNames[1]]: "retail-commerce-consumer",
  [industryNames[2]]: "operations-industry-logistics",
  [industryNames[3]]: "growth-technology",
};

/** The artwork for an industry, by its title (a fixture title gets its own stable variant). */
export function industryArtworkFor(title: string): ArtworkSpec {
  const name = title.trim();
  return { family: "industries", seed: slugByName[name] ?? name.toLowerCase() };
}
