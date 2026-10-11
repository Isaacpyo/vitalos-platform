/**
 * Site navigation structure. Labels come from locked-copy.ts (Stage 8 §6, Stage 9 §12).
 * Gated items (`gate`) are hidden until their publication gate opens (see content/gates.ts).
 */
import { isNavVisible } from "./content/gates";
import type { GateKey, PublicationGates } from "./content/gates";
import { ctas, navLabels } from "./locked-copy";
import { routes } from "./routes";

export interface NavItem {
  key: string;
  label: string;
  href: string;
  gate?: GateKey;
}

/** Desktop primary navigation, in order. Stage 8 §6 (Desktop primary nav). */
export const primaryNav: readonly NavItem[] = [
  { key: "what-we-do", label: navLabels.whatWeDo, href: routes.whatWeDo() },
  { key: "industries", label: navLabels.industries, href: routes.industries(), gate: "industries" },
  { key: "work", label: navLabels.work, href: routes.work(), gate: "work" },
  { key: "insights", label: navLabels.insights, href: routes.insights(), gate: "insights" },
  { key: "labs", label: navLabels.labs, href: routes.labs(), gate: "labs" },
  { key: "about", label: navLabels.about, href: routes.about() },
];

/** Lower-emphasis utility link. Stage 8 §6; Stage 9 §12. */
export const utilityNav: readonly NavItem[] = [
  { key: "trust", label: navLabels.trustCentre, href: routes.trust() },
];

/** Primary action. Stage 8 §8, §20. */
export const ctaNav: NavItem = { key: "contact", label: ctas.primary, href: routes.contact() };

/** What We Do mega-menu "Explore" column. Stage 8 §6 (mega-menu). */
export const exploreNav: readonly NavItem[] = [
  { key: "how-we-work", label: navLabels.howWeWork, href: routes.howWeWork() },
  { key: "all-what-we-do", label: navLabels.allWhatWeDo, href: routes.whatWeDo() },
];

/** Footer "Company" and "Legal"-adjacent links. Stage 8 §6 (Utility/footer navigation). */
export const footerNav: readonly NavItem[] = [
  { key: "contact", label: navLabels.contact, href: routes.contact() },
  { key: "careers", label: navLabels.careers, href: routes.careers(), gate: "careers" },
  { key: "leadership", label: navLabels.leadership, href: routes.leadership() },
];

export function filterNavByGates(
  items: readonly NavItem[],
  gates: PublicationGates,
): readonly NavItem[] {
  return items.filter((item) => isNavVisible(item.gate, gates));
}
