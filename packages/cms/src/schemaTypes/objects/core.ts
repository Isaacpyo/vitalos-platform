/**
 * Core reusable objects: seo, governance, evidence, cta, approvedImage.
 * Specs: Stage 8 §21-22; Stage 10 §9; Stage 6 §14, §19; Stage 9 §10, §15.
 */
import { defineField, defineType } from "sanity";
import {
  classifications,
  ctaIntents,
  editorialStatusList,
  evidenceStatuses,
  rightsStatuses,
} from "../constants";
import {
  approvedImageIssues,
  ctaIssues,
  ctaWarnings,
  evidenceIssues,
  evidenceWarnings,
  governanceIssues,
} from "../rules/objects";
import { errors, warnings } from "../rules/wire";
import { listOptions, referenceTo, routableTypes } from "../shared";
import { routePageKeys } from "../../routes";

export const seo = defineType({
  name: "seo",
  title: "SEO",
  type: "object",
  fields: [
    defineField({
      name: "title",
      title: "Meta title",
      type: "string",
      description: "Up to 60 characters. Leave blank to use the page title.",
      validation: (rule) => rule.max(60),
    }),
    defineField({
      name: "description",
      title: "Meta description",
      type: "text",
      rows: 3,
      description: "Up to 160 characters. Leave blank to use the summary.",
      validation: (rule) => rule.max(160),
    }),
    defineField({
      name: "noindex",
      title: "Hide from search engines (noindex)",
      type: "boolean",
      initialValue: false,
    }),
    defineField({ name: "ogImage", title: "Social sharing image", type: "approvedImage" }),
  ],
});

export const governance = defineType({
  name: "governance",
  title: "Editorial governance",
  type: "object",
  description: "Every item needs an owner, status and review date (Stage 8 §21).",
  options: { columns: 3 },
  fields: [
    defineField({
      name: "owner",
      title: "Content owner",
      type: "string",
      description: "The accountable person or team.",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "editorialStatus",
      title: "Editorial status",
      type: "string",
      options: listOptions(editorialStatusList),
      initialValue: "draft",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "reviewDate",
      title: "Next review date",
      type: "date",
      validation: (rule) => rule.required(),
    }),
  ],
  validation: (rule) => errors<unknown>((value) => governanceIssues(value))(rule) as typeof rule,
});

export const evidence = defineType({
  name: "evidence",
  title: "Evidence",
  type: "object",
  description:
    "Records whether a claim is evidenced and where the proof is held. This is an internal pointer only: never paste or upload the evidence here (controlled evidence stays outside the public CMS).",
  fields: [
    defineField({
      name: "evidenceStatus",
      title: "Evidence status",
      type: "string",
      options: listOptions(
        evidenceStatuses.map((value) => ({
          title: value === "n/a" ? "Not applicable" : value,
          value,
        })),
        "radio",
      ),
      initialValue: "pending",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "classification",
      title: "Classification",
      type: "string",
      description:
        "Public content may appear on the website. Controlled content is never published.",
      options: listOptions(
        classifications.map((value) => ({ title: value, value })),
        "radio",
      ),
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "evidenceOwner",
      title: "Evidence owner",
      type: "string",
      description: "Who holds and can re-verify the evidence.",
    }),
    defineField({
      name: "evidenceReference",
      title: "Internal evidence reference",
      type: "string",
      description:
        "A short pointer such as a Trust Register ID or data-room path. Never the evidence itself.",
    }),
    defineField({ name: "verifiedAt", title: "Verified on", type: "date" }),
  ],
  validation: (rule) => [
    errors<unknown>((value) => evidenceIssues(value))(rule) as typeof rule,
    warnings<unknown>((value) => evidenceWarnings(value))(rule) as typeof rule,
  ],
});

export const cta = defineType({
  name: "cta",
  title: "Call to action",
  type: "object",
  fields: [
    defineField({
      name: "label",
      title: "Label",
      type: "string",
      description: "Say what happens next. Avoid 'Learn more'.",
      validation: (rule) => rule.required().max(60),
    }),
    defineField({
      name: "intent",
      title: "Intent",
      type: "string",
      options: listOptions(ctaIntents.map((value) => ({ title: value, value }))),
    }),
    defineField({
      name: "internalRef",
      title: "Link to a document",
      type: "reference",
      to: referenceTo(...routableTypes),
    }),
    defineField({
      name: "routeKey",
      title: "Or link to a page",
      type: "string",
      options: listOptions(routePageKeys.map((value) => ({ title: value, value }))),
    }),
  ],
  validation: (rule) => [
    errors<unknown>((value) => ctaIssues(value))(rule) as typeof rule,
    warnings<unknown>((value) => ctaWarnings(value))(rule) as typeof rule,
  ],
  preview: { select: { title: "label", subtitle: "intent" } },
});

export const approvedImage = defineType({
  name: "approvedImage",
  title: "Image",
  type: "image",
  description: "Published only when usage rights are approved.",
  options: { hotspot: true },
  fields: [
    defineField({
      name: "alt",
      title: "Alternative text",
      type: "string",
      description: "Describe the content and purpose of the image. Required unless decorative.",
      validation: (rule) => rule.max(250),
    }),
    defineField({
      name: "decorative",
      title: "Decorative (no alt text needed)",
      type: "boolean",
      initialValue: false,
    }),
    defineField({
      name: "rightsStatus",
      title: "Usage rights",
      type: "string",
      options: listOptions(
        rightsStatuses.map((value) => ({ title: value, value })),
        "radio",
      ),
      initialValue: "pending",
      validation: (rule) => rule.required(),
    }),
    defineField({ name: "credit", title: "Credit", type: "string" }),
  ],
  validation: (rule) => errors<unknown>((value) => approvedImageIssues(value))(rule) as typeof rule,
});
