/**
 * Converts the draft content set into Sanity documents for the owner to import later
 * (`tooling/scripts/export-draft-dataset.mjs` writes them as NDJSON; ADR-025).
 *
 * - Every document is exported as a Sanity draft (`_id` prefixed `drafts.`) with
 *   `governance.editorialStatus: "draft"`, so importing publishes nothing; the Studio publish
 *   guard still requires approval first.
 * - References point at published ids and are weak, with `_strengthenOnPublish` on fields that
 *   are strong in the schema, so drafts that reference each other import in any order.
 * - Each document carries `draftProvenance` (stage and section citations). It is not a schema
 *   field: the Studio shows it as an unknown field, to be removed once the owner approves.
 * - Nothing that is empty in the draft set is invented here (no prices, effective dates, owners).
 */
import { hrefForRoutePage, routePageKeys } from "../routes";
import type { CtaView, RichText, SeoView } from "../content/types";
import type { DraftContentSet } from "./set";
import { singletonProvenanceKeys } from "./provenance";
import type { DraftProvenance } from "./provenance";

export type SanityDocument = Record<string, unknown> & { _id: string; _type: string };

/** Placeholder owner: the owner assigns a real one in the Studio. */
export const DRAFT_OWNER_PLACEHOLDER = "[Content owner to be assigned]";
/** Review date set on every exported draft; the owner changes it on approval. */
export const DRAFT_REVIEW_DATE = "2026-11-10";

const governance = {
  _type: "governance",
  owner: DRAFT_OWNER_PLACEHOLDER,
  editorialStatus: "draft",
  reviewDate: DRAFT_REVIEW_DATE,
};

const pendingPublicEvidence = {
  _type: "evidence",
  evidenceStatus: "pending",
  classification: "public",
};

/** Drops undefined values and empty strings so optional fields are absent, not blank. */
function compact<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined && entry !== ""),
  ) as T;
}

const slug = (current: string) => ({ _type: "slug", current });

function seo(view: SeoView | undefined) {
  if (!view) return undefined;
  return compact({
    _type: "seo",
    title: view.title,
    description: view.description,
    noindex: view.noindex,
  });
}

function cta(view: CtaView | undefined) {
  if (!view) return undefined;
  const routeKey = routePageKeys.find((key) => hrefForRoutePage(key) === view.href);
  if (routeKey === undefined) {
    throw new Error(`Draft CTA "${view.label}" does not point at a route page (${view.href}).`);
  }
  return compact({ _type: "cta", label: view.label, intent: view.intent, routeKey });
}

/** Rich text is already Portable Text; empty bodies are omitted. */
const rich = (value: RichText | undefined) =>
  value && value.length > 0 ? value.map((block) => sanityBlock(block)) : undefined;

/**
 * Resolved internal links (`{ _type: "link", internal: true, href: "/legal/privacy" }`) become the
 * schema's `internalLink` mark with a weak reference to the draft document. Only legal-page targets
 * are used by the draft content.
 */
function sanityBlock(block: RichText[number]): Record<string, unknown> {
  const defs = block["markDefs"];
  if (!Array.isArray(defs)) return { ...block };
  const markDefs = (defs as Record<string, unknown>[]).map((def) => {
    if (def["_type"] !== "link" || def["internal"] !== true) return def;
    const legal = /^\/legal\/([a-z-]+)$/.exec(String(def["href"]));
    if (!legal)
      throw new Error(`Unsupported internal link in draft content: ${String(def["href"])}`);
    const id = `legalPage-${legal[1]}`;
    return {
      _type: "internalLink",
      _key: def["_key"],
      reference: {
        _type: "reference",
        _ref: id,
        _weak: true,
        _strengthenOnPublish: { type: "legalPage" },
      },
    };
  });
  return { ...block, markDefs };
}

/**
 * Array `_key`s are hyphenated lowercase slugs ("trust-item-security", "section-problems"): readable,
 * stable, and the only `_key` shape the narrow secret-scanner allowlist accepts (ADR-025).
 */
const keyOf = (value: string): string => value.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

