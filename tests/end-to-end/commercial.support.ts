import type { Page } from "@playwright/test";

/** Commercial routes served from the fixture sets (slugs are the artificial fixture slugs). */
export const COMMERCIAL_ROUTES_FULL = [
  "/",
  "/what-we-do",
  "/what-we-do/example-practice",
  "/solutions",
  "/solutions/example-solution",
  "/offers",
  "/offers/example-offer",
  "/industries",
  "/industries/example-industry",
  "/how-we-work",
] as const;

/** Routes that exist in the `sparse` set (no industries: the gate is closed). */
export const COMMERCIAL_ROUTES_SPARSE = [
  "/",
  "/what-we-do",
  "/what-we-do/example-practice",
  "/solutions",
  "/solutions/example-solution",
  "/offers",
  "/offers/example-offer",
  "/how-we-work",
] as const;

/** Unique same-site link targets on the current page (paths with query, no fragments). */
export async function internalLinks(page: Page): Promise<string[]> {
  const hrefs = await page
    .locator("a[href]")
    .evaluateAll((anchors) =>
      anchors.map((anchor) => anchor.getAttribute("href") ?? "").filter((href) => href !== ""),
    );
  const unique = new Set<string>();
  for (const href of hrefs) {
    if (!href.startsWith("/") || href.startsWith("//")) continue;
    unique.add(href.split("#")[0] || "/");
  }
  return [...unique];
}
