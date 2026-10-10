/**
 * Trust, careers, legal, route pages, homepage, site settings and redirects.
 * Specs: Stage 8 §8, §16-21; Stage 10 §9, §11, §20; Stage 6 §14; Stage 11 §9.
 */
import { defineArrayMember, defineField, defineType } from "sanity";
import {
  contactIntentList,
  employmentTypeList,
  jobStatuses,
  redirectStatusCodes,
  routeKeyList,
  trustTopicList,
} from "../constants";
import { homeSections } from "../../locked-copy";
import {
  homePageIssues,
  jobIssues,
  legalSlugIssues,
  routePageIssues,
  siteSettingsIssues,
  siteSettingsWarnings,
  trustItemIssues,
  trustItemWarnings,
} from "../rules/documents";
import { redirectIssues, redirectLookupIssues } from "../rules/redirect";
import { clientFrom, clientRedirectLookup, uniqueFieldIssues } from "../rules/unique";
import { errors, warnings } from "../rules/wire";
import {
  listOptions,
  localeField,
  governanceField,
  refList,
  seoField,
  slugField,
  summaryField,
  titleField,
} from "../shared";
import { closingFields, documentRules, slugChangeCheck } from "./common";

export const trustItem = defineType({
  name: "trustItem",
  title: "Trust item",
  type: "document",
  description:
    "One document per Trust Centre topic. Controlled evidence stays in the controlled evidence room; this document holds only the public summary and an internal pointer.",
  fields: [
    titleField,
    defineField({
      name: "topic",
      title: "Trust Centre topic",
      type: "string",
      description: "One item per topic; the topic decides the URL.",
      options: listOptions(trustTopicList),
      validation: (rule) => rule.required(),
    }),
    summaryField,
    defineField({ name: "publicSummary", title: "Public summary", type: "richText" }),
    defineField({
      name: "evidence",
      title: "Evidence and classification",
      type: "evidence",
      description: "Classification controls whether this item may ever appear on the website.",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "certifications",
      title: "Current certifications",
      type: "array",
      description:
        "Only current, verified certifications with scope. Leave empty otherwise: no 'coming soon' entries.",
      of: [
        defineArrayMember({
          type: "object",
          name: "certification",
          fields: [
            defineField({ name: "name", title: "Certification", type: "string" }),
            defineField({ name: "scope", title: "Scope", type: "text", rows: 2 }),
            defineField({ name: "issuedAt", title: "Issued", type: "date" }),
            defineField({ name: "expiresAt", title: "Expires", type: "date" }),
            defineField({ name: "evidence", title: "Evidence", type: "evidence" }),
          ],
          preview: { select: { title: "name", subtitle: "expiresAt" } },
        }),
      ],
    }),
    defineField({
      name: "subprocessors",
      title: "Subprocessors",
      type: "array",
      of: [
        defineArrayMember({
          type: "object",
          name: "subprocessor",
          fields: [
            defineField({ name: "name", title: "Name", type: "string" }),
            defineField({ name: "purpose", title: "Purpose", type: "string" }),
            defineField({ name: "location", title: "Processing location", type: "string" }),
          ],
          preview: { select: { title: "name", subtitle: "purpose" } },
        }),
      ],
    }),
    defineField({
      name: "contactEmail",
      title: "Contact email for this topic",
      type: "string",
      validation: (rule) => rule.email(),
    }),
    ...closingFields,
  ],
  validation: documentRules(
    errors<unknown>((doc) => trustItemIssues(doc)),
    warnings<unknown>(trustItemWarnings),
    errors<unknown>((doc, context) =>
      context.document
        ? uniqueFieldIssues({
            client: clientFrom(context),
            type: "trustItem",
            id: context.document._id,
            field: "topic",
            value: (doc as { topic?: unknown } | undefined)?.topic,
            message: "There is already a trust item for this topic.",
          })
        : [],
    ),
  ),
  preview: { select: { title: "title", subtitle: "topic" } },
});

