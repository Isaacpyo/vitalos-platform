/**
 * Proof and authority: caseStudy, insight, person, labAsset.
 * Specs: Stage 8 §14-16, §21; Stage 10 §17-19; Stage 9 §32.
 */
import { defineArrayMember, defineField, defineType } from "sanity";
import {
  clientDisplays,
  engagementBasisList,
  insightFormatList,
  insightTopicList,
  labTypeList,
  maturityList,
} from "../constants";
import { caseStudyIssues, insightIssues, labAssetIssues, personIssues } from "../rules/documents";
import { clientFrom, uniqueLabSlugIssues } from "../rules/unique";
import { errors } from "../rules/wire";
import { listOptions, refList, slugField, stringList, summaryField, titleField } from "../shared";
import { closingFields, documentRules, slugChangeCheck, statusPreview } from "./common";

export const caseStudy = defineType({
  name: "caseStudy",
  title: "Case study",
  type: "document",
  description:
    "Real outcomes only. Conceptual Labs assets never appear as client work (Stage 10 §17).",
  fields: [
    titleField,
    slugField(),
    summaryField,
    defineField({
      name: "engagementBasis",
      title: "Engagement basis",
      type: "string",
      description: "Was this contracted by Vitalos, or prior founder/team experience?",
      options: listOptions(engagementBasisList, "radio"),
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "clientDisplay",
      title: "Client display",
      type: "string",
      options: listOptions(
        clientDisplays.map((value) => ({ title: value, value })),
        "radio",
      ),
      initialValue: "anonymised",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "clientName",
      title: "Client name (named clients only; leave empty when anonymised)",
      type: "string",
    }),
    defineField({
      name: "permissionEvidence",
      title: "Client permission evidence",
      type: "evidence",
      description: "Named clients need verified permission. Internal pointer only.",
    }),
    defineField({
      name: "anonymisedDescriptor",
      title: "Anonymised client description",
      type: "string",
      description: "For example sector and size, without identifying the client.",
      validation: (rule) => rule.max(120),
    }),
    defineField({ name: "sector", title: "Sector", type: "string" }),
    defineField({ name: "challenge", title: "Challenge", type: "richText" }),
    defineField({ name: "approach", title: "Approach", type: "richText" }),
    defineField({ name: "outcome", title: "Outcome", type: "richText" }),
    defineField({
      name: "metrics",
      title: "Outcome metrics",
      type: "array",
      of: [defineArrayMember({ type: "outcomeMetric" })],
    }),
    defineField({ name: "testimonial", title: "Client testimonial", type: "testimonial" }),
    defineField({
      name: "disclosureApproved",
      title: "Client approved disclosure of screenshots and architecture",
      type: "boolean",
      initialValue: false,
    }),
    defineField({
      name: "evidence",
      title: "Case study evidence",
      type: "evidence",
      description: "Verified evidence is what makes a case study count towards the Work gate.",
      validation: (rule) => rule.required(),
    }),
    refList({ name: "practices", title: "Practices involved", to: ["practice"], weak: true }),
    refList({ name: "solutions", title: "Solutions", to: ["solution"], weak: true }),
    refList({ name: "industries", title: "Industries", to: ["industry"], weak: true }),
    ...closingFields,
  ],
  validation: documentRules(errors<unknown>(caseStudyIssues), slugChangeCheck),
  preview: statusPreview,
});

export const insight = defineType({
  name: "insight",
  title: "Insight",
  type: "document",
  fields: [
    titleField,
    slugField(),
    summaryField,
    defineField({
      name: "format",
      title: "Format",
      type: "string",
      options: listOptions(insightFormatList),
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "topics",
      title: "Topics",
      type: "array",
      of: [{ type: "string" }],
      options: { list: insightTopicList.map((entry) => ({ ...entry })) },
      validation: (rule) => rule.required().min(1).max(3).unique(),
    }),
    refList({
      name: "authors",
      title: "Authors",
      to: ["person"],
      min: 1,
      description: "Every article has a named author profile (Stage 10 §18).",
    }),
    defineField({
      name: "publishedAt",
      title: "Published on",
      type: "date",
      validation: (rule) => rule.required(),
    }),
    defineField({ name: "updatedAt", title: "Last updated on", type: "date" }),
    defineField({
      name: "body",
      title: "Body",
      type: "richText",
      validation: (rule) => rule.required().min(1),
    }),
    refList({ name: "industries", title: "Industries", to: ["industry"], weak: true }),
    refList({ name: "practices", title: "Practices", to: ["practice"], weak: true }),
    refList({ name: "related", title: "Related insights", to: ["insight"], weak: true }),
    defineField({ name: "cta", title: "Related commercial call to action", type: "cta" }),
    ...closingFields,
  ],
  validation: documentRules(errors<unknown>(insightIssues), slugChangeCheck),
  preview: statusPreview,
});

