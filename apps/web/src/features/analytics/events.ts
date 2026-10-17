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
} as const;

export type AnalyticsEventName = keyof typeof analyticsEventSchemas;

export type AnalyticsEventProperties<E extends AnalyticsEventName> = z.infer<
  (typeof analyticsEventSchemas)[E]
>;

export const analyticsEventNames = Object.keys(analyticsEventSchemas) as AnalyticsEventName[];

export function isAnalyticsEventName(value: string): value is AnalyticsEventName {
  return Object.hasOwn(analyticsEventSchemas, value);
}
