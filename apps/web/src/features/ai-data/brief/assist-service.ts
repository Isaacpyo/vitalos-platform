import { rateLimitKey, saltedHash } from "@vitalos/security/rate-limit";
import type { RateLimiter } from "@vitalos/security/rate-limit";
import { z } from "zod";
import type { AssistFailure, BriefAssistClient } from "./assist-client";
import { cleanText } from "./text";
import { BRIEF_LIMITS, topicSlugs } from "./types";
import type { BriefDraft, BriefQuestion } from "./types";

/**
 * The brief-assist use case (W6), framework-free: validates the request, enforces the opt-in and
 * a per-IP limit, derives `visitor_ref`, calls the client. The server actions only wire it.
 *
 * Result is always one of: AI output, or "unavailable" with an honest reason. The caller falls
 * back to the checklist on every failure and never labels checklist output as AI.
 */

export const ASSIST_LIMIT = { windowSeconds: 600, max: 12 } as const;

const input = z.object({
  stage: z.enum(["questions", "brief"]),
  /** The visitor ticked the data-use opt-in. The server refuses anything else. */
  aiConsent: z.literal(true),
  description: z
    .string()
    .transform(cleanText)
    .pipe(z.string().min(BRIEF_LIMITS.descriptionMin).max(BRIEF_LIMITS.descriptionMax)),
  topic: z.enum(topicSlugs).nullable(),
  answers: z
    .array(
      z.object({
        id: z.string().regex(/^[A-Za-z0-9_-]{1,20}$/),
        question: z
          .string()
          .transform(cleanText)
          .pipe(z.string().min(1).max(BRIEF_LIMITS.questionMax)),
        answer: z.string().transform(cleanText).pipe(z.string().min(1).max(BRIEF_LIMITS.answerMax)),
      }),
    )
    .max(BRIEF_LIMITS.maxAnswers),
});

export type AssistActionInput = z.input<typeof input>;

export type AssistOutcome<T> =
  { source: "ai"; data: T } | { source: "unavailable"; reason: AssistFailure };

export interface AssistServiceDeps {
  client: BriefAssistClient | null;
  limiter: RateLimiter;
  /** `ENQUIRY_IP_HASH_SALT`. Without it AI is unavailable (no visitor_ref can be made). */
  salt: string | undefined;
  ip: string | undefined;
}

/** HMAC of the client IP, 64 hex characters. Never the raw address. */
export async function visitorRef(ip: string | undefined, salt: string): Promise<string> {
  return saltedHash(`brief-assist\u0000${ip ?? "unknown"}`, salt);
}

async function guard(
  raw: unknown,
  deps: AssistServiceDeps,
): Promise<
  | { ok: true; value: z.output<typeof input>; client: BriefAssistClient; ref: string }
  | { ok: false; reason: AssistFailure }
> {
  const parsed = input.safeParse(raw);
  if (!parsed.success) return { ok: false, reason: "invalid" };
  if (!deps.client || !deps.salt) return { ok: false, reason: "not-configured" };
  const key = await rateLimitKey("brief:ip", deps.ip ?? "unknown", deps.salt);
  const decision = await deps.limiter.consume(key, ASSIST_LIMIT);
  if (!decision.allowed) return { ok: false, reason: "busy" };
  return {
    ok: true,
    value: parsed.data,
    client: deps.client,
    ref: await visitorRef(deps.ip, deps.salt),
  };
}

export async function suggestQuestions(
  raw: unknown,
  deps: AssistServiceDeps,
): Promise<AssistOutcome<BriefQuestion[]>> {
  const checked = await guard(raw, deps);
  if (!checked.ok) return { source: "unavailable", reason: checked.reason };
  const { value, client, ref } = checked;
  const result = await client.questions({
    description: value.description,
    topic: value.topic,
    answers: value.answers,
    visitorRef: ref,
  });
  return result.ok
    ? { source: "ai", data: result.data }
    : { source: "unavailable", reason: result.reason };
}

export async function draftBrief(
  raw: unknown,
  deps: AssistServiceDeps,
): Promise<AssistOutcome<BriefDraft>> {
  const checked = await guard(raw, deps);
  if (!checked.ok) return { source: "unavailable", reason: checked.reason };
  const { value, client, ref } = checked;
  const result = await client.brief({
    description: value.description,
    topic: value.topic,
    answers: value.answers,
    visitorRef: ref,
  });
  return result.ok
    ? { source: "ai", data: result.data }
    : { source: "unavailable", reason: result.reason };
}
