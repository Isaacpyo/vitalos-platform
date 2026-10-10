/**
 * Pieces every content document shares: preview, slug-change warning, trailing governance fields.
 */
import { slugChangeIssues } from "../rules/slug-change";
import { clientFrom } from "../rules/unique";
import { warnings, type RuleLike } from "../rules/wire";
import { governanceField, localeField, seoField } from "../shared";

/** Warns when publishing would change an already-published URL. The publish action creates the redirect. */
export const slugChangeCheck = warnings<unknown>((doc, context) =>
  context.document ? slugChangeIssues(doc, context.document._id, clientFrom(context)) : [],
);

/** Combine document-level rule builders into the `validation` callback of a document type. */
export const documentRules =
  (...builders: ((rule: RuleLike) => RuleLike)[]) =>
  <R extends RuleLike>(rule: R): R[] =>
    builders.map((build) => build(rule) as R);

/** SEO, governance and locale: the closing fields of every content document. */
export const closingFields = [seoField, governanceField, localeField] as const;

export const statusPreview = {
  select: { title: "title", subtitle: "governance.editorialStatus" },
} as const;
