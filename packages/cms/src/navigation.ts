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

/**
 * Primary navigation, in order: three menus (owner direction, 15 Oct 2026, replacing the Stage 8
 * §6 row of sections). Each label is still a real link to its index: What We Do, About, Contact.
 */
export const primaryNav: readonly NavItem[] = [
  { key: "what-we-do", label: navLabels.whatWeDo, href: routes.whatWeDo() },
  { key: "who-we-are", label: navLabels.whoWeAre, href: routes.about() },
  { key: "support", label: navLabels.support, href: routes.contact() },
];

/** The section indexes the menus and the footer list; gated ones appear once their gate opens. */
export const sectionNav: readonly NavItem[] = [
  { key: "industries", label: navLabels.industries, href: routes.industries(), gate: "industries" },
  { key: "work", label: navLabels.work, href: routes.work(), gate: "work" },
  { key: "insights", label: navLabels.insights, href: routes.insights(), gate: "insights" },
  { key: "labs", label: navLabels.labs, href: routes.labs(), gate: "labs" },
  { key: "about", label: navLabels.about, href: routes.about() },
];

/** Who We Are menu, in order (it took over the What We Do "Explore" column). */
export const whoWeAreNav: readonly NavItem[] = [
  { key: "about", label: navLabels.about, href: routes.about() },
  { key: "how-we-work", label: navLabels.howWeWork, href: routes.howWeWork() },
  { key: "industries", label: navLabels.industries, href: routes.industries(), gate: "industries" },
  { key: "work", label: navLabels.work, href: routes.work(), gate: "work" },
  { key: "insights", label: navLabels.insights, href: routes.insights(), gate: "insights" },
  { key: "all-what-we-do", label: navLabels.allWhatWeDo, href: routes.whatWeDo() },
];

/** Support menu, in order. */
export const supportNav: readonly NavItem[] = [
  { key: "contact", label: navLabels.contact, href: routes.contact() },
  { key: "faq", label: navLabels.faq, href: routes.faq() },
];

/** The Trust Centre: linked from the footer only (owner direction, 15 Oct 2026). */
export const trustNav: NavItem = {
  key: "trust",
  label: navLabels.trustCentre,
  href: routes.trust(),
};

/**
 * The locked information-architecture header (Stage 8 §6), built as the `ia` navigation variant
 * (ADR-045; owner decision 2, 17 Oct 2026). What We Do opens the mega-menu; the gated sections
 * appear once their gate opens. Work has no route while its gate is closed, so its slot shows
 * Labs instead (`iaWorkFallback`) and never links to a 404; Labs then appears once, not twice.
 */
export const iaPrimaryNav: readonly NavItem[] = [
  { key: "what-we-do", label: navLabels.whatWeDo, href: routes.whatWeDo() },
  { key: "industries", label: navLabels.industries, href: routes.industries(), gate: "industries" },
  { key: "work", label: navLabels.work, href: routes.work(), gate: "work" },
  { key: "insights", label: navLabels.insights, href: routes.insights(), gate: "insights" },
  { key: "labs", label: navLabels.labs, href: routes.labs(), gate: "labs" },
  { key: "about", label: navLabels.about, href: routes.about() },
];

/** What the Work slot shows while the Work gate is closed (owner decision 2, 17 Oct 2026). */
export const iaWorkFallback: NavItem = {
  key: "labs",
  label: navLabels.labs,
  href: routes.labs(),
  gate: "labs",
};

/**
 * The `ia` header items for the current gates, in order: Work falls back to Labs while its gate is
 * closed, closed sections are left out and no key appears twice.
 */
export function iaHeaderNav(gates: PublicationGates): readonly NavItem[] {
  const resolved = iaPrimaryNav.map((item) =>
    item.key === "work" && !gates.open.work ? iaWorkFallback : item,
  );
  const seen = new Set<string>();
  return filterNavByGates(resolved, gates).filter((item) => {
    if (seen.has(item.key)) return false;
    seen.add(item.key);
    return true;
  });
}

/**
 * The `ia` utility links: the Trust Centre (Stage 8 §6) and Contact, the enquiry page under the
 * locked "Contact" label (owner decision 6, 17 Oct 2026).
 */
export const iaUtilityNav: readonly NavItem[] = [
  { key: "trust", label: navLabels.trustCentre, href: routes.trust() },
  { key: "contact", label: navLabels.contact, href: routes.contact() },
];

/** Primary action. Stage 8 §8, §20. */
export const ctaNav: NavItem = { key: "contact", label: ctas.primary, href: routes.contact() };

/** The footer "Explore" column's fixed links (Stage 8 §6, once the mega-menu's Explore column). */
export const exploreNav: readonly NavItem[] = [
  { key: "how-we-work", label: navLabels.howWeWork, href: routes.howWeWork() },
  { key: "all-what-we-do", label: navLabels.allWhatWeDo, href: routes.whatWeDo() },
];

/** Footer "Company" and "Legal"-adjacent links. Stage 8 §6 (Utility/footer navigation). */
export const footerNav: readonly NavItem[] = [
  { key: "contact", label: navLabels.contact, href: routes.contact() },
  { key: "faq", label: navLabels.faq, href: routes.faq() },
  { key: "careers", label: navLabels.careers, href: routes.careers(), gate: "careers" },
];

export function filterNavByGates(
  items: readonly NavItem[],
  gates: PublicationGates,
): readonly NavItem[] {
  return items.filter((item) => isNavVisible(item.gate, gates));
}
