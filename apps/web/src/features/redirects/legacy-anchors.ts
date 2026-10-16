import { routes } from "@vitalos/cms";

/**
 * Homepage fragments from the earlier single-page site (docs/seo/REDIRECTS.md). Fragments never
 * reach the server, so `LegacyAnchorRedirect` maps them in the browser. The earlier site was
 * client-rendered, so its anchors are not recoverable from the archive: these are the ones the SEO
 * brief names (`#what-we-do`, `#about`) plus the obvious section names, each to its page.
 */
export const legacyAnchors: Readonly<Record<string, string>> = {
  "what-we-do": routes.whatWeDo(),
  services: routes.whatWeDo(),
  about: routes.about(),
  solutions: routes.solutions(),
  industries: routes.industries(),
  "how-we-work": routes.howWeWork(),
  technologies: routes.labs(),
  contact: routes.contact(),
};

/**
 * Where a homepage fragment should go, or null. A fragment that matches an element on the page
 * (`hasElement`) is a real in-page anchor and is left alone.
 */
export function legacyAnchorTarget(
  hash: string,
  hasElement: (id: string) => boolean,
): string | null {
  const id = decodeURIComponent(hash.replace(/^#/, "")).toLowerCase();
  if (id === "" || hasElement(id)) return null;
  return Object.hasOwn(legacyAnchors, id) ? (legacyAnchors[id] ?? null) : null;
}
