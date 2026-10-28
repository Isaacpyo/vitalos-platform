/**
 * Single source of truth for public URLs (web app, sitemap, redirects).
 * URL architecture: Stage 8 §7; route inventory: Stage 10 §11-12; manifest: ADR-022.
 */
import type { GateKey } from "./content/gates";

export const labTypes = [
  "research",
  "reference-architectures",
  "demonstrators",
  "accelerators",
  "open-source",
  "experiments",
  "product-incubation",
] as const;
export type LabType = (typeof labTypes)[number];

export const trustTopics = [
  "security",
  "privacy",
  "responsible-ai",
  "accessibility",
  "resilience",
  "subprocessors",
  "certifications",
  "procurement",
] as const;
export type TrustTopic = (typeof trustTopics)[number];

export const legalSlugs = [
  "privacy",
  "candidate-privacy",
  "cookies",
  "terms",
  "acceptable-use",
  "accessibility",
] as const;
export type LegalSlug = (typeof legalSlugs)[number];

/** Keys of the singleton "route page" documents that back index pages. */
export const routePageKeys = [
  "what-we-do",
  "solutions",
  "offers",
  "industries",
  "work",
  "insights",
  "labs",
  "about",
  "how-we-work",
  "trust",
  "careers",
  "contact",
  "products",
] as const;
export type RoutePageKey = (typeof routePageKeys)[number];

export const contactIntents = [
  "project",
  "offer",
  "engineering",
  "ai",
  "managed-services",
  "procurement",
  "partnership",
  "careers",
  "general",
] as const;
export type ContactIntent = (typeof contactIntents)[number];

/** Document kinds that have a public detail route. */
export type RoutedDocKind =
  | "practice"
  | "solution"
  | "offer"
  | "industry"
  | "caseStudy"
  | "insight"
  | "person"
  | "labAsset"
  | "trustItem"
  | "job"
  | "legalPage";

export type DocumentRef =
  | {
      kind: Exclude<RoutedDocKind, "labAsset" | "trustItem" | "legalPage">;
      slug: string;
    }
  | { kind: "labAsset"; labType: LabType; slug: string }
  /** For trust topics the slug is the topic key. */
  | { kind: "trustItem"; slug: TrustTopic }
  | { kind: "legalPage"; slug: LegalSlug };

const seg = (value: string) => encodeURIComponent(value);

export const routes = {
  home: () => "/",
  whatWeDo: () => "/what-we-do",
  practice: (slug: string) => `/what-we-do/${seg(slug)}`,
  howWeWork: () => "/how-we-work",
  solutions: () => "/solutions",
  solution: (slug: string) => `/solutions/${seg(slug)}`,
  offers: () => "/offers",
  offer: (slug: string) => `/offers/${seg(slug)}`,
  industries: () => "/industries",
  industry: (slug: string) => `/industries/${seg(slug)}`,
  work: () => "/work",
  caseStudy: (slug: string) => `/work/${seg(slug)}`,
  insights: () => "/insights",
  insight: (slug: string) => `/insights/${seg(slug)}`,
  person: (slug: string) => `/people/${seg(slug)}`,
  labs: () => "/labs",
  labType: (type: LabType) => `/labs/${type}`,
  labAsset: (type: LabType, slug: string) => `/labs/${type}/${seg(slug)}`,
  about: () => "/about",
  faq: () => "/faq",
  trust: () => "/trust",
  trustTopic: (topic: TrustTopic) => `/trust/${topic}`,
  careers: () => "/careers",
  job: (slug: string) => `/careers/${seg(slug)}`,
  contact: (intent?: ContactIntent) => (intent ? `/contact?intent=${intent}` : "/contact"),
  /** Where an accepted enquiry lands (owner direction, 15 Oct 2026). Never indexed. */
  contactThankYou: (reference?: string) =>
    reference ? `/contact/thank-you?ref=${seg(reference)}` : "/contact/thank-you",
  legal: (slug: LegalSlug) => `/legal/${slug}`,
  /** Products Vitalos builds and operates (owner direction, 17 Oct 2026). */
  products: () => "/products",
  product: (slug: string) => `/products/${seg(slug)}`,
  /** The podcast page: where the footer's Spotify and Apple links lead (owner direction, 16 Oct 2026). */
  podcast: () => "/podcast",
  /**
   * Vitalos AI & Data, the division section with its own header (docs/ai-data/PLAN.md, AID-002).
   * Code-authored pages, ungated, in the sitemap except the thank-you receipt.
   */
  aiData: {
    home: () => "/ai-data",
    solutions: () => "/ai-data/solutions",
    approach: () => "/ai-data/approach",
    demonstrator: () => "/ai-data/demonstrator",
    /** `offer` pre-selects one of the AI & Data offer keys in the form. */
    contact: (offer?: string) =>
      offer ? `/ai-data/contact?offer=${seg(offer)}` : "/ai-data/contact",
    /** Where an accepted AI & Data enquiry lands. Never indexed. */
    thankYou: (reference?: string) =>
      reference ? `/ai-data/contact/thank-you?ref=${seg(reference)}` : "/ai-data/contact/thank-you",
  },
  sitemap: () => "/sitemap.xml",
  robots: () => "/robots.txt",
} as const;

