import { z } from "zod";
import {
  GOAL_MAX,
  codePointLength,
  enquiryFormFields,
  enquirySchemaV2,
  enquiryTimeframes,
  storableText,
  utmKeys,
} from "./enquiry";
import type { EnquiryInputV2 } from "./enquiry";

/**
 * Vitalos AI & Data enquiry form (docs/ai-data/PLAN.md "Shared contracts", AID-004, AID-005).
 *
 * The form asks for more than the main contact form (sector, the business problem, the current
 * process, the desired outcome, an optional offer and budget band) but stores nothing new: it is
 * validated here, then composed into the existing enquiry contract v2 (`intent: "ai"`, source path
 * `/ai-data/contact`, labelled sections in `goal`) and submitted through the same enquiry service.
 * No database migration is needed.
 *
 * The schema is `.strict()`. Text uses the same storable-text rules as the main form (well-formed
 * Unicode, control characters refused, lengths in code points), and error messages explain the
 * fix without echoing the value.
 */

/** Offer keys shared by the site, the form and the Super Admin (PLAN.md). */
export const aiDataOffers = [
  "ai-opportunity-assessment",
  "ai-proof-of-value",
  "production-ai-engineering",
  "managed-ai-operations",
] as const;
export type AiDataOffer = (typeof aiDataOffers)[number];

export const aiDataOfferLabels: Record<AiDataOffer, string> = {
  "ai-opportunity-assessment": "AI Opportunity Assessment",
  "ai-proof-of-value": "AI Proof of Value",
  "production-ai-engineering": "Production AI Engineering",
  "managed-ai-operations": "Managed AI Operations",
};

/** The offer select also offers "Not sure yet", which submits no offer slug. */
export const AI_DATA_OFFER_NOT_SURE = "not-sure";
export const aiDataOfferChoices = [...aiDataOffers, AI_DATA_OFFER_NOT_SURE] as const;
export type AiDataOfferChoice = (typeof aiDataOfferChoices)[number];

/** Sector keys shared by the form and the Super Admin (PLAN.md). */
export const aiDataSectors = [
  "accounting-bookkeeping",
  "property",
  "automotive",
  "professional-services",
  "trades-field-services",
  "retail-ecommerce",
  "other",
] as const;
export type AiDataSector = (typeof aiDataSectors)[number];

export const aiDataSectorLabels: Record<AiDataSector, string> = {
  "accounting-bookkeeping": "Accounting and bookkeeping",
  property: "Property",
  automotive: "Automotive",
  "professional-services": "Professional services",
  "trades-field-services": "Trades and field services",
  "retail-ecommerce": "Retail and e-commerce",
  other: "Other",
};

/** Indicative budget bands, AI & Data form only (AID-005). Optional; blank means "Not given". */
export const aiDataBudgetBands = ["under-1k", "1k-5k", "5k-15k", "over-15k", "not-sure"] as const;
export type AiDataBudgetBand = (typeof aiDataBudgetBands)[number];

export const aiDataBudgetLabels: Record<AiDataBudgetBand, string> = {
  "under-1k": "Under £1,000",
  "1k-5k": "£1,000–£5,000",
  "5k-15k": "£5,000–£15,000",
  "over-15k": "Over £15,000",
  "not-sure": "Not sure yet",
};

/** The enquiry's recorded source: a bare path, no query string. */
export const AI_DATA_SOURCE_PATH = "/ai-data/contact";

export const AI_DATA_PROBLEM_MIN = 20;
export const AI_DATA_PROBLEM_MAX = 2000;
export const AI_DATA_PROCESS_MAX = 1200;
export const AI_DATA_OUTCOME_MIN = 10;
export const AI_DATA_OUTCOME_MAX = 1000;

/** Shown in the composed text when an optional answer was left blank. */
export const NOT_GIVEN = "Not given";

const v2 = enquirySchemaV2.shape;

