import { footerColumns, navLabels, routes } from "@vitalos/cms";
import type { NavItem, PersonView, PublicationGates } from "@vitalos/cms";
import type { PersonCardProps } from "@vitalos/ui";
import { toPatternImage } from "../institutional/images";

/** About and Leadership view models to pattern props. Pure and framework-free. */

/** Leadership profiles: public people flagged as leadership, in source order. */
export function leadershipOf(people: readonly PersonView[]): PersonView[] {
  return people.filter((person) => person.isLeadership);
}

export function leaderCardProps(person: PersonView): Omit<PersonCardProps, "headingLevel"> {
  const portrait = toPatternImage(person.portrait);
  return {
    name: person.name,
    href: routes.person(person.slug),
    ...(person.role ? { role: person.role } : {}),
    ...(portrait ? { portrait } : {}),
  };
}

/** Heading above the About page's onward links: the locked footer column title "Explore". */
export const exploreHeading = footerColumns.explore;

/**
 * Onward links from About (Stage 8 §17: leadership, How We Work, Trust and Responsible AI links,
 * Careers when active). Labels are the locked navigation labels. Careers appears only while its
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
