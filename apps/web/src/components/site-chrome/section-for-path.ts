import { routes } from "@vitalos/cms";

/**
 * Which primary-navigation menu a path belongs to. Keys are the `key`s of `primaryNav` in
 * `@vitalos/cms`: What We Do owns the commercial layers and Labs; Who We Are owns About, How We
 * Work, Industries, Work, Insights and Products; Support owns Contact and the FAQ. Pages outside the menus
 * (home, trust, legal, careers) have no active section.
 */
const sections: readonly { key: string; roots: readonly string[] }[] = [
  {
    key: "what-we-do",
    roots: [routes.whatWeDo(), routes.solutions(), routes.offers(), routes.labs()],
  },
  {
    key: "who-we-are",
    roots: [
      routes.about(),
      routes.howWeWork(),
      routes.industries(),
      routes.work(),
      routes.insights(),
      routes.products(),
    ],
  },
  { key: "support", roots: [routes.contact(), routes.faq()] },
];

const under = (pathname: string, root: string) =>
  pathname === root || pathname.startsWith(`${root}/`);

/**
 * The active menu for a path. A top-level link of its own (an industry lead page, Website Build
 * Pack 25 Oct 2026) wins over the menu that would otherwise own the path.
 */
export function activeSectionForPath(
  pathname: string | null | undefined,
  items: readonly { key: string; href: string }[] = [],
): string | undefined {
  if (!pathname) return undefined;
  const clean = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  const own = items.find((item) => item.key.startsWith("industry-") && under(clean, item.href));
  if (own) return own.key;
  return sections.find((section) => section.roots.some((root) => under(clean, root)))?.key;
}