export const aiDataEnquirySchema = z
  .object({
    // Identity and consent fields keep the main contract's exact rules and messages.
    name: v2.name,
    workEmail: v2.workEmail,
    organisation: v2.organisation,
    role: v2.role,
    sector: z.enum(aiDataSectors, { error: "Choose the sector closest to your business." }),
    problem: storableText({
      min: AI_DATA_PROBLEM_MIN,
      max: AI_DATA_PROBLEM_MAX,
      required: "Describe the business problem or workflow.",
      tooShort: `Tell us a little more about the problem or workflow (at least ${AI_DATA_PROBLEM_MIN} characters).`,
      tooLong: `Keep the problem description to ${AI_DATA_PROBLEM_MAX} characters or fewer.`,
    }),
    currentProcess: storableText({
      max: AI_DATA_PROCESS_MAX,
      required: "Describe your current tools and process, or leave this blank.",
      tooLong: `Keep the current tools and process to ${AI_DATA_PROCESS_MAX} characters or fewer.`,
    }).optional(),
    desiredOutcome: storableText({
      min: AI_DATA_OUTCOME_MIN,
      max: AI_DATA_OUTCOME_MAX,
      required: "Describe the outcome you want.",
      tooShort: `Tell us a little more about the outcome you want (at least ${AI_DATA_OUTCOME_MIN} characters).`,
      tooLong: `Keep the desired outcome to ${AI_DATA_OUTCOME_MAX} characters or fewer.`,
    }),
    offer: z
      .enum(aiDataOfferChoices, { error: "Choose one of the listed offers, or leave it blank." })
      .optional(),
    timeframe: z.enum(enquiryTimeframes, { error: "Choose a timeframe." }),
    budget: z
      .enum(aiDataBudgetBands, {
        error: "Choose one of the listed budget bands, or leave it blank.",
      })
      .optional(),
    utm: v2.utm,
    consent: v2.consent,
    privacyNoticeVersion: v2.privacyNoticeVersion,
    idempotencyKey: v2.idempotencyKey,
    turnstileToken: v2.turnstileToken,
    /** Honeypot. Humans never see it; any value means automation. */
    website: v2.website,
  })
  .strict();

export type AiDataEnquiryInput = z.infer<typeof aiDataEnquirySchema>;

/** Every key the AI & Data form body may carry. */
export const aiDataFieldNames = [
  "name",
  "workEmail",
  "organisation",
  "role",
  "sector",
  "problem",
  "currentProcess",
  "desiredOutcome",
  "offer",
  "timeframe",
  "budget",
  "utm",
  "consent",
  "privacyNoticeVersion",
  "idempotencyKey",
  "turnstileToken",
  "website",
] as const;
export type AiDataFieldName = (typeof aiDataFieldNames)[number];

/** Fields a form re-populates after a failed submission. Never the token or the honeypot. */
export const aiDataEchoFieldNames = [
  "name",
  "workEmail",
  "organisation",
  "role",
  "sector",
  "problem",
  "currentProcess",
  "desiredOutcome",
  "offer",
  "timeframe",
  "budget",
] as const;
export type AiDataEchoFieldName = (typeof aiDataEchoFieldNames)[number];

export type AiDataFieldErrors = Partial<Record<AiDataFieldName, string>>;

interface FieldReader {
  get(name: string): unknown;
}

const text = (reader: FieldReader, name: string): string | undefined => {
  const value = reader.get(name);
  if (typeof value !== "string") return undefined;
  return value.trim() === "" ? undefined : value;
};

/**
 * Maps a browser submission (FormData or URLSearchParams) onto the AI & Data body. Only known
 * fields are read, so framework fields never reach the strict schema. Blank inputs become
 * `undefined`; the consent checkbox becomes `true`; the honeypot passes through verbatim.
 */
export function aiDataEnquiryInputFromForm(reader: FieldReader): Record<string, unknown> {
  const utm: Record<string, string> = {};
  for (const key of utmKeys) {
    const value = text(reader, enquiryFormFields.utm(key));
    if (value !== undefined) utm[key] = value;
  }
  const consent = reader.get("consent");
  const website = reader.get("website");
  return {
    name: text(reader, "name"),
    workEmail: text(reader, "workEmail"),
    organisation: text(reader, "organisation"),
    role: text(reader, "role"),
    sector: text(reader, "sector"),
    problem: text(reader, "problem"),
    currentProcess: text(reader, "currentProcess"),
    desiredOutcome: text(reader, "desiredOutcome"),
    offer: text(reader, "offer"),
    timeframe: text(reader, "timeframe"),
    budget: text(reader, "budget"),
    utm: Object.keys(utm).length > 0 ? utm : undefined,
    consent: consent === "on" || consent === "true" ? true : undefined,
    privacyNoticeVersion: text(reader, "privacyNoticeVersion"),
    idempotencyKey: text(reader, "idempotencyKey"),
    turnstileToken: text(reader, enquiryFormFields.turnstileToken),
    website: typeof website === "string" ? website : undefined,
  };
}

