import { z } from "zod";
import { LIMITS, isSafeSiteLink } from "../contract";

/** Strips control and bidi-override characters and trims; keeps newlines and tabs. */
export function cleanText(value: string): string {
  return (
    value
      // eslint-disable-next-line no-control-regex
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u202A-\u202E\u2066-\u2069]/g, "")
      .trim()
  );
}

const clean = (max: number) =>
  z
    .string()
    .max(max * 2)
    .transform(cleanText)
    .pipe(z.string().max(max));

const optionalClean = (max: number) =>
  z
    .string()
    .max(max * 2)
    .transform(cleanText)
    .pipe(z.string().max(max))
    .optional();

const pageUrl = z
  .string()
  .max(500)
  .refine(
    (v) => URL.canParse(v) && /^https?:$/.test(new URL(v).protocol),
    "must be an http(s) URL",
  );

export const uuid = z.uuid();

export const createConversationBody = z.object({
  turnstileToken: z.string().max(4096).optional(),
  pageUrl,
  pageTitle: optionalClean(200),
  referrer: z.string().max(500).optional(),
  utm: z.record(z.string().regex(/^utm_[a-z]{1,20}$/), z.string().max(200)).optional(),
});

export const chatBody = z.object({
  conversationId: uuid,
  clientMessageId: uuid,
  text: z
    .string()
    .max(LIMITS.messageMaxChars * 2)
    .transform(cleanText)
    .pipe(z.string().min(1).max(LIMITS.messageMaxChars)),
  pageUrl,
});

export const feedbackBody = z.object({
  conversationId: uuid,
  messageId: uuid,
  value: z.union([z.literal(1), z.literal(-1)]),
});

export const handoffBody = z.object({
  conversationId: uuid,
  trigger: z.enum(["not_helpful", "explicit_request", "low_confidence", "model_flag"]),
  name: clean(LIMITS.nameMaxChars).pipe(z.string().min(1, "Enter your name")),
  email: z
    .string()
    .max(254)
    .transform((v) => v.trim())
    .pipe(z.email("Enter a valid email address")),
  company: optionalClean(LIMITS.companyMaxChars),
  consent: z.literal(true, { error: "Tick the box so we can contact you about this enquiry" }),
  noticeVersion: z.string().regex(/^[A-Za-z0-9._-]{1,40}$/),
});

export const conversationRef = z.object({ conversationId: uuid });

// ----------------------------------------------------------------------------------------------
// Admin API bodies (docs/relay/API.md)
// ----------------------------------------------------------------------------------------------
export const adminIdentity = z.object({
  id: z.string().regex(/^sa:\d{1,12}$/),
  name: z.string().min(1).max(120),
  initials: z.string().min(1).max(4),
  email: z.email().max(254),
  role: z.enum(["SuperAdmin", "ServiceLead"]),
});
export type AdminIdentity = z.infer<typeof adminIdentity>;

export const adminReplyBody = z.object({
  text: z.string().max(8000).transform(cleanText).pipe(z.string().min(1).max(4000)),
  clientMessageId: uuid,
  emailIfAway: z.boolean().default(false),
});

export const adminNoteBody = z.object({
  text: z.string().max(8000).transform(cleanText).pipe(z.string().min(1).max(4000)),
});

export const adminAssignBody = z.object({
  admin: z.object({
    id: z.string().regex(/^sa:\d{1,12}$/),
    name: z.string().min(1).max(120),
    initials: z.string().min(1).max(4),
  }),
});

export const presenceBody = z.object({ available: z.boolean() });

export const saveToKnowledgeBody = z.object({ messageId: uuid });

export const knowledgeTypes = [
  "offer",
  "solution",
  "practice",
  "industry",
  "page",
  "guide",
  "policy",
  "faq",
  "company",
] as const;
export type KnowledgeType = (typeof knowledgeTypes)[number];

export const knowledgeDraftBody = z.object({
  title: clean(300).pipe(z.string().min(1)),
  url: z
    .string()
    .max(500)
    .refine((v) => v === "" || isSafeSiteLink(v), {
      message: "use a site path such as /offers/engineering-rescue",
    })
    .optional(),
  type: z.enum(knowledgeTypes).default("guide"),
  owner: optionalClean(120),
  reviewDate: z.iso.date().optional(),
  bodyMd: z.string().max(60_000).transform(cleanText),
});

export const knowledgeTestBody = z.object({
  question: clean(500).pipe(z.string().min(1)),
  pagePath: z.string().max(300).optional(),
});

export const inboxQuery = z.object({
  tab: z.enum(["needs", "live", "ai", "closed"]).default("needs"),
  q: z.string().max(120).optional(),
  cursor: z.string().max(200).optional(),
});
