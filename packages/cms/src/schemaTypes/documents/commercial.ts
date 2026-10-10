/**
 * Commercial architecture: practice, solution, offer, industry.
 * Specs: Stage 8 §9-13, §21; Stage 9 §32; Stage 10 §15-16.
 *
 * Reference direction: parent -> child references are strong (practice -> solution -> offer);
 * back-pointers (offer -> solution/practice, solution -> practice) are weak so the two sides can be
 * published in either order without a circular-reference deadlock. Mappers union both directions.
 */
import { defineArrayMember, defineField, defineType } from "sanity";
import { durationCategoryList } from "../constants";
import { offerIssues, solutionIssues } from "../rules/documents";
import { errors } from "../rules/wire";
import { listOptions, refList, slugField, stringList, summaryField, titleField } from "../shared";
import { closingFields, documentRules, slugChangeCheck, statusPreview } from "./common";

export const practice = defineType({
  name: "practice",
  title: "Practice",
  type: "document",
  fields: [
    titleField,
    slugField(),
    summaryField,
    defineField({ name: "hero", title: "Hero", type: "hero" }),
    defineField({
      name: "proposition",
      title: "Proposition",
      type: "text",
      rows: 3,
      description: "The client value of the capability.",
      validation: (rule) => rule.required().max(400),
    }),
    stringList({ name: "problems", title: "Problems this practice addresses", min: 1 }),
    stringList({ name: "capabilities", title: "Core capabilities", min: 1 }),
    defineField({
      name: "body",
      title: "How this practice works with the others",
      type: "richText",
    }),
    refList({ name: "leads", title: "Named practice leads (only when real)", to: ["person"] }),
    refList({ name: "solutions", title: "Related solutions", to: ["solution"] }),
    refList({ name: "industries", title: "Relevant industries", to: ["industry"] }),
    refList({ name: "work", title: "Selected work", to: ["caseStudy"] }),
    refList({ name: "insights", title: "Relevant insights", to: ["insight"] }),
    refList({ name: "labs", title: "Relevant Labs evidence", to: ["labAsset"] }),
    defineField({ name: "cta", title: "Call to action", type: "cta" }),
    ...closingFields,
  ],
  validation: documentRules(slugChangeCheck),
  preview: statusPreview,
});

export const solution = defineType({
  name: "solution",
  title: "Solution",
  type: "document",
  fields: [
    titleField,
    slugField(),
    summaryField,
    defineField({ name: "hero", title: "Hero", type: "hero" }),
    defineField({
      name: "problemStatement",
      title: "Executive problem statement",
      type: "text",
      rows: 4,
      validation: (rule) => rule.required().max(600),
    }),
    stringList({ name: "signals", title: "Signals the problem is present", min: 1 }),
    defineField({
      name: "impact",
      title: "Business impact / cost of inaction",
      type: "text",
      rows: 4,
      validation: (rule) => rule.max(600),
    }),
    defineField({ name: "approach", title: "Vitalos approach", type: "richText" }),
    defineField({
      name: "phases",
      title: "Typical journey / phases",
      type: "array",
      of: [
        defineArrayMember({
          type: "object",
          name: "phase",
          fields: [
            defineField({
              name: "title",
              title: "Phase",
              type: "string",
              validation: (rule) => rule.required().max(80),
            }),
            defineField({
              name: "description",
              title: "Description",
              type: "text",
              rows: 3,
              validation: (rule) => rule.required().max(400),
            }),
          ],
          preview: { select: { title: "title", subtitle: "description" } },
        }),
      ],
    }),
    refList({
      name: "offers",
      title: "Offers",
      to: ["offer"],
      min: 1,
      description: "Required: a solution cannot publish without at least one offer (Stage 10 §15).",
    }),
    refList({ name: "practices", title: "Related practices", to: ["practice"], weak: true }),
    refList({ name: "industries", title: "Industry examples", to: ["industry"], weak: true }),
    refList({ name: "work", title: "Work / proof", to: ["caseStudy"] }),
    refList({ name: "labs", title: "Labs evidence", to: ["labAsset"] }),
    refList({ name: "insights", title: "Insights", to: ["insight"] }),
    defineField({
      name: "faq",
      title: "Common questions and procurement concerns",
      type: "array",
      of: [
        defineArrayMember({
          type: "object",
          name: "faqItem",
          fields: [
            defineField({
              name: "question",
              title: "Question",
              type: "string",
              validation: (rule) => rule.required().max(200),
            }),
            defineField({
              name: "answer",
              title: "Answer",
              type: "text",
              rows: 4,
              validation: (rule) => rule.required().max(800),
            }),
          ],
          preview: { select: { title: "question", subtitle: "answer" } },
        }),
      ],
    }),
    defineField({ name: "cta", title: "Outcome-led call to action", type: "cta" }),
    ...closingFields,
  ],
  validation: documentRules(errors<unknown>(solutionIssues), slugChangeCheck),
  preview: statusPreview,
});