function refs(
  type: string,
  ids: readonly string[],
  strength: "strong" | "weak",
): Record<string, unknown>[] | undefined {
  if (ids.length === 0) return undefined;
  return ids.map((id) =>
    strength === "strong"
      ? {
          _type: "reference",
          _key: keyOf(id),
          _ref: id,
          _weak: true,
          _strengthenOnPublish: { type },
        }
      : { _type: "reference", _key: keyOf(id), _ref: id, _weak: true },
  );
}

const keyed = <T extends Record<string, unknown>>(
  type: string,
  items: readonly T[],
  key: (item: T, index: number) => string,
) =>
  items.length === 0
    ? undefined
    : items.map((item, index) => ({ _type: type, _key: key(item, index), ...item }));

const ids = (items: readonly { id: string }[]) => items.map((item) => item.id);

function doc(
  type: string,
  id: string,
  fields: Record<string, unknown>,
  provenance: DraftProvenance | undefined,
): SanityDocument {
  if (!provenance) throw new Error(`No provenance for draft document ${id}`);
  return compact({
    _id: `drafts.${id}`,
    _type: type,
    ...fields,
    governance,
    locale: "en-GB",
    draftProvenance: {
      status: provenance.status,
      sources: provenance.sources.map((s, i) => ({ _key: `source-${i + 1}`, ...s })),
      omitted: provenance.omitted,
    },
  });
}

