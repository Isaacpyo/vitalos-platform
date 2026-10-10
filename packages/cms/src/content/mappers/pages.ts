/**
 * Mappers for site chrome, route pages, the homepage, gate counts, summaries lists and the sitemap.
 */
import { evaluateGates, gateForKind, gateKeys, isSitemapEligible } from "../gates";
import type { GateKey, PublicationGates } from "../gates";
import { homeSections } from "../../locked-copy";
import type { HomeSectionKey } from "../../locked-copy";
import { contactIntents, hrefForDocument, labTypes, legalSlugs, trustTopics } from "../../routes";
import type { DocumentRef, RoutePageKey } from "../../routes";
import type {
  ContactPageView,
  DocKind,
  ContactRouteView,
  HomePageView,
  JobSummary,
  ProofItemView,
  RoutePageView,
  SiteSettingsView,
  SitemapEntry,
  SocialLinkView,
  TrustOverviewView,
  TrustTopicSummary,
} from "../types";
import {
  clean,
  isHttps,
  isPublicStatus,
  isVerifiedPublicEvidence,
  list,
  mapCaseStudySummary,
  mapBasicSummary,
  mapCta,
  mapEvidence,
  mapImage,
  mapInsightSummary,
  mapLabAssetSummary,
  mapOptionalRichText,
  mapPersonSummary,
  mapSeo,
  mapSummaries,
  mapTrustTopicSummary,
  oneOf,
  text,
} from "./common";
import { isJobOpen } from "./documents";
import type {
  Maybe,
  MapContext,
  RawGateCounts,
  RawHomePage,
  RawJobSummary,
  RawRoutePage,
  RawSiteSettings,
  RawSitemap,
} from "./raw";

export function mapSiteSettings(raw: Maybe<RawSiteSettings>, ctx: MapContext): SiteSettingsView {
  if (!raw || !isPublicStatus(raw.editorialStatus, ctx)) return {};
  const social = list(raw.social).flatMap((link): SocialLinkView[] => {
    const label = text(link.label);
    // Verified channels only.
    return link.verified === true && label !== undefined && isHttps(link.href)
      ? [{ label, href: link.href }]
      : [];
  });
  const logoImage = mapImage(raw.logo);
  const defaultSeo = mapSeo(raw.defaultSeo);
  return clean<SiteSettingsView>({
    legalName: text(raw.legalName),
    companyNumber: text(raw.companyNumber),
    registeredAddress: text(raw.registeredAddress),
    contactEmail: text(raw.contactEmail),
    securityEmail: text(raw.securityEmail),
    social: social.length > 0 ? social : undefined,
    defaultSeo: Object.keys(defaultSeo).length > 0 ? defaultSeo : undefined,
    logo: logoImage
      ? clean<NonNullable<SiteSettingsView["logo"]>>({
          src: logoImage.url,
          width: logoImage.width,
          height: logoImage.height,
          alt: logoImage.decorative ? undefined : logoImage.alt,
        })
      : undefined,
  });
}

/** Counts per gate from the gate-counts query result; anything invalid counts as zero. */
export function mapGateCounts(raw: Maybe<RawGateCounts>): PublicationGates {
  const counts: Partial<Record<GateKey, number>> = {};
  for (const key of gateKeys) {
    const value = raw?.[key];
    counts[key] = typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0;
  }
  return evaluateGates(counts);
}

function mapRoutePageBase(
  raw: RawRoutePage,
  key: RoutePageKey,
  ctx: MapContext,
): RoutePageView | null {
  const heading = text(raw.heading);
  if (heading === undefined) return null;
  return clean<RoutePageView>({
    key,
    heading,
    intro: text(raw.intro),
    body: mapOptionalRichText(raw.body, ctx),
    seo: mapSeo(raw.seo),
    cta: mapCta(raw.cta, ctx),
  });
}

export function mapRoutePage(
  raw: Maybe<RawRoutePage>,
  key: RoutePageKey,
  ctx: MapContext,
): RoutePageView | null {
  if (!raw || raw.key !== key || !isPublicStatus(raw.editorialStatus, ctx)) return null;
  return mapRoutePageBase(raw, key, ctx);
}

export function mapContactPage(raw: Maybe<RawRoutePage>, ctx: MapContext): ContactPageView | null {
  if (!raw || raw.key !== "contact" || !isPublicStatus(raw.editorialStatus, ctx)) return null;
  const base = mapRoutePageBase(raw, "contact", ctx);
  if (!base) return null;
  const seen = new Set<string>();
  const routes = list(raw.routes).flatMap((route): ContactRouteView[] => {
    const intent = oneOf(contactIntents, route.intent);
    const label = text(route.label);
    if (intent === undefined || label === undefined || seen.has(intent)) return [];
    seen.add(intent);
    return [clean<ContactRouteView>({ intent, label, description: text(route.description) })];
  });
  return clean<ContactPageView>({
    ...base,
    key: "contact",
    expectations: mapOptionalRichText(raw.expectations, ctx),
    successMessage: text(raw.successMessage),
    routes,
  });
}

export function mapTrustOverview(
  raw: Maybe<RawRoutePage>,
  topics: readonly TrustTopicSummary[],
  ctx: MapContext,
): TrustOverviewView | null {
  if (!raw || raw.key !== "trust" || !isPublicStatus(raw.editorialStatus, ctx)) return null;
  const base = mapRoutePageBase(raw, "trust", ctx);
  return base ? { ...base, key: "trust", topics } : null;
}

