// Repo-file content for the public site (ADR-028). Entry: `@vitalos/cms/repo`.
//
// The approved subset of the drafted editorial content (ADR-025) served as the site's content, with
// no draft ribbon and allowed in production. It differs from the draft source in four ways:
//   1. invented placeholder documents (people, insights, case studies, roles) are dropped, so the
//      publication gates keep Leadership, Insights, Work and Careers closed;
//   2. legal pages are only those in `./legal.ts` (the draft skeletons are never served);
//   3. site settings carry the owner-published company facts (`./settings.ts`);
//   4. any rich-text block that still holds a bracketed placeholder is dropped (`dropPlaceholders`);
//   5. unpublished documents (`publishStatus` draft or approved) and every reference to them are
//      dropped in production; previews and local builds keep them, unindexed, for review
//      (Website Build Pack, 25 Oct 2026).
import { createFixtureSource } from "../content/fixture-source";
import type { FixtureContentSourceOptions, FixtureSet } from "../content/fixture-source";
import type { ContentSource } from "../content/source";
import type { RichText } from "../content/types";
import { routePageDrafts } from "../draft/content/pages";
import { draftContent } from "../draft/index";
import { approvedLegalPages } from "./legal";
import { repoSettingsFacts } from "./settings";

export { approvedLegalPages, PRIVACY_NOTICE_VERSION } from "./legal";
export { repoSettingsFacts } from "./settings";
export { structuralSeo } from "./seo";

// The inner class excludes "[" too, so matching stays linear on text with many unclosed brackets.
const BRACKETED = /\[[^[\]]+\]/;

const blockText = (block: RichText[number]): string =>
  (block.children as readonly { text?: unknown }[] | undefined)
    ?.map((child) => (typeof child.text === "string" ? child.text : ""))
    .join("") ?? "";

/**
 * Drops blocks that contain a bracketed placeholder, then any heading left with no content under
 * it. Nothing is substituted: an unconfirmed fact is omitted.
 */
export function dropPlaceholders(body: RichText): RichText {
  const kept = body.filter((block) => !BRACKETED.test(blockText(block)));
  const isHeading = (block: RichText[number]) => /^h\d$/.test(String(block.style));
  return kept.filter((block, index) => {
    if (!isHeading(block)) return true;
    const next = kept[index + 1];
    return next !== undefined && !isHeading(next);
  });
}

function buildRepoSet(): FixtureSet {
  const draft = draftContent.set;
  const withoutPlaceholders = <T extends { placeholder?: true }>(list: readonly T[]): T[] =>
    list.filter((doc) => doc.placeholder !== true);

  // Route pages the draft set forced noindex only because placeholders were their sole content
  // go back to their authored SEO; their sections stay closed through the publication gates.
  const routePages: FixtureSet["routePages"] = { ...draft.routePages };
  for (const key of draftContent.placeholderNoindexRoutes) {
    const original = routePageDrafts[key];
    if (original) (routePages as Record<string, unknown>)[key] = original.view;
  }

  const trustItems = draft.documents.trustItem.map((item) =>
    item.publicSummary ? { ...item, publicSummary: dropPlaceholders(item.publicSummary) } : item,
  );

  return {
    ...draft,
    name: "repo",
    settings: { ...draft.settings, ...repoSettingsFacts },
    routePages,
    documents: {
      ...draft.documents,
      practice: withoutPlaceholders(draft.documents.practice),
      solution: withoutPlaceholders(draft.documents.solution),
      offer: withoutPlaceholders(draft.documents.offer),
      industry: withoutPlaceholders(draft.documents.industry),
      caseStudy: withoutPlaceholders(draft.documents.caseStudy),
      insight: withoutPlaceholders(draft.documents.insight),
      person: withoutPlaceholders(draft.documents.person),
      labAsset: withoutPlaceholders(draft.documents.labAsset),
      job: withoutPlaceholders(draft.documents.job),
      trustItem: trustItems,
      legalPage: [...approvedLegalPages],
    },
  };
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** An object marked draft or approved (see `PublishStatus`): not served in production. */
const unpublished = (value: unknown): boolean =>
  isObject(value) && (value["publishStatus"] === "draft" || value["publishStatus"] === "approved");

/**
 * A copy of `value` without anything unpublished: list members and object fields whose
 * `publishStatus` is draft or approved are removed, at any depth. A published document therefore
 * never links to, lists or counts a draft (an offer card, a case study row, a page section).
 */
export function withoutUnpublished<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.filter((item) => !unpublished(item)).map(withoutUnpublished) as T;
  }
  if (!isObject(value)) return value;
  const out: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    if (!unpublished(item)) out[key] = withoutUnpublished(item);
  }
  return out as T;
}

/**
 * Unpublished documents stay out of search engines even on a preview (previews are never indexed,
 * this is the second line).
 */
function noindexUnpublished(set: FixtureSet): FixtureSet {
  const documents = Object.fromEntries(
    Object.entries(set.documents).map(([kind, list]) => [
      kind,
      (list as unknown as readonly Record<string, unknown>[]).map((doc) =>
        unpublished(doc) && isObject(doc["seo"])
          ? { ...doc, seo: { ...doc["seo"], noindex: true } }
          : doc,
      ),
    ]),
  ) as unknown as FixtureSet["documents"];
  return { ...set, documents };
}

const fullRepoSet = buildRepoSet();

/** The repo content set as production serves it: published documents only. Built once. */
export const repoContent: FixtureSet = withoutUnpublished(fullRepoSet);

/** The repo content set for previews and local builds: drafts included, unindexed. Built once. */
export const repoPreviewContent: FixtureSet = noindexUnpublished(fullRepoSet);

export interface RepoContentSourceOptions extends FixtureContentSourceOptions {
  /**
   * Serve draft and approved documents too (previews and local builds). Never in production: the
   * content-source factory sets it from the deploy environment.
   */
  includeUnpublished?: boolean;
}

/** The repo `ContentSource`. Allowed in production. Placeholder case studies never count. */
export function createRepoContentSource(options: RepoContentSourceOptions = {}): ContentSource {
  const { includeUnpublished, ...rest } = options;
  return includeUnpublished === true
    ? createFixtureSource(repoPreviewContent, { ...rest, countUnpublishedCaseStudies: true })
    : createFixtureSource(repoContent, rest);
}
