import { routes } from "@vitalos/cms";
import type { ArtworkFamily, ArtworkSpec } from "@vitalos/ui";

/**
 * Page families and hero tone (ADR-044). Every page's first band carries the brand-system artwork
 * of its family (`HeroArtwork` in @vitalos/ui), replacing the AI-generated cityscape photograph
 * that every hero used before (finding A1). Items get their own variant from their slug.
 *
 * Top-level pages keep the dark hero under the clear header, as the homepage does. Reading pages
 * (an offer, an article, a role, a legal page, a Trust Centre topic) take the light compact hero
 * under the solid header (finding A6). The header reads the same list (`heroToneForPath`), so the
 * server HTML already pairs a clear header with a dark hero and a solid one with a light hero.
 */
export const heroArtwork = (family: ArtworkFamily, seed?: string): ArtworkSpec =>
  seed ? { family, seed } : { family };

/** Route prefixes whose detail pages use the light compact hero. The index pages stay dark. */
const lightHeroRoots: readonly string[] = [
  routes.offers(),
  routes.insights(),
  routes.careers(),
  routes.trust(),
  "/legal",
];

/** `light` for a reading page (an item under one of the roots), otherwise `dark`. */
export function heroToneForPath(pathname: string | null | undefined): "dark" | "light" {
  if (!pathname) return "dark";
  const clean = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  const light = lightHeroRoots.some((root) => {
    const base = root.replace(/\/+$/, "");
    if (!clean.startsWith(`${base}/`)) return false;
    const rest = clean.slice(base.length + 1);
    // One segment below the root is an item; feeds and other routes below it are not pages.
    return rest !== "" && !rest.includes("/") && !rest.includes(".");
  });
  return light ? "light" : "dark";
}
