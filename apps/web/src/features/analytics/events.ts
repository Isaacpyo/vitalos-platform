import { z } from "zod";

/**
 * Version-controlled analytics event taxonomy (Stage 10 §22). Names and properties are a
 * closed list: an event that is not declared here cannot be tracked, and properties are
 * restricted to non-personal identifiers (slugs, ids, enumerated outcomes). No free text, no
 * emails, names or message content, so no payload can leak personal data into a sink.
 *
 * The provider is Vercel Web Analytics when `NEXT_PUBLIC_ANALYTICS_PROVIDER=vercel` (off by default,
 * docs/seo/DECISIONS.md 23); this file is the contract every adapter implements.
 */
const slug = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  .max(96);

/** Route path without query string or fragment. */
const route = z
  .string()
  .regex(/^\/[A-Za-z0-9\-._~/]*$/)
  .max(200);

/** The shared workflow topic slugs of the AI & Data explorer and guided brief (docs/ai-data). */
const workflowTopic = z.enum([
  "finance-reconciliation",
  "document-intake",
  "customer-requests",
  "operational-reporting",
]);

/** Where on the AI & Data pages a demonstration event came from. */
const demoSurface = z.enum(["hero", "preview", "demonstrator", "expanded"]);

/** The guided brief's topic: a shared workflow slug, or "none" when it was not started from one. */
const briefTopic = z.enum([...workflowTopic.options, "none"]);

const outcome = z.enum(["success", "validation_error", "rejected", "error"]);

export const analyticsEventSchemas = {
  contact_submit: z.strictObject({ outcome, route }),
  offer_enquiry_submit: z.strictObject({ outcome, offerSlug: slug }),
  trust_enquiry_submit: z.strictObject({ outcome, route }),
  primary_cta_click: z.strictObject({ ctaId: slug, route }),
  case_study_view: z.strictObject({ caseStudySlug: slug }),
  insight_to_offer_click: z.strictObject({ insightSlug: slug, offerSlug: slug }),
  lab_resource_click: z.strictObject({ labSlug: slug, resourceKind: slug }),
  /** A role application was submitted (Careers, PR #46). */
  application_submit: z.strictObject({ outcome, roleSlug: slug }),
  /** An Insight was read: the reader reached the end of the article body (PR #46). */
  insight_read: z.strictObject({ insightSlug: slug }),
  /** A link to a Vitalos product's own site was followed; `destination` is the product slug. */
  outbound_click: z.strictObject({ destination: slug, route }),
  // --- Vitalos AI & Data marketing experience (W5, ADR-054). Slugs and enums only: no free text.
  /** First funnel event: a visitor picked a workflow in the hero or the explorer. */
  workflow_started: z.strictObject({ source: z.enum(["hero", "explorer"]), topic: workflowTopic }),
  /** A visitor chose a different workflow in the explorer. */
  explorer_topic_selected: z.strictObject({ topic: workflowTopic }),
  /** A visitor chose a synthetic sample in a demonstration. */
  demo_sample_chosen: z.strictObject({ surface: demoSurface, sampleId: slug }),
  /** A visitor moved a demonstration to another stage (their own click; there are no timers). */
  demo_stage_viewed: z.strictObject({ surface: demoSurface, sampleId: slug, stage: slug }),
  /** A visitor expanded the source evidence for one result. `itemId` is a line id such as `l6`. */
  demo_evidence_expanded: z.strictObject({ surface: demoSurface, sampleId: slug, itemId: slug }),
  /** A visitor used one of the Explore / Try calls to action. */
  ai_data_cta_click: z.strictObject({
    ctaId: z.enum(["explore-workflow", "try-example", "open-expanded-demo", "prepare-brief"]),
    route,
  }),

  // --- Guided brief on /ai-data/contact (W6). Counts, enums and booleans only: never the
  // visitor's text. Funnel: brief_started, brief_completed, brief_shared. ---
  /** The visitor started describing a workflow. `topic` is a shared topic slug or "none". */
  brief_started: z.strictObject({ topic: briefTopic }),
  /** The AI opt-in was switched on or off. */
  brief_ai_opt_in: z.strictObject({ enabled: z.boolean() }),
  /** Follow-up questions answered, and where the questions came from. */
  brief_questions_answered: z.strictObject({
    count: z.number().int().min(0).max(6),
    source: z.enum(["ai", "checklist"]),
  }),
  /** The brief was drafted and shown for review. */
  brief_completed: z.strictObject({
    source: z.enum(["ai", "checklist"]),
    cardsKept: z.number().int().min(0).max(5),
    cardsEdited: z.number().int().min(0).max(5),
  }),
  /** The brief was shared as an enquiry (reported on the receipt page). */
  brief_shared: z.strictObject({ source: z.enum(["ai", "checklist"]) }),
  /** The conventional form was submitted successfully. */
  simple_form_submitted: z.strictObject({ route }),
} as const;

export type AnalyticsEventName = keyof typeof analyticsEventSchemas;

export type AnalyticsEventProperties<E extends AnalyticsEventName> = z.infer<
  (typeof analyticsEventSchemas)[E]
>;

export const analyticsEventNames = Object.keys(analyticsEventSchemas) as AnalyticsEventName[];

export function isAnalyticsEventName(value: string): value is AnalyticsEventName {
  return Object.hasOwn(analyticsEventSchemas, value);
}
