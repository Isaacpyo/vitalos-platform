// Repo-file content for the public site (ADR-028). Entry: `@vitalos/cms/repo`.
//
// The approved subset of the drafted editorial content (ADR-025) served as the site's content, with
// no draft ribbon and allowed in production. It differs from the draft source in four ways:
//   1. invented placeholder documents (people, insights, case studies, roles) are dropped, so the
//      publication gates keep Leadership, Insights, Work and Careers closed;
//   2. legal pages are only those in `./legal.ts` (the draft skeletons are never served);
//   3. site settings carry the owner-published company facts (`./settings.ts`);
//   4. any rich-text block that still holds a bracketed placeholder is dropped (`dropPlaceholders`).
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

/** The repo content set, built once. */
export const repoContent: FixtureSet = buildRepoSet();

/** The repo `ContentSource`. Allowed in production. Placeholder case studies never count. */
export function createRepoContentSource(options: FixtureContentSourceOptions = {}): ContentSource {
  return createFixtureSource(repoContent, options);
}