/** Offers deliberately have no price field: pricing is proposal-led (Stage 8 §12 "Offer-page rule"). */
export const offer = defineType({
  name: "offer",
  title: "Offer",
  type: "document",
  fields: [
    titleField,
    slugField(),
    summaryField,
    defineField({ name: "hero", title: "Hero", type: "hero" }),
    defineField({
      name: "audience",
      title: "Who it is for",
      type: "text",
      rows: 2,
      validation: (rule) => rule.required().max(400),
    }),
    defineField({
      name: "trigger",
      title: "The problem or trigger",
      type: "text",
      rows: 3,
      validation: (rule) => rule.required().max(500),
    }),
    defineField({
      name: "scope",
      title: "Scope shape",
      type: "text",
      rows: 4,
      validation: (rule) => rule.required().max(800),
    }),
    stringList({ name: "outputs", title: "Expected outputs", min: 1 }),
    stringList({ name: "requirements", title: "What the client needs to provide" }),
    defineField({
      name: "durationCategory",
      title: "Timeframe category",
      type: "string",
      description: "A category, not a promise or a price.",
      options: listOptions(durationCategoryList, "radio"),
      validation: (rule) => rule.required(),
    }),
    stringList({ name: "exclusions", title: "What is not included" }),
    defineField({
      name: "nextStep",
      title: "Logical next stage",
      type: "text",
      rows: 2,
      validation: (rule) => rule.required().max(300),
    }),
    refList({
      name: "solutions",
      title: "Solutions",
      to: ["solution"],
      weak: true,
      description: "Link at least one solution or practice (no orphan offers).",
    }),
    refList({ name: "practices", title: "Practices", to: ["practice"], weak: true }),
    refList({ name: "work", title: "Related work", to: ["caseStudy"] }),
    defineField({ name: "cta", title: "Call to action", type: "cta" }),
    ...closingFields,
  ],
  validation: documentRules(errors<unknown>(offerIssues), slugChangeCheck),
  preview: statusPreview,
});

export const industry = defineType({
  name: "industry",
  title: "Industry",
  type: "document",
  fields: [
    titleField,
    slugField(),
    summaryField,
    defineField({ name: "hero", title: "Hero", type: "hero" }),
    stringList({ name: "realities", title: "Sector operating realities", min: 1 }),
    stringList({ name: "problems", title: "Problems", min: 1 }),
    stringList({ name: "aiOpportunities", title: "AI opportunities" }),
    stringList({
      name: "considerations",
      title: "Regulatory and trust considerations",
      description: "State considerations, not compliance claims.",
    }),
    defineField({ name: "body", title: "Sector narrative", type: "richText" }),
    refList({ name: "solutions", title: "Solutions", to: ["solution"] }),
    refList({ name: "offers", title: "Offers", to: ["offer"] }),
    refList({ name: "work", title: "Work", to: ["caseStudy"] }),
    refList({ name: "insights", title: "Insights", to: ["insight"] }),
    defineField({ name: "cta", title: "Call to action", type: "cta" }),
    ...closingFields,
  ],
  validation: documentRules(slugChangeCheck),
  preview: statusPreview,
});
