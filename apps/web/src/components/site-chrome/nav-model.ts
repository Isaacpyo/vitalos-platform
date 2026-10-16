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
  aiJourneyStages,
  brandName,
  ctaNav,
  exploreNav,
  filterNavByGates,
  footerColumns,
  footerNav,
  industryNames,
  labTypeLabels,
  megaMenuColumns,
  navLabels,
  practiceNames,
  primaryNav,
  proposition,
  propositionLong,
  routes,
  sectionNav,
  solutionNames,
  supportNav,
  trustNav,
  validatePodcast,
  whoWeAreNav,
  wordmarkText,
} from "@vitalos/cms";
import type {
  ContactIntent,
  IndustrySummary,
  LabAssetSummary,
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
  FooterPodcastLink,
  IconName,
  MegaMenuColumn,
  PatternLink,
  SiteFooterProps,
  SiteHeaderProps,
  SiteNavItem,
  MegaMenuFeature,
  SiteNavLink,
  SiteNavMenu,
} from "@vitalos/ui";
import { hrefForSummary } from "../../lib/view-mapping/hrefs";
import { iconFor } from "../../lib/view-mapping/icons";
import { intentFallbackLabels } from "../contact/labels";
import { structuralLabels } from "../../lib/view-mapping/labels";
import { orderByLockedNames } from "../../lib/view-mapping/ordering";
import { typesWithAssets } from "../../templates/labs/map";

export interface ChromeContent {
  gates: PublicationGates;
  settings: SiteSettingsView;
  practices: readonly PracticeSummary[];
  solutions: readonly SolutionSummary[];
  offers: readonly OfferSummary[];
  /** Industries, for the Who We Are menu (shown while the Industries gate is open). */
  industries: readonly IndustrySummary[];
  /** Lab assets, for the Labs column of What We Do (the lab types that have assets). */
  labAssets: readonly LabAssetSummary[];
  trustTopics: readonly TrustTopicSummary[];
  legalPages: readonly LegalPageSummary[];
}

export type HeaderModel = Pick<
  SiteHeaderProps,
  "items" | "social" | "cta" | "logo" | "logoOnDark" | "compactLogo" | "wordmarkText" | "homeHref"
> & { items: readonly SiteNavItem[]; cta: PatternLink };

export type FooterModel = Pick<
  SiteFooterProps,
  "brand" | "columns" | "legalIdentity" | "podcast" | "legalLinks"
>;

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
 * The V symbol alone, for the header on narrow phones (below 400px), where the lockup would push
 * the action and menu off screen. From the owner-supplied site icon (15 Oct 2026); its blue and
 * aqua read on the light bar and on the clear bar over the hero.
 */
