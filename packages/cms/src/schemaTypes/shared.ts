/**
 * Field and option helpers shared by the schema types.
 */
import { defineField } from "sanity";
import { defaultLocale, type ListEntry } from "./constants";
import { hasText, hyphenate, issue, todayIso } from "./rules/issue";
import { slugIssues } from "./rules/documents";
import { errors } from "./rules/wire";
import { isValidSlug } from "../routes";

/** Select options. `radio` keeps short lists visible. */
export const listOptions = (
  entries: readonly ListEntry[],
  layout: "dropdown" | "radio" = "dropdown",
) => ({
  list: entries.map((entry) => ({ ...entry })),
  layout,
});

/** Document types an editor may link to from rich text, CTAs and relations (everything with a public route). */
export const routableTypes = [
  "practice",
  "solution",
  "offer",
  "industry",
  "caseStudy",
  "insight",
  "person",
  "labAsset",
  "trustItem",
  "legalPage",
  "job",
] as const;

export const referenceTo = (...types: readonly string[]) => types.map((type) => ({ type }));

/** Hidden, read-only locale (en-GB) so a future locale layer does not need a migration. */
export const localeField = defineField({
  name: "locale",
  title: "Locale",
  type: "string",
  hidden: true,
  readOnly: true,
  initialValue: defaultLocale,
  validation: (rule) =>
    errors<unknown>((value) =>
      value === undefined || value === defaultLocale
        ? []
        : [issue(`Only ${defaultLocale} content is supported.`)],
    )(rule) as typeof rule,
});

export const seoField = defineField({
  name: "seo",
  title: "SEO",
  type: "seo",
  description: "Leave blank to use the title and summary. Set only to override.",
});

export const governanceField = defineField({
  name: "governance",
  title: "Editorial governance",
  type: "governance",
  validation: (rule) => rule.required(),
});

/** Title with a sensible maximum. */
export const titleField = defineField({
  name: "title",
  title: "Title",
  type: "string",
  validation: (rule) => rule.required().max(120),
});

export const summaryField = defineField({
  name: "summary",
  title: "Summary",
  type: "text",
  rows: 3,
  description: "One or two plain sentences. Used on cards and as the default meta description.",
  validation: (rule) => rule.max(320),
});

/** Routable slug. Uniqueness within the type is Sanity's default `isUnique`. */
export const slugField = (source = "title") =>
  defineField({
    name: "slug",
    title: "Slug",
    type: "slug",
    options: { source, maxLength: 80, slugify: (input: string) => slugify(input) },
    validation: (rule) => [rule.required(), errors(slugIssues)(rule) as typeof rule],
  });

export function slugify(input: string): string {
  // Linear-time: capped input, no backtracking regular expressions.
  let slug = hyphenate(input.slice(0, 2048).replaceAll("&", " and "), { lower: true }).slice(0, 80);
  while (slug.endsWith("-")) slug = slug.slice(0, -1);
  return isValidSlug(slug) ? slug : "";
}

/** Plain string list (problems, outputs, ...) with non-empty items. */
export const stringList = (options: {
  name: string;
  title: string;
  description?: string;
  min?: number;
  max?: number;
}) =>
  defineField({
    name: options.name,
    title: options.title,
    type: "array",
    ...(options.description ? { description: options.description } : {}),
    of: [{ type: "string", validation: (rule) => rule.required().max(300) }],
    validation: (rule) => {
      let next = rule;
      if (options.min !== undefined) next = next.min(options.min);
      if (options.max !== undefined) next = next.max(options.max);
      return next;
    },
  });

export const refList = (options: {
  name: string;
  title: string;
  to: readonly string[];
  weak?: boolean;
  min?: number;
  max?: number;
  description?: string;
}) =>
  defineField({
    name: options.name,
    title: options.title,
    type: "array",
    ...(options.description ? { description: options.description } : {}),
    of: [
      {
        type: "reference",
        to: referenceTo(...options.to),
        ...(options.weak ? { weak: true } : {}),
      },
    ],
    validation: (rule) => {
      let next = rule.unique();
      if (options.min !== undefined) next = next.min(options.min);
      if (options.max !== undefined) next = next.max(options.max);
      return next;
    },
  });

export { hasText, todayIso };
