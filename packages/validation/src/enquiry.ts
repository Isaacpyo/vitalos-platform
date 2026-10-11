import { z } from "zod";

/**
 * Enquiry contract v2 (Stage 8 section 20, Stage 9 section 15, Stage 10 section 21).
 *
 * The schema is the single description of what the public enquiry boundary accepts, shared by
 * the JSON route handler and the server action. It is `.strict()`: unknown keys are rejected.
 * Error messages explain how to fix the problem and never echo the submitted value.
 */

export const enquiryIntents = [
  "project",
  "offer",
  "engineering",
  "ai",
  "managed-services",
  "procurement",
  "partnership",
  "careers",
  "general",
] as const;
export type EnquiryIntent = (typeof enquiryIntents)[number];

/**
 * PROVISIONAL. Stage 8 section 20 asks for an "approximate urgency/timeframe" but does not fix
 * the bands. These keys are stable identifiers only; labels live in the form (workstream H).
 * The owner must approve the final bands before launch (stage-1-plan section 6).
 */
export const enquiryTimeframes = [
  "immediately",
  "within-3-months",
  "within-6-months",
  "exploring",
] as const;
export type EnquiryTimeframe = (typeof enquiryTimeframes)[number];

/**
 * Budget range is OFF until the owner approves the bands (stage-1-plan section 6). No band
 * values are invented here: while this list is empty the field is not accepted.
 */
export const approvedBudgetBands: readonly string[] = [];

/** Names of the `utm` keys accepted from the query string. */
export const utmKeys = ["source", "medium", "campaign", "term", "content"] as const;
export type UtmKey = (typeof utmKeys)[number];

export const GOAL_MIN = 20;
export const GOAL_MAX = 5000;

