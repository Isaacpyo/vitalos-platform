import { routes } from "@vitalos/cms";

/**
 * Which primary-navigation section a path belongs to. Keys are the `key`s of `primaryNav` in
 * `@vitalos/cms`. What We Do owns the commercial layers it introduces (practices, solutions,
 * offers, how we work); About owns Leadership. Pages outside the primary navigation (home,
 * contact, trust, legal, careers) have no active section.
 */
const sections: readonly { key: string; roots: readonly string[] }[] = [
  {
    key: "what-we-do",
    roots: [routes.whatWeDo(), routes.solutions(), routes.offers(), routes.howWeWork()],
  },
  { key: "industries", roots: [routes.industries()] },
  { key: "work", roots: [routes.work()] },
  { key: "insights", roots: [routes.insights()] },
  { key: "labs", roots: [routes.labs()] },
  { key: "about", roots: [routes.about()] },
];

const under = (pathname: string, root: string) =>
  pathname === root || pathname.startsWith(`${root}/`);

export function activeSectionForPath(pathname: string | null | undefined): string | undefined {
  if (!pathname) return undefined;
  const clean = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  return sections.find((section) => section.roots.some((root) => under(clean, root)))?.key;
}