export const person = defineType({
  name: "person",
  title: "Person",
  type: "document",
  fields: [
    defineField({
      name: "name",
      title: "Name",
      type: "string",
      validation: (rule) => rule.required().max(120),
    }),
    slugField("name"),
    defineField({
      name: "role",
      title: "Role",
      type: "string",
      validation: (rule) => rule.max(120),
    }),
    defineField({
      name: "isLeadership",
      title: "Named leadership",
      type: "boolean",
      description: "Show on the leadership page. Only for real, accountable leaders.",
      initialValue: false,
    }),
    summaryField,
    defineField({ name: "bio", title: "Biography", type: "richText" }),
    defineField({ name: "portrait", title: "Portrait", type: "approvedImage" }),
    stringList({ name: "expertise", title: "Expertise" }),
    defineField({
      name: "credentials",
      title: "Credentials",
      type: "array",
      of: [
        defineArrayMember({
          type: "object",
          name: "credential",
          fields: [
            defineField({
              name: "label",
              title: "Credential",
              type: "string",
              validation: (rule) => rule.required().max(160),
            }),
            defineField({
              name: "evidence",
              title: "Evidence",
              type: "evidence",
              validation: (rule) => rule.required(),
            }),
          ],
          preview: { select: { title: "label", subtitle: "evidence.evidenceStatus" } },
        }),
      ],
    }),
    defineField({
      name: "sameAs",
      title: "Profile links",
      type: "array",
      description: "Only verified profiles are published.",
      of: [
        defineArrayMember({
          type: "object",
          name: "profileLink",
          fields: [
            defineField({ name: "label", title: "Label", type: "string" }),
            defineField({
              name: "url",
              title: "URL (https)",
              type: "url",
              validation: (rule) => rule.required().uri({ scheme: ["https"] }),
            }),
            defineField({
              name: "verified",
              title: "Verified as this person's profile",
              type: "boolean",
              initialValue: false,
            }),
          ],
          preview: { select: { title: "label", subtitle: "url" } },
        }),
      ],
    }),
    ...closingFields,
  ],
  validation: documentRules(errors<unknown>(personIssues), slugChangeCheck),
  preview: { select: { title: "name", subtitle: "role" } },
});

export const labAsset = defineType({
  name: "labAsset",
  title: "Lab asset",
  type: "document",
  description: "Technical proof. Never presented as client work (Stage 10 §19).",
  fields: [
    titleField,
    slugField(),
    summaryField,
    defineField({
      name: "labType",
      title: "Labs type",
      type: "string",
      options: listOptions(labTypeList),
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "maturity",
      title: "Maturity",
      type: "string",
      description: "Shown above the fold. Base it on actual evidence.",
      options: listOptions(maturityList, "radio"),
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "is",
      title: "What it is",
      type: "text",
      rows: 3,
      validation: (rule) => rule.max(500),
    }),
    defineField({
      name: "isNot",
      title: "What it is not",
      type: "text",
      rows: 3,
      validation: (rule) => rule.max(500),
    }),
    defineField({
      name: "limitations",
      title: "Known limitations",
      type: "text",
      rows: 4,
      description: "Required: every Labs asset states its limitations.",
      validation: (rule) => rule.required().max(800),
    }),
    defineField({ name: "body", title: "Description", type: "richText" }),
    defineField({
      name: "maintained",
      title: "Maintained and safe to link",
      type: "boolean",
      description: "Repository and demo links are published only when maintained.",
      initialValue: false,
    }),
    defineField({
      name: "repoUrl",
      title: "Repository URL",
      type: "url",
      validation: (rule) => rule.uri({ scheme: ["https"] }),
    }),
    defineField({
      name: "demoUrl",
      title: "Demo URL",
      type: "url",
      validation: (rule) => rule.uri({ scheme: ["https"] }),
    }),
    defineField({
      name: "evidence",
      title: "Evidence",
      type: "evidence",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "supportEvidence",
      title: "Support evidence (production products only)",
      type: "evidence",
      description: "A production product needs verified evidence that it is separately supported.",
    }),
    refList({ name: "practices", title: "Related practices", to: ["practice"], weak: true }),
    refList({ name: "industries", title: "Related industries", to: ["industry"], weak: true }),
    ...closingFields,
  ],
  validation: documentRules(
    errors<unknown>(labAssetIssues),
    errors<unknown>((doc, context) =>
      context.document ? uniqueLabSlugIssues(doc, context.document._id, clientFrom(context)) : [],
    ),
    slugChangeCheck,
  ),
  preview: { select: { title: "title", subtitle: "maturity" } },
});