// A bare same-site path only: no scheme or host, no protocol-relative URL, no query or fragment
// (a query string would carry identifiers and tracking values), no backslash or control
// character (browsers strip tabs and newlines, so "/<TAB>/evil" would become "//evil").
// eslint-disable-next-line no-control-regex
const sitePath = /^\/(?!\/)[^\\?#\u0000-\u001f\u007f]*$/;
const slug = /^[a-z0-9][a-z0-9-]*$/;
const versionLabel = /^[A-Za-z0-9._-]+$/;

/** Length in Unicode code points: the unit PostgreSQL's char_length() counts, not UTF-16 units. */
export const codePointLength = (value: string): number => [...value].length;

// Controls other than tab, newline and carriage return (free text may contain those).
// eslint-disable-next-line no-control-regex
const freeTextControls = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;
// Any control character, including CR and LF: header and subject injection guard for one-line
// fields (name, role, organisation) that later reach email headers or logs.
// eslint-disable-next-line no-control-regex
const anyControl = /[\u0000-\u001f\u007f]/;

interface TextRules {
  min?: number;
  max: number;
  required: string;
  tooShort?: string;
  tooLong: string;
  /** One-line fields reject every control character; free text rejects only NUL and the like. */
  singleLine?: boolean;
}

/**
 * Trimmed text that PostgreSQL can store, measured the way the database measures it: well-formed
 * Unicode only (a lone surrogate cannot be encoded as UTF-8), no NUL (`text` cannot hold it) and
 * lengths in code points. Anything the database would refuse is a validation error here, never
 * an infrastructure failure.
 */
const storableText = (rules: TextRules) =>
  z
    .string({ error: rules.required })
    .trim()
    .superRefine((value, ctx) => {
      const issue = (message: string) => ctx.addIssue({ code: "custom", message });
      if (!value.isWellFormed()) return issue("Remove characters that cannot be stored.");
      if ((rules.singleLine ? anyControl : freeTextControls).test(value)) {
        return issue(
          rules.singleLine
            ? "Use a single line without control characters."
            : "Remove control characters.",
        );
      }
      const length = codePointLength(value);
      if (rules.min !== undefined && length < rules.min) {
        return issue(rules.tooShort ?? rules.required);
      }
      if (length > rules.max) return issue(rules.tooLong);
    });

const utmValue = z
  .string()
  .trim()
  .superRefine((value, ctx) => {
    if (value === "" || !value.isWellFormed() || anyControl.test(value)) {
      ctx.addIssue({ code: "custom", message: "UTM values must be plain text." });
    } else if (codePointLength(value) > 100) {
      ctx.addIssue({ code: "custom", message: "UTM values must be 100 characters or fewer." });
    }
  })
  .optional();

const utmSchema = z
  .object({
    source: utmValue,
    medium: utmValue,
    campaign: utmValue,
    term: utmValue,
    content: utmValue,
  })
  .strict()
  // The database caps the jsonb text at 2048 bytes and jsonb adds spacing, so bound the UTF-8
  // size of the JSON here with headroom.
  .refine((utm) => new TextEncoder().encode(JSON.stringify(utm)).byteLength <= 1500, {
    error: "UTM values are too long.",
  });

export interface EnquirySchemaOptions {
  /** Approved budget band identifiers. Empty (the default) means the field is not accepted. */
  budgetBands?: readonly string[];
}

export function createEnquirySchemaV2(options: EnquirySchemaOptions = {}) {
  const bands = options.budgetBands ?? approvedBudgetBands;
  return z
    .object({
      name: storableText({
        min: 2,
        max: 120,
        singleLine: true,
        required: "Enter your name.",
        tooShort: "Enter your name (at least 2 characters).",
        tooLong: "Your name must be 120 characters or fewer.",
      }),
      organisation: storableText({
        min: 1,
        max: 160,
        singleLine: true,
        required: "Enter your organisation.",
        tooLong: "Your organisation must be 160 characters or fewer.",
      }),
      workEmail: z
        .string({ error: "Enter your work email address." })
        .trim()
        .max(254, { error: "Work email must be 254 characters or fewer." })
        .pipe(z.email({ error: "Enter a work email address in the form name@company.com." })),
      role: storableText({
        max: 120,
        singleLine: true,
        required: "Enter a valid role.",
        tooLong: "Your role must be 120 characters or fewer.",
      }).optional(),
      goal: storableText({
        min: GOAL_MIN,
        max: GOAL_MAX,
        required: "Tell us what you are trying to achieve.",
        tooShort: `Tell us a little more about what you are trying to achieve (at least ${GOAL_MIN} characters).`,
        tooLong: `Keep this to ${GOAL_MAX} characters or fewer.`,
      }),
      timeframe: z.enum(enquiryTimeframes, { error: "Choose a timeframe." }),
      budgetRange: z
        .string()
        .trim()
        .max(40)
        .refine((value) => bands.includes(value), {
          error: "Budget range is not currently accepted. Leave it blank.",
        })
        .optional(),
      intent: z.enum(enquiryIntents, { error: "Choose what you would like to talk about." }),
      offerSlug: z
        .string()
        .trim()
        .max(120)
        .regex(slug, { error: "Offer reference is not valid." })
        .optional(),
      sourcePath: z
        .string({ error: "Source path is required." })
        .trim()
        .max(300)
        .regex(sitePath, { error: "Source path must be a path on this site." })
        .refine((value) => value.isWellFormed(), { error: "Source path is not valid." }),
      utm: utmSchema.optional(),
      consent: z.literal(true, {
        error: "Confirm that you have read the privacy notice so that we can contact you.",
      }),
      privacyNoticeVersion: z
        .string({ error: "Privacy notice version is required." })
        .trim()
        .min(1)
        .max(40)
        .regex(versionLabel, { error: "Privacy notice version is not valid." }),
      idempotencyKey: z.uuid({ error: "Idempotency key must be a UUID." }),
      turnstileToken: z.string().max(4096).optional(),
      /** Honeypot. Humans never see it; any value means automation. */
      website: z.literal("").optional(),
    })
    .strict();
}

export const enquirySchemaV2 = createEnquirySchemaV2();

export type EnquiryInputV2 = z.infer<typeof enquirySchemaV2>;

/** Every key the enquiry JSON body may carry. */
export const enquiryFieldNames = [
  "name",
  "organisation",
  "workEmail",
  "role",
  "goal",
  "timeframe",
  "budgetRange",
  "intent",
  "offerSlug",
  "sourcePath",
  "utm",
  "consent",
  "privacyNoticeVersion",
  "idempotencyKey",
  "turnstileToken",
  "website",
] as const;
export type EnquiryFieldName = (typeof enquiryFieldNames)[number];

/** Text fields a form re-populates after a validation failure. Never includes the token. */
export const enquiryEchoFieldNames = [
  "name",
  "organisation",
  "workEmail",
  "role",
  "goal",
  "timeframe",
  "budgetRange",
  "intent",
  "offerSlug",
] as const;
export type EnquiryEchoFieldName = (typeof enquiryEchoFieldNames)[number];

/** HTML form field names used by the native form POST (Turnstile's widget field is fixed). */
export const enquiryFormFields = {
  turnstileToken: "cf-turnstile-response",
  utm: (key: UtmKey) => `utm_${key}`,
} as const;

interface FieldReader {
  get(name: string): unknown;
}

const text = (reader: FieldReader, name: string): string | undefined => {
  const value = reader.get(name);
  if (typeof value !== "string") return undefined;
  return value === "" ? undefined : value;
};

/**
 * Maps a browser form submission (FormData or URLSearchParams) onto the JSON body shape.
 * Only known fields are read, so framework fields such as `$ACTION_ID_*` never reach the
 * strict schema. Blank inputs become `undefined`; the consent checkbox ("on") becomes `true`.
 * The honeypot is passed through verbatim so a filled value is detected.
 */
export function enquiryInputFromForm(reader: FieldReader): Record<string, unknown> {
  const utm: Record<string, string> = {};
  for (const key of utmKeys) {
    const value = text(reader, enquiryFormFields.utm(key));
    if (value !== undefined) utm[key] = value;
  }
  const consent = reader.get("consent");
  const website = reader.get("website");
  return {
    name: text(reader, "name"),
    organisation: text(reader, "organisation"),
    workEmail: text(reader, "workEmail"),
    role: text(reader, "role"),
    goal: text(reader, "goal"),
    timeframe: text(reader, "timeframe"),
    budgetRange: text(reader, "budgetRange"),
    intent: text(reader, "intent"),
    offerSlug: text(reader, "offerSlug"),
    sourcePath: text(reader, "sourcePath"),
    utm: Object.keys(utm).length > 0 ? utm : undefined,
    consent: consent === "on" || consent === "true" ? true : undefined,
    privacyNoticeVersion: text(reader, "privacyNoticeVersion"),
    idempotencyKey: text(reader, "idempotencyKey"),
    turnstileToken: text(reader, enquiryFormFields.turnstileToken),
    website: typeof website === "string" ? website : undefined,
  };
}

export type EnquiryFieldErrors = Partial<Record<EnquiryFieldName, string>>;

const isFieldName = (value: unknown): value is EnquiryFieldName =>
  typeof value === "string" && (enquiryFieldNames as readonly string[]).includes(value);

export interface EnquiryIssueSummary {
  fieldErrors: EnquiryFieldErrors;
  /** The honeypot was filled: automation. Never shown to the caller as a field error. */
  honeypotTripped: boolean;
  /** The body carried keys outside the contract: not a browser form. */
  unknownKeys: boolean;
}

/** First message per top-level field, plus the abuse signals that must not become field errors. */
export function summariseEnquiryIssues(error: z.ZodError): EnquiryIssueSummary {
  const fieldErrors: EnquiryFieldErrors = {};
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
