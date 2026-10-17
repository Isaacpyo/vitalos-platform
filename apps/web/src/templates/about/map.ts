import { footerColumns, homeSections, navLabels, routes } from "@vitalos/cms";
import type { NavItem, PublicationGates, RichText, SiteSettingsView } from "@vitalos/cms";
import type { DefinitionItem } from "@vitalos/ui";
import { firstSentence } from "../../lib/view-mapping/text";

/** About view models to pattern props. Pure and framework-free. */

/** Heading above the About page's onward links: the locked footer column title "Explore". */
export const exploreHeading = footerColumns.explore;

/** Structural labels of the About sections added on 17 Oct 2026 (findings B4). No claims. */
export const aboutLabels = {
  founder: "Founder",
  companyFacts: "Company facts",
  legalName: "Legal name",
  companyNumber: "Company number",
  base: "Based in",
  contact: "Contact",
  authorProfile: "Read the author profile",
} as const;

/** The practices heading: the homepage's locked "Six practices, one firm". */
export const practicesHeading =
  homeSections.find((section) => section.key === "practices")?.visibleHeading ?? "";

/** The onward pages' introductions, by About link key. */
export type ExploreIntros = Partial<
  Record<"how-we-work" | "trust" | "careers", string | undefined>
>;

export interface AboutLink extends NavItem {
  /** One line: the first sentence of the linked page's own introduction. */
  description?: string | undefined;
}

/**
 * Onward links from About (Stage 8 §17: How We Work, Trust and Responsible AI links, Careers
 * when active; the Leadership page was removed by owner direction, 15 Oct 2026). Labels are the
 * locked navigation labels; each card's line is the first sentence of that page's introduction
 * (finding B4). Careers appears only while its section is public, so the page never links to a 404.
 */
export function aboutLinks(gates: PublicationGates, intros: ExploreIntros = {}): AboutLink[] {
  const withLine = (item: NavItem, key: keyof ExploreIntros): AboutLink => {
    const description = firstSentence(intros[key]);
    return description ? { ...item, description } : item;
  };
  const links: AboutLink[] = [
    withLine(
      { key: "how-we-work", label: navLabels.howWeWork, href: routes.howWeWork() },
      "how-we-work",
    ),
    withLine({ key: "trust", label: navLabels.trustCentre, href: routes.trust() }, "trust"),
  ];
  if (gates.open.careers) {
    links.push(
      withLine(
        { key: "careers", label: navLabels.careers, href: routes.careers(), gate: "careers" },
        "careers",
      ),
    );
  }
  return links;
}

/**
 * Company facts (finding B4): the legal name and company number from site settings (the
 * Companies House record), the base from the About page's own "UK first" section, and the contact
 * address. The registered office address is deliberately not shown (owner decision, 12 Oct 2026).
 */
export function companyFacts(
  settings: Pick<SiteSettingsView, "legalName" | "companyNumber" | "contactEmail">,
): DefinitionItem[] {
  const items: { term: string; description: string | undefined }[] = [
    { term: aboutLabels.legalName, description: settings.legalName },
    { term: aboutLabels.companyNumber, description: settings.companyNumber },
    { term: aboutLabels.base, description: "United Kingdom" },
    { term: aboutLabels.contact, description: settings.contactEmail },
  ];
  return items.flatMap((item) =>
    item.description && item.description.trim() !== ""
      ? [{ term: item.term, description: item.description }]
      : [],
  );
}

/**
 * The About body split around its "Six practices, one firm" section, so the practices can be
 * shown as linked cards in place: the blocks before it, the section's own paragraph, and the rest.
 */
export function splitAtPracticesSection(body: RichText | undefined): {
  before: RichText;
  intro: string | undefined;
  after: RichText;
} {
  const blocks = body ?? [];
  const textOf = (block: RichText[number]) =>
    ((block.children as readonly { text?: unknown }[] | undefined) ?? [])
      .map((child) => (typeof child.text === "string" ? child.text : ""))
      .join("")
      .trim();
  const isH2 = (block: RichText[number]) => block.style === "h2";
  const start = blocks.findIndex((block) => isH2(block) && textOf(block) === practicesHeading);
  if (start === -1) return { before: blocks, intro: undefined, after: [] };
  const rest = blocks.slice(start + 1);
  const next = rest.findIndex(isH2);
  const own = next === -1 ? rest : rest.slice(0, next);
  const intro = own.map(textOf).filter(Boolean).join(" ") || undefined;
  return {
    before: blocks.slice(0, start),
    intro,
    after: next === -1 ? [] : rest.slice(next),
  };
}
