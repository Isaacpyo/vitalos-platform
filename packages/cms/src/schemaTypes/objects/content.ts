/**
 * Rich text, its approved block set, and the proof objects (stat, outcomeMetric, testimonial, hero).
 * Editors get no raw HTML, CSS or layout controls (Stage 10 §9 "CMS guardrails"; Stage 0 §39).
 */
import { defineArrayMember, defineField, defineType } from "sanity";
import { calloutTones, codeLanguageList, permissionStatuses } from "../constants";
import {
  dataTableIssues,
  figureIssues,
  outcomeMetricIssues,
  pullQuoteIssues,
  statIssues,
  testimonialIssues,
} from "../rules/objects";
import { errors } from "../rules/wire";
import { listOptions, referenceTo, routableTypes } from "../shared";

export const callout = defineType({
  name: "callout",
  title: "Callout",
  type: "object",
  fields: [
    defineField({
      name: "tone",
      title: "Tone",
      type: "string",
      options: listOptions(
        calloutTones.map((value) => ({ title: value, value })),
        "radio",
      ),
      initialValue: "note",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "title",
      title: "Title",
      type: "string",
      validation: (rule) => rule.max(80),
    }),
    defineField({
      name: "body",
      title: "Body",
      type: "text",
      rows: 4,
      validation: (rule) => rule.required().max(600),
    }),
  ],
  preview: { select: { title: "title", subtitle: "body" } },
});

export const pullQuote = defineType({
  name: "pullQuote",
  title: "Pull quote",
  type: "object",
  fields: [
    defineField({
      name: "quote",
      title: "Quote",
      type: "text",
      rows: 3,
      validation: (rule) => rule.required().max(400),
    }),
    defineField({
      name: "attribution",
      title: "Attribution",
      type: "string",
      description: "Required. Anonymous quotes are not published.",
    }),
    defineField({ name: "role", title: "Role or organisation", type: "string" }),
  ],
  validation: (rule) => errors<unknown>((value) => pullQuoteIssues(value))(rule) as typeof rule,
  preview: { select: { title: "quote", subtitle: "attribution" } },
});

export const figure = defineType({
  name: "figure",
  title: "Figure",
  type: "object",
  fields: [
    defineField({
      name: "kind",
      title: "Kind",
      type: "string",
      options: listOptions(
        [
          { title: "Image", value: "image" },
          { title: "Diagram", value: "diagram" },
        ],
        "radio",
      ),
      initialValue: "image",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "image",
      title: "Image",
      type: "approvedImage",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "caption",
      title: "Caption",
      type: "string",
      validation: (rule) => rule.max(240),
    }),
    defineField({
      name: "textAlternative",
      title: "Text alternative",
      type: "text",
      rows: 4,
      description:
        "Required for diagrams: a full description of what the diagram shows, so the information is available without seeing it.",
    }),
  ],
  validation: (rule) => errors<unknown>((value) => figureIssues(value))(rule) as typeof rule,
  preview: { select: { title: "caption", subtitle: "kind", media: "image" } },
});

export const codeBlock = defineType({
  name: "codeBlock",
  title: "Code block",
  type: "object",
  fields: [
    defineField({
      name: "language",
      title: "Language",
      type: "string",
      options: listOptions(codeLanguageList),
      initialValue: "text",
      validation: (rule) => rule.required(),
    }),
    defineField({ name: "filename", title: "Filename", type: "string" }),
    defineField({
      name: "code",
      title: "Code",
      type: "text",
      rows: 10,
      validation: (rule) => rule.required(),
    }),
  ],
  preview: { select: { title: "filename", subtitle: "language" } },
});

export const dataTable = defineType({
  name: "dataTable",
  title: "Data table",
  type: "object",
  fields: [
    defineField({
      name: "caption",
      title: "Caption",
      type: "string",
      description: "Required so the table has an accessible name.",
      validation: (rule) => rule.required().max(160),
    }),
    defineField({
      name: "columns",
      title: "Column headings",
      type: "array",
      of: [{ type: "string", validation: (rule) => rule.required() }],
      validation: (rule) => rule.required().min(2).max(8),
    }),
    defineField({
      name: "rows",
      title: "Rows",
      type: "array",
      of: [
        defineArrayMember({
          type: "object",
          name: "tableRow",
          fields: [
            defineField({
              name: "cells",
              title: "Cells",
              type: "array",
              of: [{ type: "string" }],
            }),
          ],
          preview: { select: { title: "cells.0", subtitle: "cells.1" } },
        }),
      ],
      validation: (rule) => rule.required().min(1),
    }),
  ],
  validation: (rule) => errors<unknown>((value) => dataTableIssues(value))(rule) as typeof rule,
  preview: { select: { title: "caption" } },
});