export const job = defineType({
  name: "job",
  title: "Job",
  type: "document",
  description: "Roles appear publicly only while open (the Careers gate counts open roles).",
  fields: [
    titleField,
    slugField(),
    summaryField,
    defineField({
      name: "practice",
      title: "Practice",
      type: "reference",
      to: [{ type: "practice" }],
      weak: true,
    }),
    defineField({
      name: "employmentType",
      title: "Employment type",
      type: "string",
      options: listOptions(employmentTypeList),
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "location",
      title: "Location",
      type: "string",
      description: "Accurate location including remote or hybrid arrangements.",
      validation: (rule) => rule.required().max(160),
    }),
    defineField({
      name: "datePosted",
      title: "Date posted",
      type: "date",
      validation: (rule) => rule.required(),
    }),
    defineField({ name: "validThrough", title: "Valid through", type: "date" }),
    defineField({
      name: "status",
      title: "Status",
      type: "string",
      options: listOptions(
        jobStatuses.map((value) => ({ title: value, value })),
        "radio",
      ),
      initialValue: "closed",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "applicationUrl",
      title: "Application link (https)",
      type: "url",
      validation: (rule) => rule.uri({ scheme: ["https"] }),
    }),
    defineField({ name: "description", title: "Description", type: "richText" }),
    ...closingFields,
  ],
  validation: documentRules(
    errors<unknown>((doc) => jobIssues(doc)),
    slugChangeCheck,
  ),
  preview: { select: { title: "title", subtitle: "status" } },
});

export const legalPage = defineType({
  name: "legalPage",
  title: "Legal page",
  type: "document",
  fields: [
    titleField,
    defineField({
      name: "slug",
      title: "Page",
      type: "slug",
      options: { source: "title" },
      description: "One of privacy, cookies, terms or acceptable-use.",
      validation: (rule) => [
        rule.required(),
        errors<unknown>(legalSlugIssues)(rule) as typeof rule,
      ],
    }),
    defineField({
      name: "version",
      title: "Version",
      type: "string",
      validation: (rule) => rule.required().max(40),
    }),
    defineField({
      name: "effectiveDate",
      title: "Effective date",
      type: "date",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "body",
      title: "Body",
      type: "richText",
      validation: (rule) => rule.required().min(1),
    }),
    ...closingFields,
  ],
  validation: documentRules(slugChangeCheck),
  preview: { select: { title: "title", subtitle: "version" } },
});

export const routePage = defineType({
  name: "routePage",
  title: "Route page",
  type: "document",
  description: "Content for an index page such as What We Do or Trust. One document per route key.",
  fields: [
    defineField({
      name: "routeKey",
      title: "Page",
      type: "string",
      options: listOptions(routeKeyList),
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "heading",
      title: "Page heading (H1)",
      type: "string",
      validation: (rule) => rule.required().max(120),
    }),
    defineField({
      name: "intro",
      title: "Introduction",
      type: "text",
      rows: 3,
      validation: (rule) => rule.max(500),
    }),
    defineField({ name: "hero", title: "Hero", type: "hero" }),
    defineField({ name: "body", title: "Body", type: "richText" }),
    defineField({ name: "cta", title: "Call to action", type: "cta" }),
    defineField({
      name: "expectations",
      title: "What happens next (contact page only)",
      type: "richText",
      description:
        "State only commitments Vitalos can operationally meet. When empty the site shows a neutral receipt and promises no response time.",
    }),
    defineField({
      name: "successMessage",
      title: "Success message (contact page only)",
      type: "string",
      validation: (rule) => rule.max(240),
    }),
    defineField({
      name: "routes",
      title: "Contact routes (contact page only)",
      type: "array",
      of: [
        defineArrayMember({
          type: "object",
          name: "contactRoute",
          fields: [
            defineField({
              name: "intent",
              title: "Intent",
              type: "string",
              options: listOptions(contactIntentList),
              validation: (rule) => rule.required(),
            }),
            defineField({
              name: "label",
              title: "Label",
              type: "string",
              validation: (rule) => rule.required().max(80),
            }),
            defineField({
              name: "description",
              title: "Description",
              type: "string",
              validation: (rule) => rule.max(200),
            }),
          ],
          preview: { select: { title: "label", subtitle: "intent" } },
        }),
      ],
    }),
    seoField,
    governanceField,
    localeField,
  ],
  validation: documentRules(
    errors<unknown>(routePageIssues),
    errors<unknown>((doc, context) =>
      context.document
        ? uniqueFieldIssues({
            client: clientFrom(context),
            type: "routePage",
            id: context.document._id,
            field: "routeKey",
            value: (doc as { routeKey?: unknown } | undefined)?.routeKey,
            message: "There is already a route page for this page.",
          })
        : [],
    ),
  ),
  preview: { select: { title: "heading", subtitle: "routeKey" } },
});

