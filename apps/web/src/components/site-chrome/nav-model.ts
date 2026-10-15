/**
 * Site chrome view model: navigation and footer props for the header and footer patterns.
 *
 * Pure. The inputs are what the content source returns (publication gates, site settings and the
 * summaries of the commercial layers); the outputs are plain `@vitalos/ui` props. Structure and
 * labels come from `@vitalos/cms` (navigation.ts, locked-copy.ts); the names inside the columns
 * come from the CMS summaries. Gated items (Industries, Work, Insights, Labs, Careers) appear
 * only when their gate is open, so no navigation link leads to a closed section.
 */
import {
  ctaNav,
  exploreNav,
  filterNavByGates,
  footerColumns,
  footerNav,
  megaMenuColumns,
  navLabels,
  practiceNames,
  primaryNav,
  priorityOfferNames,
  routes,
  solutionNames,
  utilityNav,
  wordmarkText,
} from "@vitalos/cms";
import type {
  LegalPageSummary,
  NavItem,
  OfferSummary,
  PracticeSummary,
  PublicationGates,
  SiteSettingsView,
  SolutionSummary,
  TrustTopicSummary,
} from "@vitalos/cms";
import type {
  FooterColumn,
  MegaMenuColumn,
  PatternLink,
  SiteFooterProps,
  SiteHeaderProps,
  SiteNavItem,
  SiteNavLink,
} from "@vitalos/ui";
import { hrefForSummary } from "../../lib/view-mapping/hrefs";
import { structuralLabels } from "../../lib/view-mapping/labels";
import { orderByLockedNames, pickByLockedNames } from "../../lib/view-mapping/ordering";

export interface ChromeContent {
  gates: PublicationGates;
  settings: SiteSettingsView;
  practices: readonly PracticeSummary[];
  solutions: readonly SolutionSummary[];
  offers: readonly OfferSummary[];
  trustTopics: readonly TrustTopicSummary[];
  legalPages: readonly LegalPageSummary[];
}

export type HeaderModel = Pick<
  SiteHeaderProps,
  "items" | "utility" | "cta" | "logo" | "logoOnDark" | "wordmarkText" | "homeHref"
> & { items: readonly SiteNavItem[]; cta: PatternLink };

export type FooterModel = Pick<SiteFooterProps, "brand" | "columns" | "contact" | "legalIdentity">;

/**
 * Full-colour lockup for the light header, made from the owner-supplied logo (15 Oct 2026;
 * docs/brand/asset-approval.md). Served from apps/web/public. A logo in site settings wins.
 */
export const colourLogo = {
  src: "/brand/vitalos-logo.png",
  width: 940,
  height: 160,
} as const;

/**
 * White monochrome lockup for dark surfaces (the midnight footer, and the clear header over the
 * homepage hero), made from the owner-supplied logo (12 Oct 2026; docs/brand/asset-approval.md).
 * Served from apps/web/public.
 */
export const whiteLogo = {
  src: "/brand/vitalos-logo-white.png",
  width: 937,
  height: 160,
} as const;

const link = (item: NavItem): SiteNavLink => ({
  key: item.key,
  label: item.label,
  href: item.href,
});

function summaryLinks<T extends { title: string }>(
  items: readonly T[],
  hrefOf: (item: T) => string | null,
): SiteNavLink[] {
  return items.flatMap((item) => {
    const href = hrefOf(item);
    return href ? [{ label: item.title, href }] : [];
  });
}