export const markLogo = {
  src: "/brand/vitalos-mark.png",
  width: 184,
  height: 128,
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

/**
 * The What We Do mega-menu: Practices (with their icon), Solutions and Labs, each closed by a link
 * to its index, and a card with the AI journey (Stage 8 section 6, changed by owner direction on
 * 15 Oct 2026: Labs moved in, the Explore column moved to Who We Are, and Popular offers was
 * removed; the offers stay reachable from the What We Do page and the footer).
 */
export function buildWhatWeDoColumns(content: ChromeContent): MegaMenuColumn[] {
  const practices = orderByLockedNames(content.practices, practiceNames).flatMap((item) => {
    const href = hrefForSummary("practice", item);
    return href
      ? [
          {
            label: item.title,
            href,
            icon: iconFor("practice", item.title),
          },
        ]
      : [];
  });
  const solutions = summaryLinks(orderByLockedNames(content.solutions, solutionNames), (item) =>
    hrefForSummary("solution", item),
  );
  // Labs lists the lab types that have assets, and only once the Labs gate is open.
  const labs = content.gates.open.labs
    ? typesWithAssets(content.labAssets).map((type) => ({
        label: labTypeLabels[type],
        href: routes.labType(type),
      }))
    : [];
  const columns: MegaMenuColumn[] = [
    {
      key: "practices",
      heading: megaMenuColumns.practices,
      href: routes.whatWeDo(),
      links: practices,
      more: { label: navLabels.allWhatWeDo, href: routes.whatWeDo() },
    },
    {
      key: "solutions",
      heading: megaMenuColumns.solutions,
      href: routes.solutions(),
      links: solutions,
      more: { label: structuralLabels.allSolutions, href: routes.solutions() },
    },
    {
      key: "labs",
      heading: navLabels.labs,
      href: routes.labs(),
      links: labs,
      more: { label: structuralLabels.allLabs, href: routes.labs() },
    },
  ];
  return columns.filter((column) => column.links.length > 0);
}

/** The What We Do card: the locked headline and the AI journey, with the primary action. */
const whatWeDoFeature: MegaMenuFeature = {
  title: proposition,
  steps: aiJourneyStages,
  links: [
    { label: ctaNav.label, href: ctaNav.href },
    { label: navLabels.howWeWork, href: routes.howWeWork() },
  ],
};

/** Subject icons for the Who We Are company links (decorative, beside the visible label). */
const companyIcons: Readonly<Record<string, IconName>> = {
  about: "building",
  "how-we-work": "workflow",
  work: "document",
  insights: "search",
  "all-what-we-do": "layers",
  careers: "compass",
};

/**
 * The Who We Are mega-menu: the company pages (About, How We Work, then Work, Insights and Careers
 * as their gates open, and All What We Do), the industries while their gate is open, and a card
 * with the proposition.
 */
export function buildWhoWeAreColumns(content: ChromeContent): MegaMenuColumn[] {
  const { gates } = content;
  const company = [
    ...filterNavByGates(whoWeAreNav, gates).filter((item) => item.key !== "industries"),
    ...filterNavByGates(footerNav, gates).filter((item) => item.key === "careers"),
  ].map((item) => ({
    ...link(item),
    ...(companyIcons[item.key] ? { icon: companyIcons[item.key] } : {}),
  }));
  const industries = gates.open.industries
    ? orderByLockedNames(content.industries, industryNames).flatMap((item) => {
        const href = hrefForSummary("industry", item);
        return href ? [{ label: item.title, href, icon: iconFor("industry", item.title) }] : [];
      })
    : [];
  const columns: MegaMenuColumn[] = [
    { key: "company", heading: footerColumns.company, links: company },
    {
      key: "industries",
      heading: navLabels.industries,
      href: routes.industries(),
      links: industries,
      more: { label: structuralLabels.allIndustries, href: routes.industries() },
    },
  ];
  return columns.filter((column) => column.links.length > 0);
}

const whoWeAreFeature: MegaMenuFeature = {
  eyebrow: brandName,
  title: propositionLong,
  links: [
    { label: navLabels.about, href: routes.about() },
    { label: navLabels.howWeWork, href: routes.howWeWork() },
  ],
};

/** Subject icons for the Support menu's links (decorative, beside the visible label). */
const supportIcons: Readonly<Record<string, IconName>> = { contact: "mail", faq: "info" };

/** The enquiry topics the Support menu opens the contact form on, in the form's order. */
const enquiryTopics: readonly { intent: ContactIntent; icon: IconName }[] = [
  { intent: "project", icon: "layers" },
  { intent: "engineering", icon: "code" },
  { intent: "ai", icon: "chip" },
  { intent: "managed-services", icon: "server" },
  { intent: "procurement", icon: "shield" },
  { intent: "partnership", icon: "workflow" },
];

/**
 * The Support menu: Contact and the FAQ, and the contact form opened on a topic (its own labels,
 * `components/contact/labels.ts`, so the menu and the form's preselected topic always match).
 */
export function buildSupportColumns(content: ChromeContent): MegaMenuColumn[] {
  return [
    {
      key: "help",
      heading: navLabels.support,
      links: filterNavByGates(supportNav, content.gates).map((item) => ({
        ...link(item),
        ...(supportIcons[item.key] ? { icon: supportIcons[item.key] } : {}),
      })),
    },
    {
      key: "enquiries",
      heading: structuralLabels.enquiries,
      href: routes.contact(),
      links: enquiryTopics.map(({ intent, icon }) => ({
        label: intentFallbackLabels[intent],
        href: routes.contact(intent),
        icon,
      })),
    },
  ];
}

/** The social profiles in site settings that have a name and an address. */
function socialOf(settings: SiteSettingsView) {
  return (settings.social ?? []).filter(
    (item) => item.label.trim() !== "" && item.href.trim() !== "",
  );
}

export function buildHeaderModel(content: ChromeContent): HeaderModel {
  const { gates } = content;
  const menus: Record<string, SiteNavMenu | undefined> = {
    "what-we-do": { columns: buildWhatWeDoColumns(content), feature: whatWeDoFeature },
    "who-we-are": { columns: buildWhoWeAreColumns(content), feature: whoWeAreFeature },
    support: { columns: buildSupportColumns(content) },
  };
  const items = filterNavByGates(primaryNav, gates).map((item): SiteNavItem => {
    const base = { key: item.key, label: item.label, href: item.href };
    const menu = menus[item.key];
    return menu && menu.columns.some((column) => column.links.length > 0)
      ? { ...base, menu }
      : base;
  });
  const social = socialOf(content.settings);
  return {
    items,
    cta: { label: ctaNav.label, href: ctaNav.href },
    homeHref: routes.home(),
    wordmarkText,
    logo: content.settings.logo ?? colourLogo,
    logoOnDark: whiteLogo,
    compactLogo: markLogo,
    ...(social.length > 0 ? { social } : {}),
  };
}

export function buildFooterModel(content: ChromeContent): FooterModel {
  const { gates, settings } = content;
  const gated = filterNavByGates(sectionNav, gates);
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
        link(trustNav),
        ...summaryLinks(
          // The Trust Centre overview is already linked above; topics follow it.
          content.trustTopics,
          (item) => hrefForSummary("trustItem", item),
        ),
      ],
    },
  ];

  // The registered office address is not repeated on every page (owner decision, 12 Oct 2026);
  // it stays in the privacy notice, which identifies the controller. The contact email is not
  // repeated under the columns either (owner direction, 15 Oct 2026): Contact is in the menus.
  // "© <year> <legal name>" (owner direction, 16 Oct 2026); the year is the build year.
  const identityLines = [
    settings.legalName ? `© ${new Date().getFullYear()} ${settings.legalName}` : undefined,
    settings.companyNumber ? `Company number ${settings.companyNumber}` : undefined,
  ].filter((line): line is string => typeof line === "string" && line.trim() !== "");

  // Podcast links show only when owner-supplied, validated URLs exist (none is ever invented). They
  // lead to the podcast page, which opens each app (owner direction, 16 Oct 2026).
  const podcastUrls = validatePodcast(settings.podcast);
  const podcastLinks: FooterPodcastLink[] = [
    ...(podcastUrls?.spotifyUrl
      ? [
          {
            platform: "spotify" as const,
            label: footerColumns.spotify,
            accessibleName: footerColumns.listenOnSpotify,
            href: routes.podcast(),
          },
        ]
      : []),
    ...(podcastUrls?.appleUrl
      ? [
          {
            platform: "apple" as const,
            label: footerColumns.applePodcastsName,
            accessibleName: footerColumns.listenOnApplePodcasts,
            href: routes.podcast(),
          },
        ]
      : []),
  ];

  // Every approved legal page that exists (privacy notice, cookies, terms, accessibility), then
  // the sitemap. No link is added for a page that does not exist.
  const legalLinks = [
    ...summaryLinks(content.legalPages, (item) => hrefForSummary("legalPage", item)),
    { label: footerColumns.sitemap, href: routes.sitemap() },
  ];

  const social = socialOf(settings);

  return {
    brand: {
      homeHref: routes.home(),
      wordmarkText,
      logo: whiteLogo,
      ...(social.length > 0 ? { social } : {}),
    },
    columns: columns.filter((column) => column.links.length > 0),
    ...(podcastLinks.length > 0
      ? {
          podcast: {
            heading: footerColumns.podcast,
            links: podcastLinks,
          },
        }
      : {}),
    legalLinks,
    ...(identityLines.length > 0 ? { legalIdentity: { lines: identityLines } } : {}),
  };
}
