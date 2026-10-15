import { footerColumns, navLabels, routes } from "@vitalos/cms";
import type { NavItem, PublicationGates } from "@vitalos/cms";

/** About view models to pattern props. Pure and framework-free. */

/** Heading above the About page's onward links: the locked footer column title "Explore". */
export const exploreHeading = footerColumns.explore;

/**
 * Onward links from About (Stage 8 §17: How We Work, Trust and Responsible AI links, Careers
 * when active; the Leadership page was removed by owner direction, 15 Oct 2026). Labels are the locked navigation labels. Careers appears only while its
 * section is public, so the page never links to a 404.
 */
export function aboutLinks(gates: PublicationGates): NavItem[] {
  const links: NavItem[] = [
    { key: "how-we-work", label: navLabels.howWeWork, href: routes.howWeWork() },
    { key: "trust", label: navLabels.trustCentre, href: routes.trust() },
  ];
  if (gates.open.careers) {
    links.push({
      key: "careers",
      label: navLabels.careers,
      href: routes.careers(),
      gate: "careers",
    });
  }
  return links;
}