/** The What We Do mega-menu: Practices, Solutions, Popular offers, Explore (Stage 8 section 6). */
export function buildWhatWeDoColumns(content: ChromeContent): MegaMenuColumn[] {
  const practices = summaryLinks(orderByLockedNames(content.practices, practiceNames), (item) =>
    hrefForSummary("practice", item),
  );
  const solutions = summaryLinks(orderByLockedNames(content.solutions, solutionNames), (item) =>
    hrefForSummary("solution", item),
  );
  // Popular offers are the priority offers named in the locked copy; an offer the CMS has not
  // published under one of those names simply does not appear (no filler, no "first six").
  const offers = summaryLinks(pickByLockedNames(content.offers, priorityOfferNames), (item) =>
    hrefForSummary("offer", item),
  );
  const columns: MegaMenuColumn[] = [
    {
      key: "practices",
      heading: megaMenuColumns.practices,
      href: routes.whatWeDo(),
      links: practices,
    },
    {
      key: "solutions",
      heading: megaMenuColumns.solutions,
      href: routes.solutions(),
      links: solutions,
    },
    {
      key: "popular-offers",
      heading: megaMenuColumns.popularOffers,
      href: routes.offers(),
      links: offers,
    },
    { key: "explore", heading: megaMenuColumns.explore, links: exploreNav.map(link) },
  ];
  return columns.filter((column) => column.links.length > 0);
}

export function buildHeaderModel(content: ChromeContent): HeaderModel {
  const items = filterNavByGates(primaryNav, content.gates).map((item): SiteNavItem => {
    const base = { key: item.key, label: item.label, href: item.href };
    if (item.key !== "what-we-do") return base;
    const columns = buildWhatWeDoColumns(content);
    return columns.length > 0 ? { ...base, menu: { columns } } : base;
  });
  return {
    items,
    utility: filterNavByGates(utilityNav, content.gates).map(link),
    cta: { label: ctaNav.label, href: ctaNav.href },
    homeHref: routes.home(),
    wordmarkText,
    logo: content.settings.logo ?? colourLogo,
    logoOnDark: whiteLogo,
  };
}

export function buildFooterModel(content: ChromeContent): FooterModel {
  const { gates, settings } = content;
  const gated = filterNavByGates(primaryNav, gates);
  const gatedSection = (key: string) => gated.filter((item) => item.key === key).map(link);

  const columns: FooterColumn[] = [
    {
      key: "what-we-do",
      heading: footerColumns.whatWeDo,
      links: summaryLinks(orderByLockedNames(content.practices, practiceNames), (item) =>
        hrefForSummary("practice", item),
      ),
    },
    {
      key: "explore",
      heading: footerColumns.explore,
      links: [
        ...exploreNav.map(link),
        ...(content.solutions.length > 0
          ? [{ label: structuralLabels.solutions, href: routes.solutions() }]
          : []),
        ...(content.offers.length > 0
          ? [{ label: structuralLabels.offers, href: routes.offers() }]
          : []),
        ...gatedSection("industries"),
        ...gatedSection("work"),
        ...gatedSection("insights"),
        ...gatedSection("labs"),
      ],
    },
    {
      key: "company",
      heading: footerColumns.company,
      links: [...gatedSection("about"), ...filterNavByGates(footerNav, gates).map(link)],
    },
    {
      key: "trust",
      heading: footerColumns.trust,
      links: [
        ...filterNavByGates(utilityNav, gates).map(link),
        ...summaryLinks(
          // The Trust Centre overview is already linked above; topics follow it.
          content.trustTopics,
          (item) => hrefForSummary("trustItem", item),
        ),
      ],
    },
    {
      key: "legal",
      heading: footerColumns.legal,
      links: summaryLinks(content.legalPages, (item) => hrefForSummary("legalPage", item)),
    },
  ];

  // The registered office address is not repeated on every page (owner decision, 12 Oct 2026);
  // it stays in the privacy notice, which identifies the controller.
  const identityLines = [
    settings.legalName,
    settings.companyNumber ? `Company number ${settings.companyNumber}` : undefined,
  ].filter((line): line is string => typeof line === "string" && line.trim() !== "");

  const social = (settings.social ?? []).filter((item) => item.label.trim() !== "");

  return {
    brand: {
      homeHref: routes.home(),
      wordmarkText,
      logo: whiteLogo,
    },
    columns: columns.filter((column) => column.links.length > 0),
    contact: {
      heading: navLabels.contact,
      ...(settings.contactEmail ? { email: settings.contactEmail } : {}),
      ...(social.length > 0 ? { social } : {}),
    },
    ...(identityLines.length > 0 ? { legalIdentity: { lines: identityLines } } : {}),
  };
}