export const apiRoutes = {
  health: "/api/health",
  enquiries: "/api/enquiries",
  draftModeEnable: "/api/draft-mode/enable",
  draftModeDisable: "/api/draft-mode/disable",
  revalidate: "/api/revalidate",
  outboxDispatch: "/api/internal/outbox/dispatch",
} as const;

const routePageHref: Record<RoutePageKey, () => string> = {
  "what-we-do": routes.whatWeDo,
  solutions: routes.solutions,
  offers: routes.offers,
  industries: routes.industries,
  work: routes.work,
  insights: routes.insights,
  labs: routes.labs,
  about: routes.about,
  "how-we-work": routes.howWeWork,
  trust: routes.trust,
  careers: routes.careers,
  contact: () => routes.contact(),
  products: routes.products,
};

export function hrefForRoutePage(key: RoutePageKey): string {
  return routePageHref[key]();
}

/** Public URL of a document reference. Used by Presentation resolvers, sitemap and relations. */
export function hrefForDocument(ref: DocumentRef): string {
  switch (ref.kind) {
    case "practice":
      return routes.practice(ref.slug);
    case "solution":
      return routes.solution(ref.slug);
    case "offer":
      return routes.offer(ref.slug);
    case "industry":
      return routes.industry(ref.slug);
    case "caseStudy":
      return routes.caseStudy(ref.slug);
    case "insight":
      return routes.insight(ref.slug);
    case "person":
      return routes.person(ref.slug);
    case "labAsset":
      return routes.labAsset(ref.labType, ref.slug);
    case "trustItem":
      return routes.trustTopic(ref.slug);
    case "job":
      return routes.job(ref.slug);
    case "legalPage":
      return routes.legal(ref.slug);
  }
}

/** Absolute URL for sitemap, canonical and JSON-LD. `siteUrl` must not carry a path. */
export function absoluteUrl(siteUrl: string, path: string): string {
  return new URL(path, siteUrl).toString();
}

export const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const isValidSlug = (value: string): boolean => slugPattern.test(value);

export interface RouteManifestEntry {
  /** Next.js route pattern. */
  pattern: string;
  /** Publication gate that must be open for the index (and detail) to be public. */
  gate?: GateKey;
  /** Whether the route is part of the sitemap. */
  sitemap: boolean;
}

/** The complete page-route manifest. See ADR-022. API routes are listed in `apiRoutes`. */
export const routeManifest: readonly RouteManifestEntry[] = [
  { pattern: "/", sitemap: true },
  { pattern: "/what-we-do", sitemap: true },
  { pattern: "/what-we-do/[practice]", sitemap: true },
  { pattern: "/how-we-work", sitemap: true },
  { pattern: "/solutions", sitemap: true },
  { pattern: "/solutions/[slug]", sitemap: true },
  { pattern: "/offers", sitemap: true },
  { pattern: "/offers/[slug]", sitemap: true },
  { pattern: "/industries", gate: "industries", sitemap: true },
  { pattern: "/industries/[slug]", gate: "industries", sitemap: true },
  { pattern: "/work", gate: "work", sitemap: true },
  { pattern: "/work/[slug]", gate: "work", sitemap: true },
  { pattern: "/insights", gate: "insights", sitemap: true },
  { pattern: "/insights/[slug]", gate: "insights", sitemap: true },
  { pattern: "/people/[slug]", sitemap: true },
  { pattern: "/labs", gate: "labs", sitemap: true },
  { pattern: "/labs/[type]", gate: "labs", sitemap: true },
  { pattern: "/labs/[type]/[slug]", gate: "labs", sitemap: true },
  { pattern: "/about", sitemap: true },
  { pattern: "/faq", sitemap: true },
  { pattern: "/trust", sitemap: true },
  { pattern: "/trust/[topic]", sitemap: true },
  { pattern: "/careers", gate: "careers", sitemap: true },
  { pattern: "/careers/[slug]", gate: "careers", sitemap: true },
  { pattern: "/contact", sitemap: true },
  { pattern: "/legal/[slug]", sitemap: true },
  { pattern: "/products", sitemap: true },
  { pattern: "/products/[slug]", sitemap: true },
  // Not indexed while the show links are placeholders (owner direction, 16 Oct 2026).
  { pattern: "/podcast", sitemap: false },
  // Vitalos AI & Data (AID-002): code-authored pages, listed by `aiDataSitemapPaths`.
  { pattern: "/ai-data", sitemap: true },
  { pattern: "/ai-data/solutions", sitemap: true },
  { pattern: "/ai-data/approach", sitemap: true },
  { pattern: "/ai-data/demonstrator", sitemap: true },
  { pattern: "/ai-data/contact", sitemap: true },
  { pattern: "/ai-data/contact/thank-you", sitemap: false },
];

/** The AI & Data pages the sitemap lists (the thank-you receipt is never indexed). */
export const aiDataSitemapPaths: readonly string[] = [
  routes.aiData.home(),
  routes.aiData.solutions(),
  routes.aiData.approach(),
  routes.aiData.demonstrator(),
  routes.aiData.contact(),
];
