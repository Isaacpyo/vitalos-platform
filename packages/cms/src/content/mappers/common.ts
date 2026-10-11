/**
 * Pure helpers shared by the mappers: value cleaning, public-safety checks, and the mappers for
 * images, SEO, CTAs, evidence, rich text and summaries.
 *
 * Every function here is defensive on purpose. The GROQ projections already exclude non-public
 * data; the mappers re-check, so a projection mistake or a hostile fixture cannot leak content.
 */
import {
  hrefForDocument,
  hrefForRoutePage,
  labTypes,
  legalSlugs,
  routePageKeys,
  trustTopics,
} from "../../routes";
import type { DocumentRef, LabType, LegalSlug, TrustTopic } from "../../routes";
import { labMaturities } from "../types";
import type {
  CaseStudySummary,
  CtaIntent,
  CtaView,
  EngagementBasis,
  EvidenceView,
  ImageView,
  InsightSummary,
  LabAssetSummary,
  LabMaturity,
  LegalPageSummary,
  OfferSummary,
  PersonSummary,
  RichText,
  RichTextBlock,
  SeoView,
  SummaryFor,
  TrustTopicSummary,
} from "../types";
import { contactIntents } from "../../routes";
import type {
  Maybe,
  MapContext,
  RawBasicSummary,
  RawBlock,
  RawCaseStudySummary,
  RawCta,
  RawEvidence,
  RawImage,
  RawInsightSummary,
  RawLabAssetSummary,
  RawLegalPageSummary,
  RawOfferSummary,
  RawPersonSummary,
  RawRefTarget,
  RawRichText,
  RawSeo,
  RawTrustTopicSummary,
} from "./raw";

/* ---------- Value cleaning ---------- */

/** Removes `undefined` entries so results satisfy `exactOptionalPropertyTypes`. */
export function clean<T extends object>(value: { [K in keyof T]: T[K] | undefined }): T {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as T;
}

/** A non-blank string, trimmed of nothing (content is preserved as authored), or undefined. */
export function text(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== "" ? value : undefined;
}

export function list<T>(value: Maybe<readonly Maybe<T>[]>): T[] {
  if (!Array.isArray(value)) return [];
  return (value as readonly Maybe<T>[]).filter((entry): entry is T => entry != null);
}

export function strings(value: Maybe<readonly Maybe<string>[]>): string[] {
  return list(value).flatMap((entry) => text(entry) ?? []);
}