/**
 * Studio initial value for `homeSections`: structural section keys from locked-copy.ts and, only
 * where a spec quotes a visitor-facing title, that title as `visibleHeading`. Initial values are a
 * convenience for editors; the site renders whatever is saved and never falls back to these.
 */
export function homeSectionsInitialValue() {
  return homeSections.map((section) => ({
    _type: "homeSectionHeading",
    _key: section.key,
    sectionKey: section.key,
    ...("visibleHeading" in section ? { visibleHeading: section.visibleHeading } : {}),
  }));
}

export const homePage = defineType({
  name: "homePage",
  title: "Homepage",
  type: "document",
  description:
    "Curated selections for the homepage. The hero copy (proposition, brand line, CTAs) is locked in code and is not edited here.",
  fields: [
    defineField({
      name: "homeSections",
      title: "Section headings",
      type: "array",
      description:
        "Visitor-facing headings per homepage section. A section with no heading renders without one. Initial values come from the spec; the owner confirms the final copy.",
      initialValue: homeSectionsInitialValue,
      of: [
        defineArrayMember({
          type: "object",
          name: "homeSectionHeading",
          fields: [
            defineField({
              name: "sectionKey",
              title: "Section",
              type: "string",
              options: listOptions(
                homeSections.map((section) => ({
                  title: section.structuralLabel,
                  value: section.key,
                })),
              ),
              validation: (rule) => rule.required(),
            }),
            defineField({
              name: "visibleHeading",
              title: "Visible heading",
              type: "string",
              validation: (rule) => rule.max(80),
            }),
          ],
          preview: { select: { title: "sectionKey", subtitle: "visibleHeading" } },
        }),
      ],
    }),
    defineField({
      name: "proof",
      title: "Credibility strip",
      type: "array",
      description: "Real, verified markers only. No invented logo walls.",
      of: [
        defineArrayMember({
          type: "object",
          name: "proofItem",
          fields: [
            defineField({
              name: "label",
              title: "Label",
              type: "string",
              validation: (rule) => rule.required().max(120),
            }),
            defineField({
              name: "evidence",
              title: "Evidence",
              type: "evidence",
              validation: (rule) => rule.required(),
            }),
            defineField({
              name: "href",
              title: "Link (https)",
              type: "url",
              validation: (rule) => rule.uri({ scheme: ["https"] }),
            }),
          ],
          preview: { select: { title: "label", subtitle: "evidence.evidenceStatus" } },
        }),
      ],
    }),
    refList({ name: "solutions", title: "Problems we solve (solutions)", to: ["solution"] }),
    refList({ name: "practices", title: "Practices", to: ["practice"] }),
    refList({
      name: "selectedWork",
      title: "Selected Work (2-4 verified case studies)",
      to: ["caseStudy"],
      max: 4,
    }),
    refList({ name: "industries", title: "Industries", to: ["industry"] }),
    refList({ name: "trustHighlights", title: "Trust highlights", to: ["trustItem"] }),
    refList({ name: "labs", title: "Labs", to: ["labAsset"] }),
    refList({ name: "insights", title: "Insights", to: ["insight"] }),
    refList({ name: "leadership", title: "Leadership", to: ["person"] }),
    defineField({ name: "finalCta", title: "Final conversion call to action", type: "cta" }),
    seoField,
    governanceField,
    localeField,
  ],
  validation: documentRules(errors<unknown>(homePageIssues)),
  preview: { prepare: () => ({ title: "Homepage" }) },
});

