import type { ChatTurn } from "./provider";

/**
 * Prompt budget per model call (ADR-048, finding D1). Every turn sends the byte-stable system
 * prompt, a short history window, the retrieved sources and the question; nothing else. The
 * numbers are estimates in tokens and deliberately conservative, so the real count stays below
 * `total` (target: at most 8,000 input tokens per turn).
 */
export const PROMPT_BUDGET = {
  /** Hard ceiling for the whole request (system + history + context, sources and question). */
  total: 8_000,
  /** Earlier turns sent with the question. */
  historyTokens: 2_000,
  historyTurns: 8,
  /** One earlier turn (a long answer or pasted text) never takes more than this. */
  turnTokens: 600,
  /** All retrieved sources together. */
  sourceTokens: 2_400,
  /** One source chunk. Longer chunks are cut at a word boundary. */
  chunkTokens: 450,
  /** Retrieved chunks, at most. */
  maxChunks: 6,
} as const;

const words = (text: string) => (text.match(/\S+/g) ?? []).length;

/**
 * Conservative token estimate: the larger of about 1.33 tokens a word (English prose) and about
 * four characters a token (URLs, ids, punctuation and numbers count more than prose).
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.max(Math.ceil(words(text) * 1.33), Math.ceil(text.length / 4));
}

/** Cuts text to at most `maxTokens` (estimate), at a word boundary, marking the cut with "…". */
export function truncateToTokens(text: string, maxTokens: number): string {
  if (estimateTokens(text) <= maxTokens) return text;
  const parts = text.split(/(\s+)/);
  let out = "";
  for (const part of parts) {
    const next = out + part;
    if (estimateTokens(`${next} …`) > maxTokens) break;
    out = next;
  }
  return `${out.trimEnd()} …`;
}

/** Estimated input tokens of one model call (system prompt plus every message). */
export function estimatePromptTokens(system: string, messages: readonly ChatTurn[]): number {
  // About four tokens of framing per message (role markers) in OpenAI-compatible chat formats.
  return estimateTokens(system) + messages.reduce((n, m) => n + estimateTokens(m.content) + 4, 0);
}