/** The approved block set. Anything not listed here cannot be inserted by editors. */
export const richText = defineType({
  name: "richText",
  title: "Rich text",
  type: "array",
  of: [
    defineArrayMember({
      type: "block",
      styles: [
        { title: "Normal", value: "normal" },
        { title: "Heading 2", value: "h2" },
        { title: "Heading 3", value: "h3" },
        { title: "Heading 4", value: "h4" },
      ],
      lists: [
        { title: "Bullet", value: "bullet" },
        { title: "Numbered", value: "number" },
      ],
      marks: {
        decorators: [
          { title: "Strong", value: "strong" },
          { title: "Emphasis", value: "em" },
          { title: "Code", value: "code" },
        ],
        annotations: [
          defineArrayMember({
            name: "link",
            title: "External link (https only)",
            type: "object",
            fields: [
              defineField({
                name: "href",
                title: "URL",
                type: "url",
                validation: (rule) => rule.required().uri({ scheme: ["https"] }),
              }),
            ],
          }),
          defineArrayMember({
            name: "internalLink",
            title: "Link to a page",
            type: "object",
            fields: [
              defineField({
                name: "reference",
                title: "Document",
                type: "reference",
                to: referenceTo(...routableTypes),
                validation: (rule) => rule.required(),
              }),
            ],
          }),
        ],
      },
    }),
    defineArrayMember({ type: "callout" }),
    defineArrayMember({ type: "pullQuote" }),
    defineArrayMember({ type: "figure" }),
    defineArrayMember({ type: "codeBlock" }),
    defineArrayMember({ type: "dataTable" }),
  ],
});

export const stat = defineType({
  name: "stat",
  title: "Statistic",
  type: "object",
  description:
    "Every number needs a descriptor, a source and evidence status (no unsourced numbers).",
  fields: [
    defineField({
      name: "value",
      title: "Value",
      type: "string",
      validation: (rule) => rule.max(24),
    }),
    defineField({
      name: "descriptor",
      title: "Descriptor",
      type: "string",
      description: "What the value measures.",
      validation: (rule) => rule.max(160),
    }),
    defineField({
      name: "source",
      title: "Source",
      type: "string",
      description: "Where the number comes from, so it can be re-checked.",
      validation: (rule) => rule.max(240),
    }),
    defineField({
      name: "evidence",
      title: "Evidence",
      type: "evidence",
      validation: (rule) => rule.required(),
    }),
  ],
  validation: (rule) => errors<unknown>((value) => statIssues(value))(rule) as typeof rule,
  preview: { select: { title: "value", subtitle: "descriptor" } },
});

export const outcomeMetric = defineType({
  name: "outcomeMetric",
  title: "Outcome metric",
  type: "object",
  description:
    "A measured outcome with its source and context (Stage 10 §17: metrics need source/context).",
  fields: [
    defineField({
      name: "value",
      title: "Value",
      type: "string",
      validation: (rule) => rule.max(24),
    }),
    defineField({
      name: "descriptor",
      title: "Descriptor",
      type: "string",
      validation: (rule) => rule.max(160),
    }),
    defineField({
      name: "source",
      title: "Source",
      type: "string",
      validation: (rule) => rule.max(240),
    }),
    defineField({
      name: "context",
      title: "Context",
      type: "text",
      rows: 2,
      description: "Baseline, scope and how it was measured.",
      validation: (rule) => rule.max(400),
    }),
    defineField({ name: "timeframe", title: "Timeframe", type: "string" }),
    defineField({
      name: "evidence",
      title: "Evidence",
      type: "evidence",
      validation: (rule) => rule.required(),
    }),
  ],
  validation: (rule) => errors<unknown>((value) => outcomeMetricIssues(value))(rule) as typeof rule,
  preview: { select: { title: "value", subtitle: "descriptor" } },
});

export const testimonial = defineType({
  name: "testimonial",
  title: "Testimonial",
  type: "object",
  description: "Published only when the person has given permission.",
  fields: [
    defineField({
      name: "quote",
      title: "Quote",
      type: "text",
      rows: 4,
      validation: (rule) => rule.required().max(600),
    }),
    defineField({ name: "attribution", title: "Attribution (name)", type: "string" }),
    defineField({ name: "role", title: "Role and organisation", type: "string" }),
    defineField({
      name: "permissionStatus",
      title: "Permission",
      type: "string",
      options: listOptions(
        permissionStatuses.map((value) => ({ title: value, value })),
        "radio",
      ),
      initialValue: "pending",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "permissionEvidence",
      title: "Permission evidence",
      type: "evidence",
      description: "Internal pointer to the recorded permission.",
    }),
  ],
  validation: (rule) => errors<unknown>((value) => testimonialIssues(value))(rule) as typeof rule,
  preview: { select: { title: "attribution", subtitle: "quote" } },
});

export const hero = defineType({
  name: "hero",
  title: "Hero",
  type: "object",
  description:
    "Optional supporting elements for a page hero. The headline is the document title; the homepage hero copy is locked in code.",
  fields: [
    defineField({
      name: "eyebrow",
      title: "Eyebrow",
      type: "string",
      validation: (rule) => rule.max(60),
    }),
    defineField({ name: "image", title: "Image", type: "approvedImage" }),
    defineField({ name: "primaryCta", title: "Primary call to action", type: "cta" }),
  ],
});
