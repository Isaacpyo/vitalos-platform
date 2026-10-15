/**
 * LLM provider port (ADR-032). The widget and the API never depend on a concrete provider, so a
 * UK/EU-hosted model can replace DeepSeek by adding one adapter.
 */
export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export interface StreamAnswerInput {
  system: string;
  messages: ChatTurn[];
  model: string;
  abortSignal: AbortSignal;
  /** Opaque, non-personal id for provider-side request isolation (a hash). */
  userRef?: string;
}

export interface Usage {
  inputTokens: number;
  outputTokens: number;
  cacheHitTokens: number;
}

export type StreamEvent =
  | { type: "delta"; text: string }
  | { type: "done"; usage: Usage }
  | { type: "error"; code: "timeout" | "rate_limited" | "unavailable" | "aborted" };

export interface SummaryInput {
  system: string;
  transcript: string;
  model: string;
  abortSignal: AbortSignal;
}

export interface SummaryOutput {
  summary: string;
  intent:
    | "service_enquiry"
    | "project_help"
    | "pricing"
    | "partnership"
    | "careers"
    | "support"
    | "other";
  sector:
    | "health_care"
    | "retail_commerce_consumer"
    | "operations_industry_logistics"
    | "growth_technology"
    | null;
  urgency: "low" | "normal" | "high";
}

export interface LlmProvider {
  readonly name: "deepseek" | "mock";
  streamAnswer(input: StreamAnswerInput): AsyncIterable<StreamEvent>;
  generateSummary(input: SummaryInput): Promise<{ output: SummaryOutput; usage: Usage } | null>;
}

/** Timeouts (section 6.1). */
export const FIRST_TOKEN_TIMEOUT_MS = 15_000;
export const TOTAL_TIMEOUT_MS = 45_000;
export const TEMPERATURE = 0.3;
export const MAX_OUTPUT_TOKENS = 700;

/** Price table per million tokens (deepseek-flash, checked 15 Oct 2026). Peak: 01-04 and 06-10 UTC on weekdays. */
export const PRICES = {
  "deepseek-flash": {
    offPeak: { cacheHit: 0.003, cacheMiss: 0.15, output: 0.6 },
    peak: { cacheHit: 0.006, cacheMiss: 0.3, output: 1.2 },
  },
} as const;

export function isPeak(now: Date): boolean {
  const day = now.getUTCDay();
  if (day === 0 || day === 6) return false;
  const h = now.getUTCHours();
  return (h >= 1 && h < 4) || (h >= 6 && h < 10);
}

/** Estimated cost in USD; unknown models are priced as deepseek-flash. */
export function estimateCostUsd(usage: Usage, model: string, now: Date): number {
  const table = PRICES[model as keyof typeof PRICES] ?? PRICES["deepseek-flash"];
  const p = isPeak(now) ? table.peak : table.offPeak;
  const miss = Math.max(0, usage.inputTokens - usage.cacheHitTokens);
  return (
    (usage.cacheHitTokens * p.cacheHit + miss * p.cacheMiss + usage.outputTokens * p.output) /
    1_000_000
  );
}