export function mapHomePage(raw: Maybe<RawHomePage>, ctx: MapContext): HomePageView | null {
  if (!raw || !isPublicStatus(raw.editorialStatus, ctx)) return null;
  const knownKeys = homeSections.map((section) => section.key as string);
  const headings: Partial<Record<HomeSectionKey, string>> = {};
  for (const entry of list(raw.homeSections)) {
    const key = text(entry.sectionKey);
    const heading = text(entry.visibleHeading);
    // A section without an authored heading renders none: never fall back to structural labels.
    if (key !== undefined && heading !== undefined && knownKeys.includes(key)) {
      headings[key as HomeSectionKey] = heading;
    }
  }
  const proof = list(raw.proof).flatMap((item): ProofItemView[] => {
    const label = text(item.label);
    if (label === undefined || !isVerifiedPublicEvidence(item.evidence)) return [];
    return [
      clean<ProofItemView>({
        label,
        evidence: mapEvidence(item.evidence),
        href: isHttps(item.href) ? item.href : undefined,
      }),
    ];
  });
  return clean<HomePageView>({
    seo: mapSeo(raw.seo),
    headings,
    proof,
    solutions: mapSummaries(raw.solutions, mapBasicSummary, ctx),
    practices: mapSummaries(raw.practices, mapBasicSummary, ctx),
    // Selected work shows verified case studies only.
    selectedWork: mapSummaries(
      list(raw.selectedWork).filter((work) => work.evidence?.evidenceStatus === "verified"),
      mapCaseStudySummary,
      ctx,
    ),
    industries: mapSummaries(raw.industries, mapBasicSummary, ctx),
    labs: mapSummaries(raw.labs, mapLabAssetSummary, ctx),
    insights: mapSummaries(raw.insights, mapInsightSummary, ctx),
    leadership: mapSummaries(raw.leadership, mapPersonSummary, ctx),
    trustHighlights: mapSummaries(raw.trustHighlights, mapTrustTopicSummary, ctx),
    finalCta: mapCta(raw.finalCta, ctx),
  });
}

/* ---------- Lists, params, sitemap ---------- */

export function mapJobSummary(raw: Maybe<RawJobSummary>, ctx: MapContext): JobSummary | undefined {
  const base = mapBasicSummary(raw, ctx);
  if (!base) return undefined;
  return clean<JobSummary>({
    ...base,
    location: text(raw?.location),
    employmentType: text(raw?.employmentType),
  });
}

/** Open, unexpired roles only (the careers index and the Careers gate). */
export function mapOpenJobSummaries(raw: Maybe<readonly Maybe<RawJobSummary>[]>, ctx: MapContext) {
  return mapSummaries(
    list(raw).filter((job) => isJobOpen(job, ctx)),
    mapJobSummary,
    ctx,
  );
}

/**
 * Static route params for a kind, derived from its mapped summaries (so they inherit every
 * public-safety rule): `{ slug }`, `{ type, slug }` for lab assets, `{ topic }` for trust items.
 */
export function paramsFromSummaries(
  kind: DocKind,
  summaries: readonly Record<string, unknown>[],
): Record<string, string>[] {
  const out: Record<string, string>[] = [];
  const seen = new Set<string>();
  for (const summary of summaries) {
    const slug = text(summary.slug);
    const topic = oneOf(trustTopics, summary.topic);
    const labType = oneOf(labTypes, summary.labType);
    let params: Record<string, string> | undefined;
    if (kind === "trustItem") params = topic === undefined ? undefined : { topic };
    else if (kind === "labAsset") {
      params = slug === undefined || labType === undefined ? undefined : { type: labType, slug };
    } else params = slug === undefined ? undefined : { slug };
    if (params === undefined) continue;
    const key = JSON.stringify(params);
    if (!seen.has(key)) {
      seen.add(key);
      out.push(params);
    }
  }
  return out;
}

function refFor(kind: DocKind, entry: Record<string, unknown>): DocumentRef | undefined {
  const slug = text(entry.slug);
  switch (kind) {
    case "labAsset": {
      const labType = oneOf(labTypes, entry.labType);
      return slug === undefined || labType === undefined ? undefined : { kind, labType, slug };
    }
    case "trustItem": {
      const topic = oneOf(trustTopics, entry.topic);
      return topic === undefined ? undefined : { kind, slug: topic };
    }
    case "legalPage": {
      const legal = oneOf(legalSlugs, slug);
      return legal === undefined ? undefined : { kind, slug: legal };
    }
    default:
      return slug === undefined ? undefined : { kind, slug };
  }
}

const sitemapKinds: readonly DocKind[] = [
  "practice",
  "solution",
  "offer",
  "industry",
  "caseStudy",
  "insight",
  "person",
  "labAsset",
  "trustItem",
  "job",
  "legalPage",
];

/**
 * Sitemap entries for documents: noindex documents and documents of a closed gate are excluded
 * (ADR-022). Static routes are added by the web app, which owns the route manifest.
 */
export function mapSitemap(
  raw: Maybe<RawSitemap>,
  gates: PublicationGates,
  ctx: MapContext,
): SitemapEntry[] {
  const entries: SitemapEntry[] = [];
  const seen = new Set<string>();
  for (const kind of sitemapKinds) {
    if (!isSitemapEligible(gateForKind(kind), gates)) continue;
    for (const entry of list(raw?.[kind])) {
      if (!isPublicStatus(entry.editorialStatus, ctx) || entry.noindex === true) continue;
      if (
        (kind === "caseStudy" || kind === "labAsset" || kind === "trustItem") &&
        entry.classification !== "public"
      ) {
        continue;
      }
      const ref = refFor(kind, entry as Record<string, unknown>);
      if (ref === undefined) continue;
      const path = hrefForDocument(ref);
      if (seen.has(path)) continue;
      seen.add(path);
      const lastModified = text(entry.updatedAt);
      entries.push(clean<SitemapEntry>({ path, kind, lastModified }));
    }
  }
  return entries;
}
