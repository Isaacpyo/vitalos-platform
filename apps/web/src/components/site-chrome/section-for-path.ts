import { routes } from "@vitalos/cms";
import type { NavVariant } from "@vitalos/config";

/**
 * Which primary-navigation menu a path belongs to. Keys are the `key`s of `primaryNav` in
 * `@vitalos/cms`: What We Do owns the commercial layers and Labs; Who We Are owns About, How We
 * Work, Industries, Work and Insights; Support owns Contact and the FAQ. Pages outside the menus
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
    ],
  },
  { key: "support", roots: [routes.contact(), routes.faq()] },
];

/**
 * The `ia` header (ADR-045): What We Do owns the commercial layers; Industries, Work, Insights,
 * Labs and About are top-level items of their own (How We Work sits under About). While Work is
 * closed its slot is the Labs item, so `/labs` always marks the `labs` key.
 */
const iaSections: readonly { key: string; roots: readonly string[] }[] = [
  { key: "what-we-do", roots: [routes.whatWeDo(), routes.solutions(), routes.offers()] },
  { key: "industries", roots: [routes.industries()] },
  { key: "work", roots: [routes.work()] },
  { key: "insights", roots: [routes.insights()] },
  { key: "labs", roots: [routes.labs()] },
  { key: "about", roots: [routes.about(), routes.howWeWork()] },
];

const under = (pathname: string, root: string) =>
  pathname === root || pathname.startsWith(`${root}/`);

export function activeSectionForPath(
  pathname: string | null | undefined,
  variant: NavVariant = "current",
): string | undefined {
  if (!pathname) return undefined;
  const clean = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  const table = variant === "ia" ? iaSections : sections;
  return table.find((section) => section.roots.some((root) => under(clean, root)))?.key;
}