export const siteSettings = defineType({
  name: "siteSettings",
  title: "Site settings",
  type: "document",
  fields: [
    defineField({
      name: "legalName",
      title: "Legal name",
      type: "string",
      description: "Exactly as registered. Do not guess.",
    }),
    defineField({
      name: "companyNumber",
      title: "Company number",
      type: "string",
      description: "Companies House registration number.",
    }),
    defineField({ name: "registeredAddress", title: "Registered address", type: "text", rows: 4 }),
    defineField({
      name: "contactEmail",
      title: "Contact email",
      type: "string",
      description: "Only an address that is actively monitored.",
      validation: (rule) => rule.email(),
    }),
    defineField({
      name: "securityEmail",
      title: "Security contact email",
      type: "string",
      description: "Only an address that is actively monitored.",
      validation: (rule) => rule.email(),
    }),
    defineField({
      name: "social",
      title: "Social links",
      type: "array",
      description: "Only verified channels are published.",
      of: [
        defineArrayMember({
          type: "object",
          name: "socialLink",
          fields: [
            defineField({
              name: "label",
              title: "Label",
              type: "string",
              validation: (rule) => rule.required().max(40),
            }),
            defineField({
              name: "href",
              title: "URL (https)",
              type: "url",
              validation: (rule) => rule.required().uri({ scheme: ["https"] }),
            }),
            defineField({
              name: "verified",
              title: "Verified as the official Vitalos channel",
              type: "boolean",
              initialValue: false,
            }),
          ],
          preview: { select: { title: "label", subtitle: "href" } },
        }),
      ],
    }),
    defineField({ name: "logo", title: "Logo", type: "approvedImage" }),
    defineField({ name: "defaultSeo", title: "Default SEO", type: "seo" }),
    governanceField,
    localeField,
  ],
  validation: documentRules(
    errors<unknown>(siteSettingsIssues),
    warnings<unknown>(siteSettingsWarnings),
  ),
  preview: { prepare: () => ({ title: "Site settings" }) },
});

export const redirect = defineType({
  name: "redirect",
  title: "Redirect",
  type: "document",
  description:
    "Permanent redirects and gone (410) paths for retired or renamed URLs. Chains are rejected: point every source at the final destination.",
  fields: [
    defineField({
      name: "source",
      title: "Source path",
      type: "string",
      description: "Starts with a single '/', for example /services.",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "status",
      title: "Status",
      type: "number",
      options: {
        list: [
          { title: "301 Moved permanently", value: 301 },
          { title: "308 Permanent (method preserved)", value: 308 },
          { title: "410 Gone", value: 410 },
        ],
        layout: "radio",
      },
      initialValue: redirectStatusCodes[0],
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "destination",
      title: "Destination",
      type: "string",
      description: "An internal path or an https URL. Leave empty for 410.",
    }),
    defineField({
      name: "reason",
      title: "Reason",
      type: "string",
      validation: (rule) => rule.max(200),
    }),
    governanceField,
    localeField,
  ],
  validation: documentRules(
    errors<unknown>(redirectIssues),
    errors<unknown>((doc, context) =>
      context.document
        ? redirectLookupIssues(doc, context.document._id, clientRedirectLookup(clientFrom(context)))
        : [],
    ),
  ),
  preview: { select: { title: "source", subtitle: "destination" } },
});