/** All draft documents as Sanity documents, in a stable order. */
export function toSanityDocuments(content: DraftContentSet): SanityDocument[] {
  const { set, provenance } = content;
  const docs = set.documents;
  const out: SanityDocument[] = [];

  out.push(
    doc(
      "siteSettings",
      "siteSettings",
      { defaultSeo: seo(set.settings.defaultSeo) },
      provenance[singletonProvenanceKeys.siteSettings],
    ),
  );

  if (set.home) {
    const home = set.home;
    out.push(
      doc(
        "homePage",
        "homePage",
        {
          homeSections: Object.entries(home.headings).map(([sectionKey, visibleHeading]) => ({
            _type: "homeSectionHeading",
            // Hyphenated lowercase slug, like every other _key in the export (.gitleaks.toml).
            _key: `section-${keyOf(sectionKey)}`,
            sectionKey,
            visibleHeading,
          })),
          solutions: refs("solution", ids(home.solutions), "strong"),
          practices: refs("practice", ids(home.practices), "strong"),
          industries: refs("industry", ids(home.industries), "strong"),
          trustHighlights: refs("trustItem", ids(home.trustHighlights), "strong"),
          labs: refs("labAsset", ids(home.labs), "strong"),
          finalCta: cta(home.finalCta),
          seo: seo(home.seo),
        },
        provenance[singletonProvenanceKeys.homePage],
      ),
    );
  }

  for (const key of routePageKeys) {
    const page = set.routePages[key];
    if (!page) continue;
    const contact = key === "contact" ? (page as RoutePageWithContact) : undefined;
    out.push(
      doc(
        "routePage",
        `routePage-${key}`,
        {
          routeKey: key,
          heading: page.heading,
          intro: page.intro,
          body: rich(page.body),
          cta: cta(page.cta),
          expectations: rich(contact?.expectations),
          successMessage: contact?.successMessage,
          routes: contact
            ? keyed(
                "contactRoute",
                contact.routes.map((r) => compact({ ...r })),
                (r) => `route-${String(r["intent"])}`,
              )
            : undefined,
          seo: seo(page.seo),
        },
        provenance[singletonProvenanceKeys.routePage(key)],
      ),
    );
  }

  for (const v of docs.practice) {
    out.push(
      doc(
        "practice",
        v.id,
        {
          title: v.title,
          slug: slug(v.slug),
          summary: v.summary,
          proposition: v.proposition,
          problems: [...v.problems],
          capabilities: [...v.capabilities],
          body: rich(v.body),
          solutions: refs("solution", ids(v.solutions), "strong"),
          industries: refs("industry", ids(v.industries), "strong"),
          cta: cta(v.cta),
          seo: seo(v.seo),
        },
        provenance[v.id],
      ),
    );
  }

  for (const v of docs.solution) {
    out.push(
      doc(
        "solution",
        v.id,
        {
          title: v.title,
          slug: slug(v.slug),
          summary: v.summary,
          problemStatement: v.problemStatement,
          signals: [...v.signals],
          impact: v.impact,
          approach: rich(v.approach),
          phases: keyed(
            "phase",
            v.phases.map((phase) => ({ ...phase })),
            (_, i) => `phase-${i + 1}`,
          ),
          offers: refs("offer", ids(v.offers), "strong"),
          practices: refs("practice", ids(v.practices), "weak"),
          industries: refs("industry", ids(v.industries), "weak"),
          faq: keyed(
            "faqItem",
            v.faq.map((item) => ({ ...item })),
            (_, i) => `faq-${i + 1}`,
          ),
          cta: cta(v.cta),
          seo: seo(v.seo),
        },
        provenance[v.id],
      ),
    );
  }

  for (const v of docs.offer) {
    out.push(
      doc(
        "offer",
        v.id,
        {
          title: v.title,
          slug: slug(v.slug),
          summary: v.summary,
          audience: v.audience,
          trigger: v.trigger,
          scope: v.scope,
          outputs: [...v.outputs],
          requirements: v.requirements.length > 0 ? [...v.requirements] : undefined,
          durationCategory: v.durationCategory,
          exclusions: v.exclusions.length > 0 ? [...v.exclusions] : undefined,
          nextStep: v.nextStep,
          solutions: refs("solution", ids(v.solutions), "weak"),
          practices: refs("practice", ids(v.practices), "weak"),
          cta: cta(v.cta),
          seo: seo(v.seo),
        },
        provenance[v.id],
      ),
    );
  }

  for (const v of docs.industry) {
    out.push(
      doc(
        "industry",
        v.id,
        {
          title: v.title,
          slug: slug(v.slug),
          summary: v.summary,
          realities: [...v.realities],
          problems: [...v.problems],
          aiOpportunities: v.aiOpportunities.length > 0 ? [...v.aiOpportunities] : undefined,
          considerations: v.considerations.length > 0 ? [...v.considerations] : undefined,
          solutions: refs("solution", ids(v.solutions), "strong"),
          offers: refs("offer", ids(v.offers), "strong"),
          cta: cta(v.cta),
          seo: seo(v.seo),
        },
        provenance[v.id],
      ),
    );
  }

  for (const v of docs.labAsset) {
    out.push(
      doc(
        "labAsset",
        v.id,
        {
          title: v.title,
          slug: slug(v.slug),
          summary: v.summary,
          labType: v.labType,
          maturity: v.maturity,
          is: v.is,
          isNot: v.isNot,
          limitations: v.limitations,
          body: rich(v.body),
          maintained: false,
          evidence: pendingPublicEvidence,
          seo: seo(v.seo),
        },
        provenance[v.id],
      ),
    );
  }

  for (const v of docs.trustItem) {
    out.push(
      doc(
        "trustItem",
        v.id,
        {
          title: v.title,
          topic: v.topic,
          summary: v.summary,
          publicSummary: rich(v.publicSummary),
          evidence: pendingPublicEvidence,
          seo: seo(v.seo),
        },
        provenance[v.id],
      ),
    );
  }

  for (const v of docs.legalPage) {
    out.push(
      doc(
        "legalPage",
        v.id,
        {
          title: v.title,
          slug: slug(v.slug),
          version: v.version,
          // effectiveDate is deliberately absent: a draft is not in force.
          effectiveDate: v.effectiveDate,
          body: rich(v.body),
          seo: seo(v.seo),
        },
        provenance[v.id],
      ),
    );
  }

  return out;
}

type RoutePageWithContact = {
  expectations?: RichText;
  successMessage?: string;
  routes: readonly { intent: string; label: string; description?: string }[];
};

/** NDJSON text: one document per line, trailing newline. */
export function toNdjson(documents: readonly SanityDocument[]): string {
  return documents.map((document) => JSON.stringify(document)).join("\n") + "\n";
}
