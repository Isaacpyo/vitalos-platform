import { z } from "zod";
import { signRequest } from "../../content/signing";
import type { SigningKey } from "../../content/signing";
import { cleanText, truncate } from "./text";
import type { BriefAnswer, BriefDraft, BriefQuestion, TopicSlug } from "./types";

/**
 * Client for the Super Admin's brief-assist endpoint (W6/W7 contract):
 *
 *     POST {base}/api/ai-data/brief-assist/   body: version 1, stage, description, topic,
 *                                             answers, visitor_ref
 *
 * Signed with the existing scheme v1 (`../../content/signing`), scope `assist`, using the read
 * key. Framework-free and injectable (fetch, clock) so it is tested with a fake. Nothing is
 * retried: anything but a valid 200 is "AI unavailable" and the caller uses the checklist.
 *
 * No logging of bodies, headers or the visitor's text. The raw IP never reaches this module:
 * the caller passes `visitorRef`, an HMAC.
 */

export const ASSIST_PATH = "/api/ai-data/brief-assist/";
export const ASSIST_TIMEOUT_MS = 20_000;

export type AssistFailure =
  "not-configured" | "rate-limited" | "unavailable" | "timeout" | "invalid" | "busy";

export type AssistResult<T> = { ok: true; data: T } | { ok: false; reason: AssistFailure };

const text = (max: number) =>
  z
    .string()
    .transform((value) => truncate(cleanText(value), max))
    .pipe(z.string().min(1));

const questionsResponse = z.object({
  mode: z.literal("ai"),
  questions: z
    .array(
      z.object({
        id: z.string().regex(/^[A-Za-z0-9_-]{1,20}$/),
        question: text(300),
        why: text(300).optional().catch(undefined),
        suggestions: z
          .array(text(80))
          .max(8)
          .transform((items) => items.slice(0, 4))
          .optional()
          .catch(undefined),
      }),
    )
    .min(2)
    .max(4),
});

const list = (max: number, itemMax: number) =>
  z
    .array(text(itemMax))
    .max(12)
    .transform((items) => items.slice(0, max));

const briefResponse = z.object({
  mode: z.literal("ai"),
  brief: z.object({
    current_workflow: text(900),
    desired_outcome: text(900),
    possible_automation: list(6, 200),
    unknowns: list(6, 200),
    suggested_next_step: text(500),
  }),
});

export interface AssistRequest {
  stage: "questions" | "brief";
  description: string;
  topic: TopicSlug | null;
  answers: readonly BriefAnswer[];
  visitorRef: string;
}

export interface BriefAssistClientDeps {
  baseUrl: string;
  key: SigningKey;
  fetch?: typeof fetch;
  now?: () => number;
  timeoutMs?: number;
}

export interface BriefAssistClient {
  questions(request: Omit<AssistRequest, "stage">): Promise<AssistResult<BriefQuestion[]>>;
  brief(request: Omit<AssistRequest, "stage">): Promise<AssistResult<BriefDraft>>;
}

export function createBriefAssistClient(deps: BriefAssistClientDeps): BriefAssistClient {
  const fetchImpl = deps.fetch ?? fetch;
  const now = deps.now ?? (() => Math.floor(Date.now() / 1000));
  const base = deps.baseUrl.replace(/\/+$/, "");

  async function call(request: AssistRequest): Promise<AssistResult<unknown>> {
    const body = JSON.stringify({
      version: 1,
      stage: request.stage,
      description: request.description,
      topic: request.topic,
      answers: request.answers.map(({ id, question, answer }) => ({ id, question, answer })),
      visitor_ref: request.visitorRef,
    });
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), deps.timeoutMs ?? ASSIST_TIMEOUT_MS);
    try {
      const response = await fetchImpl(`${base}${ASSIST_PATH}`, {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
          ...signRequest({
            key: deps.key,
            scope: "assist",
            method: "POST",
            pathAndQuery: ASSIST_PATH,
            body,
            timestamp: now(),
          }),
        },
        body,
        signal: controller.signal,
        cache: "no-store",
        redirect: "error",
      });
      if (response.status === 429) return { ok: false, reason: "rate-limited" };
      if (response.status === 503) return { ok: false, reason: "unavailable" };
      if (response.status !== 200) return { ok: false, reason: "invalid" };
      try {
        return { ok: true, data: await response.json() };
      } catch {
        return { ok: false, reason: "invalid" };
      }
    } catch (error) {
      const aborted = error instanceof Error && error.name === "AbortError";
      return { ok: false, reason: aborted ? "timeout" : "unavailable" };
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    async questions(request) {
      const result = await call({ ...request, stage: "questions" });
      if (!result.ok) return result;
      const parsed = questionsResponse.safeParse(result.data);
      if (!parsed.success) return { ok: false, reason: "invalid" };
      return {
        ok: true,
        data: parsed.data.questions.map((entry) => ({
          id: entry.id,
          question: entry.question,
          why: entry.why ?? "",
          suggestions: entry.suggestions ?? [],
        })),
      };
    },
    async brief(request) {
      const result = await call({ ...request, stage: "brief" });
      if (!result.ok) return result;
      const parsed = briefResponse.safeParse(result.data);
      if (!parsed.success) return { ok: false, reason: "invalid" };
      const { brief } = parsed.data;
      return {
        ok: true,
        data: {
          currentWorkflow: brief.current_workflow,
          desiredOutcome: brief.desired_outcome,
          possibleAutomation: brief.possible_automation,
          unknowns: brief.unknowns,
          suggestedNextStep: brief.suggested_next_step,
        },
      };
    },
  };
}
