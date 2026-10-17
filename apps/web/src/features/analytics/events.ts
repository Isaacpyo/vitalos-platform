import { z } from "zod";

/**
 * Version-controlled analytics event taxonomy (Stage 10 §22). Names and properties are a
 * closed list: an event that is not declared here cannot be tracked, and properties are
 * restricted to non-personal identifiers (slugs, ids, enumerated outcomes). No free text, no
 * emails, names or message content, so no payload can leak personal data into a sink.
 *
 * The provider is Vercel Web Analytics when `NEXT_PUBLIC_ANALYTICS_PROVIDER=vercel` (off by default,
 * docs/seo/DECISIONS.md 23, ADR-046); this file is the contract every adapter implements. Browser
 * code records events through `track()` (`./track.ts`), which imports these types only.
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

/** A host name only (no scheme, path or query), for outbound links. */
const host = z
  .string()
  .regex(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/)
  .max(253);

/** A CTA's visible label, slugified ("Talk to Vitalos" → `talk-to-vitalos`). Site copy only. */
const label = slug.max(64);

/**
 * Event names follow the 17 Oct 2026 review brief (ADR-046). `page` is always the path the
 * visitor is on, without query string or fragment.
 */
export const analyticsEventSchemas = {
  /** The visitor first interacts with the enquiry form on this page view. */
  enquiry_started: z.strictObject({ page: route }),
  /** An enquiry was accepted (the receipt page). Replaces `contact_submit`. */
  enquiry_sent: z.strictObject({ page: route }),
  /** The visitor first interacts with a role's application form. */
  application_started: z.strictObject({ roleSlug: slug }),
  /** A role application was accepted. Replaces `application_submit` (PR #46). */
  application_sent: z.strictObject({ roleSlug: slug }),
  /** The Relay panel was opened (the widget dispatches `vitalos:relay`, ADR-046). */
  relay_opened: z.strictObject({ page: route }),
  /** A question was sent to Relay. No question text is recorded. */
  relay_question: z.strictObject({ page: route }),
  /** The visitor asked Relay for a person. */
  relay_handoff: z.strictObject({ page: route }),
  /** A call-to-action link (a `Button` link, or any link to the contact page) was clicked. */
  cta_click: z.strictObject({ label, page: route }),
  /** A link to another site was clicked: its host only. */
  outbound_click: z.strictObject({ host, page: route }),
  case_study_view: z.strictObject({ caseStudySlug: slug }),
  insight_to_offer_click: z.strictObject({ insightSlug: slug, offerSlug: slug }),
  lab_resource_click: z.strictObject({ labSlug: slug, resourceKind: slug }),
  /** An Insight was read: the reader reached the end of the article body (PR #46). */
  insight_read: z.strictObject({ insightSlug: slug }),
} as const;

export type AnalyticsEventName = keyof typeof analyticsEventSchemas;

export type AnalyticsEventProperties<E extends AnalyticsEventName> = z.infer<
  (typeof analyticsEventSchemas)[E]
>;

export const analyticsEventNames = Object.keys(analyticsEventSchemas) as AnalyticsEventName[];

export function isAnalyticsEventName(value: string): value is AnalyticsEventName {
  return Object.hasOwn(analyticsEventSchemas, value);
}