export function isHttps(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

/** First `n` characters of a date or date-time (YYYY-MM-DD). */
export const datePart = (value: string): string => value.slice(0, 10);

export function oneOf<const T extends readonly string[]>(
  options: T,
  value: unknown,
): T[number] | undefined {
  return typeof value === "string" && (options as readonly string[]).includes(value)
    ? value
    : undefined;
}

/** Drops the `drafts.` prefix of a draft document id so ids are stable across perspectives. */
export const stableId = (id: Maybe<string>): string | undefined => {
  const value = text(id);
  return value === undefined ? undefined : value.replace(/^drafts\./, "");
};

export function dedupeById<T extends { id: string }>(items: readonly T[]): T[] {
  const seen = new Set<string>();
  return items.filter((item) => (seen.has(item.id) ? false : (seen.add(item.id), true)));
}

/** Maps, drops undefined results and de-duplicates by id (weak relations are read both ways). */
export function mapSummaries<R, V extends { id: string }>(
  raw: Maybe<readonly Maybe<R>[]>,
  map: (entry: R, ctx: MapContext) => V | undefined,
  ctx: MapContext,
): V[] {
  return dedupeById(list(raw).flatMap((entry) => map(entry, ctx) ?? []));
}

/* ---------- Public-safety checks ---------- */

/** Editorial status allowed for this read (published reads: approved only; never archived). */
export function isPublicStatus(status: Maybe<string>, ctx: MapContext): boolean {
  return typeof status === "string" && status !== "archived" && ctx.statuses.includes(status);
}

/** Evidence the website may use: explicitly public. Controlled or unclassified never is. */
export const isPublicEvidence = (evidence: Maybe<RawEvidence>): boolean =>
  evidence?.classification === "public";

export const isVerifiedPublicEvidence = (evidence: Maybe<RawEvidence>): boolean =>
  isPublicEvidence(evidence) && evidence?.evidenceStatus === "verified";

/* ---------- Images, SEO, evidence ---------- */

/** Approved-rights images only, with alternative text unless decorative. */
export function mapImage(raw: Maybe<RawImage>): ImageView | undefined {
  if (!raw || raw.rightsStatus !== "approved") return undefined;
  const url = text(raw.url);
  const { width, height } = raw;
  if (url === undefined || !isHttps(url)) return undefined;
  if (typeof width !== "number" || typeof height !== "number" || width <= 0 || height <= 0) {
    return undefined;
  }
  const decorative = raw.decorative === true;
  const alt = text(raw.alt);
  if (!decorative && alt === undefined) return undefined;
  return clean<ImageView>({
    url,
    alt: decorative ? "" : (alt ?? ""),
    decorative: decorative ? true : undefined,
    width,
    height,
    credit: text(raw.credit),
  });
}

export function mapSeo(raw: Maybe<RawSeo>): SeoView {
  return clean<SeoView>({
    title: text(raw?.title),
    description: text(raw?.description),
    noindex: raw?.noindex === true ? true : undefined,
    ogImage: mapImage(raw?.ogImage),
  });
}

export function mapEvidence(raw: Maybe<RawEvidence>): EvidenceView {
  const status = oneOf(["verified", "pending", "n/a"] as const, raw?.evidenceStatus) ?? "pending";
  return clean<EvidenceView>({
    status,
    verifiedAt: status === "verified" ? text(raw?.verifiedAt) : undefined,
  });
}

/* ---------- Links ---------- */

const evidenceKinds = new Set(["caseStudy", "labAsset", "trustItem"]);

/** Public URL of a referenced document, or undefined when it may not be linked. */
export function hrefForTarget(target: Maybe<RawRefTarget>, ctx: MapContext): string | undefined {
  if (!target || !isPublicStatus(target.editorialStatus, ctx)) return undefined;
  const kind = target._type;
  if (typeof kind !== "string") return undefined;
  if (evidenceKinds.has(kind) && target.classification !== "public") return undefined;
  const slug = text(target.slug);
  const ref = ((): DocumentRef | undefined => {
    switch (kind) {
      case "practice":
      case "solution":
      case "offer":
      case "industry":
      case "caseStudy":
      case "insight":
      case "person":
      case "job":
        return slug === undefined ? undefined : { kind, slug };
      case "labAsset": {
        const labType = oneOf(labTypes, target.labType);
        return slug === undefined || labType === undefined ? undefined : { kind, labType, slug };
      }
      case "trustItem": {
        const topic = oneOf(trustTopics, target.topic);
        return topic === undefined ? undefined : { kind, slug: topic };
      }
      case "legalPage": {
        const legal = oneOf(legalSlugs, slug);
        return legal === undefined ? undefined : { kind, slug: legal };
      }
      default:
        return undefined;
    }
  })();
  return ref === undefined ? undefined : hrefForDocument(ref);
}

const ctaIntentList = [...contactIntents, "explore", "read", "download"] as const;

/** A CTA with a label and a resolvable destination (route key or public document). */
export function mapCta(raw: Maybe<RawCta>, ctx: MapContext): CtaView | undefined {
  if (!raw) return undefined;
  const label = text(raw.label);
  if (label === undefined) return undefined;
  const routeKey = oneOf(routePageKeys, raw.routeKey);
  const href = routeKey !== undefined ? hrefForRoutePage(routeKey) : hrefForTarget(raw.target, ctx);
  if (href === undefined) return undefined;
  const intent: CtaIntent | undefined = oneOf(ctaIntentList, raw.intent);
  return clean<CtaView>({ label, href, intent });
}

/* ---------- Rich text ---------- */

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function mapBlock(block: RawBlock, ctx: MapContext): RichTextBlock | undefined {
  const key = text(block._key);
  const keyed = key === undefined ? {} : { _key: key };
  switch (block._type) {
    case "block": {
      const defs = list(block.markDefs as Maybe<readonly Maybe<Record<string, unknown>>[]>);
      const resolved = new Map<string, Record<string, unknown>>();
      for (const def of defs) {
        const defKey = text(def._key);
        if (defKey === undefined) continue;
        if (def._type === "link" && isHttps(def.href)) {
          resolved.set(defKey, { _type: "link", _key: defKey, href: def.href });
        } else if (def._type === "internalLink") {
          const href = hrefForTarget(def.target as Maybe<RawRefTarget>, ctx);
          if (href !== undefined) {
            resolved.set(defKey, { _type: "link", _key: defKey, href, internal: true });
          }
        }
      }
      const decorators = new Set(["strong", "em", "code"]);
      const children = list(block.children as Maybe<readonly Maybe<Record<string, unknown>>[]>).map(
        (child) => ({
          ...child,
          marks: list(child.marks as Maybe<readonly Maybe<string>[]>).filter(
            (mark) => decorators.has(mark) || resolved.has(mark),
          ),
        }),
      );
      const rest: Record<string, unknown> = { ...block };
      delete rest._key;
      return {
        ...rest,
        ...keyed,
        _type: "block",
        children,
        markDefs: [...resolved.values()],
      };
    }
    case "figure": {
      const image = mapImage(block.image as Maybe<RawImage>);
      if (image === undefined) return undefined;
      const kind = block.kind === "diagram" ? "diagram" : "image";
      const textAlternative = text(block.textAlternative);
      if (kind === "diagram" && textAlternative === undefined) return undefined;
      return clean<RichTextBlock>({
        _type: "figure",
        ...keyed,
        kind,
        image,
        caption: text(block.caption),
        textAlternative,
      });
    }
    case "callout": {
      const body = text(block.body);
      if (body === undefined) return undefined;
      return clean<RichTextBlock>({
        _type: "callout",
        ...keyed,
        tone: text(block.tone) ?? "note",
        title: text(block.title),
        body,
      });
    }
    case "pullQuote": {
      const quote = text(block.quote);
      const attribution = text(block.attribution);
      if (quote === undefined || attribution === undefined) return undefined;
      return clean<RichTextBlock>({
        _type: "pullQuote",
        ...keyed,
        quote,
        attribution,
        role: text(block.role),
      });
    }
    case "codeBlock": {
      const code = text(block.code);
      if (code === undefined) return undefined;
      return clean<RichTextBlock>({
        _type: "codeBlock",
        ...keyed,
        language: text(block.language) ?? "text",
        filename: text(block.filename),
        code,
      });
    }
    case "dataTable": {
      const caption = text(block.caption);
      const columns = strings(block.columns as Maybe<readonly Maybe<string>[]>);
      const rows = list(block.rows as Maybe<readonly Maybe<Record<string, unknown>>[]>).map((row) =>
        list(row.cells as Maybe<readonly Maybe<string>[]>).map((cell) =>
          typeof cell === "string" ? cell : "",
        ),
      );
      if (caption === undefined || columns.length < 2) return undefined;
      if (rows.length === 0 || rows.some((cells) => cells.length !== columns.length)) {
        return undefined;
      }
      return { _type: "dataTable", ...keyed, caption, columns, rows };
    }
    default:
      return undefined;
  }
}

/** Portable text restricted to the approved block set; never throws on malformed input. */
export function mapRichText(raw: RawRichText, ctx: MapContext): RichText {
  return list(raw).flatMap((block) => (isRecord(block) ? (mapBlock(block, ctx) ?? []) : []));
}

/** Rich text, or undefined when there is nothing to show. */
export function mapOptionalRichText(raw: RawRichText, ctx: MapContext): RichText | undefined {
  const blocks = mapRichText(raw, ctx);
  return blocks.length > 0 ? blocks : undefined;
}

/* ---------- Summaries ---------- */

interface Identified {
  id: string;
  slug: string;
  title: string;
  summary?: string;
}

/** Identity of a public routable document: id, slug, title and an allowed status. */
function identify(
  raw: Maybe<{
    id?: Maybe<string>;
    editorialStatus?: Maybe<string>;
    slug?: Maybe<string>;
    title?: Maybe<string>;
    summary?: Maybe<string>;
  }>,
  ctx: MapContext,
): Identified | undefined {
  if (!raw || !isPublicStatus(raw.editorialStatus, ctx)) return undefined;
  const id = stableId(raw.id);
  const slug = text(raw.slug);
  const title = text(raw.title);
  if (id === undefined || slug === undefined || title === undefined) return undefined;
  return clean<Identified>({ id, slug, title, summary: text(raw.summary) });
}

export const identifyDocument = identify;

export function mapBasicSummary(
  raw: Maybe<RawBasicSummary>,
  ctx: MapContext,
): SummaryFor<"practice"> | undefined {
  return identify(raw, ctx);
}

export function mapOfferSummary(
  raw: Maybe<RawOfferSummary>,
  ctx: MapContext,
): OfferSummary | undefined {
  const base = identify(raw, ctx);
  if (!base) return undefined;
  return clean<OfferSummary>({ ...base, durationCategory: text(raw?.durationCategory) });
}

export const engagementBases = ["contracted-by-vitalos", "prior-team-experience"] as const;

/** True when a named client may be shown: named, permission verified and a name present. */
export function isNamedClientPermitted(raw: {
  clientDisplay?: Maybe<string>;
  namedPermitted?: Maybe<boolean>;
  clientName?: Maybe<string>;
}): boolean {
  return (
    raw.clientDisplay === "named" &&
    raw.namedPermitted === true &&
    text(raw.clientName) !== undefined
  );
}

export function mapCaseStudySummary(
  raw: Maybe<RawCaseStudySummary>,
  ctx: MapContext,
): CaseStudySummary | undefined {
  const base = identify(raw, ctx);
  if (!base || !raw || !isPublicEvidence(raw.evidence)) return undefined;
  const engagementBasis: EngagementBasis | undefined = oneOf(engagementBases, raw.engagementBasis);
  if (engagementBasis === undefined) return undefined;
  const clientLabel = isNamedClientPermitted(raw)
    ? text(raw.clientName)
    : text(raw.anonymisedDescriptor);
  return clean<CaseStudySummary>({ ...base, engagementBasis, clientLabel });
}

export function mapPersonSummary(
  raw: Maybe<RawPersonSummary>,
  ctx: MapContext,
): PersonSummary | undefined {
  const base = identify(raw, ctx);
  if (!base) return undefined;
  return clean<PersonSummary>({
    ...base,
    role: text(raw?.role),
    portrait: mapImage(raw?.portrait),
  });
}

export function mapInsightSummary(
  raw: Maybe<RawInsightSummary>,
  ctx: MapContext,
): InsightSummary | undefined {
  const base = identify(raw, ctx);
  const format = text(raw?.format);
  const publishedAt = text(raw?.publishedAt);
  if (!base || format === undefined || publishedAt === undefined) return undefined;
  const authors = mapSummaries(raw?.authors, mapPersonSummary, ctx);
  if (authors.length === 0) return undefined;
  return { ...base, format, publishedAt, authors };
}

/** A lab asset may only claim `production-product` with verified support evidence. */
export function isLabPublic(raw: {
  evidence?: Maybe<RawEvidence>;
  maturity?: Maybe<string>;
  supportVerified?: Maybe<boolean>;
}): boolean {
  return (
    isPublicEvidence(raw.evidence) &&
    (raw.maturity !== "production-product" || raw.supportVerified === true)
  );
}

export function mapLabAssetSummary(
  raw: Maybe<RawLabAssetSummary>,
  ctx: MapContext,
): LabAssetSummary | undefined {
  const base = identify(raw, ctx);
  if (!base || !raw || !isLabPublic(raw)) return undefined;
  const labType: LabType | undefined = oneOf(labTypes, raw.labType);
  const maturity: LabMaturity | undefined = oneOf(labMaturities, raw.maturity);
  if (labType === undefined || maturity === undefined) return undefined;
  return { ...base, labType, maturity };
}

export function mapTrustTopicSummary(
  raw: Maybe<RawTrustTopicSummary>,
  ctx: MapContext,
): TrustTopicSummary | undefined {
  if (!raw || !isPublicStatus(raw.editorialStatus, ctx) || !isPublicEvidence(raw.evidence)) {
    return undefined;
  }
  const id = stableId(raw.id);
  const topic: TrustTopic | undefined = oneOf(trustTopics, raw.topic);
  const title = text(raw.title);
  if (id === undefined || topic === undefined || title === undefined) return undefined;
  return clean<TrustTopicSummary>({ id, topic, title, summary: text(raw.summary) });
}

export function mapLegalPageSummary(
  raw: Maybe<RawLegalPageSummary>,
  ctx: MapContext,
): LegalPageSummary | undefined {
  const base = identify(raw, ctx);
  if (!base) return undefined;
  const slug: LegalSlug | undefined = oneOf(legalSlugs, base.slug);
  return slug === undefined ? undefined : { id: base.id, slug, title: base.title };
}