const isFieldName = (value: unknown): value is AiDataFieldName =>
  typeof value === "string" && (aiDataFieldNames as readonly string[]).includes(value);

export interface AiDataIssueSummary {
  fieldErrors: AiDataFieldErrors;
  /** The honeypot was filled: automation. Never shown as a field error. */
  honeypotTripped: boolean;
  /** The body carried keys outside the contract: not a browser form. */
  unknownKeys: boolean;
}

/** First message per field, plus the abuse signals that must not become field errors. */
export function summariseAiDataIssues(error: z.ZodError): AiDataIssueSummary {
  const fieldErrors: AiDataFieldErrors = {};
  let honeypotTripped = false;
  let unknownKeys = false;
  for (const issue of error.issues) {
    if (issue.code === "unrecognized_keys" && issue.path.length === 0) {
      unknownKeys = true;
      continue;
    }
    const head = issue.path[0];
    if (head === "website") {
      honeypotTripped = true;
      continue;
    }
    if (isFieldName(head) && fieldErrors[head] === undefined) fieldErrors[head] = issue.message;
  }
  return { fieldErrors, honeypotTripped, unknownKeys };
}

/**
 * The stored enquiry text: the exact template in docs/ai-data/PLAN.md ("Composed enquiry text"),
 * with labels for every section so the Super Admin and the notification read it unambiguously.
 * With every field at its maximum it stays well under `GOAL_MAX` (asserted in the tests).
 */
export function composeAiDataGoal(
  input: Pick<AiDataEnquiryInput, "sector" | "problem" | "currentProcess" | "desiredOutcome"> & {
    budget?: AiDataBudgetBand | undefined;
  },
): string {
  return [
    "Vitalos AI & Data enquiry",
    `Sector: ${aiDataSectorLabels[input.sector]}`,
    "Business problem or workflow:",
    input.problem,
    "Current tools and process:",
    input.currentProcess ?? NOT_GIVEN,
    "Desired outcome:",
    input.desiredOutcome,
    `Indicative budget: ${input.budget ? aiDataBudgetLabels[input.budget] : NOT_GIVEN} (enquirer's estimate)`,
  ].join("\n");
}

/** The offer slug to record: one of the four offers, never "Not sure yet". */
export const offerSlugFor = (offer: AiDataOfferChoice | undefined): AiDataOffer | undefined =>
  offer !== undefined && (aiDataOffers as readonly string[]).includes(offer)
    ? (offer as AiDataOffer)
    : undefined;

/**
 * The enquiry contract v2 body for a validated AI & Data submission. The enquiry service
 * validates it again with `enquirySchemaV2` (the single boundary), so this never bypasses it.
 */
export function toEnquiryInputV2(input: AiDataEnquiryInput): EnquiryInputV2 {
  const goal = composeAiDataGoal(input);
  // Defence in depth: the field limits make this unreachable.
  if (codePointLength(goal) > GOAL_MAX) throw new RangeError("composed goal exceeds GOAL_MAX");
  const offerSlug = offerSlugFor(input.offer);
  return {
    name: input.name,
    organisation: input.organisation,
    workEmail: input.workEmail,
    ...(input.role !== undefined ? { role: input.role } : {}),
    goal,
    timeframe: input.timeframe,
    intent: "ai",
    ...(offerSlug ? { offerSlug } : {}),
    sourcePath: AI_DATA_SOURCE_PATH,
    ...(input.utm !== undefined ? { utm: input.utm } : {}),
    consent: true,
    privacyNoticeVersion: input.privacyNoticeVersion,
    idempotencyKey: input.idempotencyKey,
    ...(input.turnstileToken !== undefined ? { turnstileToken: input.turnstileToken } : {}),
    website: "",
  };
}
