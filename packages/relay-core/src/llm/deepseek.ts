import "server-only";
import { createDeepSeek } from "@ai-sdk/deepseek";
import { generateText, Output, streamText } from "ai";
import { z } from "zod";
import type {
  LlmProvider,
  StreamAnswerInput,
  StreamEvent,
  SummaryInput,
  SummaryOutput,
  Usage,
} from "./provider";
import {
  FIRST_TOKEN_TIMEOUT_MS,
  MAX_OUTPUT_TOKENS,
  TEMPERATURE,
  TOTAL_TIMEOUT_MS,
} from "./provider";

/** Thinking is on by default in DeepSeek V4 models; Relay always turns it off (ADR-032). */
const NO_THINKING = { deepseek: { thinking: { type: "disabled" as const } } };

const summarySchema = z.object({
  summary: z.string().max(400),
  intent: z.enum([
    "service_enquiry",
    "project_help",
    "pricing",
    "partnership",
    "careers",
    "support",
    "other",
  ]),
  sector: z
    .enum([
      "health_care",
      "retail_commerce_consumer",
      "operations_industry_logistics",
      "growth_technology",
    ])
    .nullable(),
  urgency: z.enum(["low", "normal", "high"]),
});

function statusOf(error: unknown): number | undefined {
  const e = error as { statusCode?: unknown; cause?: { statusCode?: unknown } } | null;
  const code = e?.statusCode ?? e?.cause?.statusCode;
  return typeof code === "number" ? code : undefined;
}

function toUsage(
  u:
    | {
        inputTokens?: number | undefined;
        outputTokens?: number | undefined;
        inputTokenDetails?: { cacheReadTokens?: number | undefined };
      }
    | undefined,
): Usage {
  return {
    inputTokens: u?.inputTokens ?? 0,
    outputTokens: u?.outputTokens ?? 0,
    cacheHitTokens: u?.inputTokenDetails?.cacheReadTokens ?? 0,
  };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface DeepSeekOptions {
  apiKey: string;
  baseURL?: string;
  fetch?: typeof fetch;
}

/**
 * DeepSeek through the Vercel AI SDK (`@ai-sdk/deepseek`). No tools in the chat path; thinking
 * disabled; 15 s to first token and 45 s in total; one retry with jitter on 429/5xx before the
 * first token only.
 */
export class DeepSeekProvider implements LlmProvider {
  readonly name = "deepseek" as const;
  private readonly provider;

  constructor(options: DeepSeekOptions) {
    this.provider = createDeepSeek({
      apiKey: options.apiKey,
      baseURL: options.baseURL ?? "https://api.deepseek.com",
      ...(options.fetch ? { fetch: options.fetch } : {}),
    });
  }

  async *streamAnswer(input: StreamAnswerInput): AsyncIterable<StreamEvent> {
    for (let attempt = 0; attempt < 2; attempt++) {
      const controller = new AbortController();
      const onAbort = () => controller.abort();
      input.abortSignal.addEventListener("abort", onAbort, { once: true });
      let gotToken = false;
      let timedOut = false;
      const firstTimer = setTimeout(() => {
        if (!gotToken) {
          timedOut = true;
          controller.abort();
        }
      }, FIRST_TOKEN_TIMEOUT_MS);
      const totalTimer = setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, TOTAL_TIMEOUT_MS);
      try {
        const result = streamText({
          model: this.provider(input.model),
          system: input.system,
          messages: input.messages,
          temperature: TEMPERATURE,
          maxOutputTokens: MAX_OUTPUT_TOKENS,
          maxRetries: 0,
          abortSignal: controller.signal,
          providerOptions: input.userRef
            ? { deepseek: { ...NO_THINKING.deepseek, userId: input.userRef } }
            : NO_THINKING,
        });
        let usage: Usage = { inputTokens: 0, outputTokens: 0, cacheHitTokens: 0 };
        for await (const part of result.fullStream) {
          if (part.type === "text-delta") {
            if (part.text) {
              gotToken = true;
              yield { type: "delta", text: part.text };
            }
          } else if (part.type === "finish") {
            usage = toUsage(part.totalUsage);
          } else if (part.type === "error") {
            throw part.error;
          } else if (part.type === "abort") {
            throw new Error("aborted");
          }
        }
        yield { type: "done", usage };
        return;
      } catch (error) {
        if (input.abortSignal.aborted) {
          yield { type: "error", code: "aborted" };
          return;
        }
        if (timedOut) {
          yield { type: "error", code: "timeout" };
          return;
        }
        const status = statusOf(error);
        const retryable =
          !gotToken && attempt === 0 && (status === 429 || (status !== undefined && status >= 500));
        if (!retryable) {
          yield { type: "error", code: status === 429 ? "rate_limited" : "unavailable" };
          return;
        }
      } finally {
        clearTimeout(firstTimer);
        clearTimeout(totalTimer);
        input.abortSignal.removeEventListener("abort", onAbort);
      }
      await sleep(300 + Math.floor(Math.random() * 700));
    }
  }

  async generateSummary(
    input: SummaryInput,
  ): Promise<{ output: SummaryOutput; usage: Usage } | null> {
    try {
      const result = await generateText({
        model: this.provider(input.model),
        system: input.system,
        prompt: input.transcript,
        temperature: 0.2,
        maxOutputTokens: 300,
        maxRetries: 1,
        abortSignal: input.abortSignal,
        providerOptions: NO_THINKING,
        output: Output.object({ schema: summarySchema }),
      });
      const parsed = summarySchema.safeParse(result.output);
      if (!parsed.success) return null;
      const words = parsed.data.summary.split(/\s+/).slice(0, 40).join(" ");
      return { output: { ...parsed.data, summary: words }, usage: toUsage(result.usage) };
    } catch {
      return null;
    }
  }
}
