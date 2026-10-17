import type { MatchedChunk, RelayStore } from "../db/types";
import { PROMPT_BUDGET, estimateTokens, truncateToTokens } from "../llm/budget";
import type { Embedder } from "./embed";
import { correctSpelling } from "./spelling";

export interface RetrievalOptions {
  question: string;
  /** The previous visitor question, used for short follow-ups ("how long would that take?"). */
  previousQuestion?: string | null;
  pagePath?: string | null;
  simFloor: number;
  threshold: number;
  matchCount?: number;
  maxContextTokens?: number;
  embedTimeoutMs?: number;
  pageBonus?: number;
}

export interface RetrievalResult {
  query: string;
  /** Spelling corrections applied to the query (`[from, to]` pairs), for admins and evals. */
  corrections: [string, string][];
  chunks: MatchedChunk[];
  confidence: number;
  confident: boolean;
  /** Embeddings were available for this query. */
  semantic: boolean;
  topSimilarity: number | null;
  ftsMatched: boolean;
}

const PRONOUNS = /\b(it|that|this|they|them|those|these|its|there|one|he|she)\b/i;

/** Short follow-ups that lean on the previous question are searched together with it. */
export function composeQuery(question: string, previous?: string | null): string {
  const words = question.trim().split(/\s+/).filter(Boolean);
  // Up to ten words: "so how can I modernise my system with this?" is still a follow-up.
  if (previous && words.length <= 10 && PRONOUNS.test(question))
    return `${previous.trim()} ${question.trim()}`;
  return question.trim();
}

/**
 * Full-text-only confidence (no embeddings): ts_rank_cd of the best chunk mapped to [0, 1].
 * Calibrated with `pnpm relay:eval --retrieval` on the bundled knowledge (ADR-037): ranks at or
 * above FTS_RANK_FULL map to 1; a bare match maps to FTS_RANK_BASE.
 */
export const FTS_RANK_FULL = 0.5;
export const FTS_RANK_BASE = 0.4;

export function ftsConfidence(rank: number | null): number {
  if (!rank || rank <= 0) return 0;
  return Math.min(1, FTS_RANK_BASE + (1 - FTS_RANK_BASE) * Math.min(1, rank / FTS_RANK_FULL));
}

/** Semantic confidence: similarity normalised from [floor, 1] to [0, 1], +0.1 with a full-text match. */
export function semanticConfidence(
  similarity: number | null,
  simFloor: number,
  ftsMatched: boolean,
): number {
  if (similarity === null) return 0;
  const normalised = Math.max(
    0,
    Math.min(1, (similarity - simFloor) / Math.max(1e-6, 1 - simFloor)),
  );
  return Math.min(1, normalised + (ftsMatched ? 0.1 : 0));
}

/** Estimated prompt tokens of one source as `buildUserMessage` renders it (label line + text). */
export function chunkPromptTokens(c: MatchedChunk): number {
  return estimateTokens(`[0] ${c.title} (${c.type}) ${c.url ?? ""}\n${c.heading}\n${c.content}`);
}

/**
 * Keeps sources within the budget (ADR-048). Each chunk is first cut to `chunkTokens`, so no single
 * chunk can take the whole budget; a chunk that would still overflow is skipped, not kept, and a
 * smaller one after it may still fit. Rank order is preserved.
 */
export function trimToBudget(
  chunks: readonly MatchedChunk[],
  maxTokens: number,
  chunkTokens: number = PROMPT_BUDGET.chunkTokens,
): MatchedChunk[] {
  const out: MatchedChunk[] = [];
  let used = 0;
  for (const original of chunks) {
    const c =
      chunkPromptTokens(original) > chunkTokens
        ? { ...original, content: truncateToTokens(original.content, chunkTokens - 40) }
        : original;
    const tokens = chunkPromptTokens(c);
    if (used + tokens > maxTokens) continue;
    out.push(c);
    used += tokens;
  }
  return out;
}

/**
 * One chunk per document first, in rank order, then the remaining chunks in rank order. Stops a
 * long page from filling the top slots (and the three citations) with near-duplicate chunks.
 */
export function diversify(chunks: readonly MatchedChunk[], limit: number): MatchedChunk[] {
  const seen = new Set<string>();
  const firsts: MatchedChunk[] = [];
  const rest: MatchedChunk[] = [];
  for (const c of chunks) {
    if (seen.has(c.documentId)) rest.push(c);
    else {
      seen.add(c.documentId);
      firsts.push(c);
    }
  }
  return [...firsts, ...rest].slice(0, limit);
}

/** Hybrid retrieval with confidence (ADR-037). Embedding failures fall back to full text. */
export async function retrieve(
  store: RelayStore,
  embedder: Embedder,
  options: RetrievalOptions,
): Promise<RetrievalResult> {
  const composed = composeQuery(options.question, options.previousQuestion);
  // Typo tolerance (ADR-048): words that are not in the published knowledge are corrected to the
  // nearest known word ("soultions" -> "solutions") before both rankings run.
  const vocabulary = await store.kbVocabulary();
  const spelling = correctSpelling(composed, vocabulary);
  const query = spelling.text;
  const embedding = embedder.enabled
    ? ((await embedder.embed([query], { timeoutMs: options.embedTimeoutMs ?? 800 }))?.[0] ?? null)
    : null;
  const matched = await store.matchChunks({
    queryText: query,
    embedding,
    // Over-fetch so diversify() can still return `matchCount` distinct documents.
    matchCount: (options.matchCount ?? PROMPT_BUDGET.maxChunks) * 2,
    pagePath: options.pagePath ?? null,
    pageBonus: options.pageBonus ?? 0.25,
  });
  const chunks = trimToBudget(
    diversify(matched, Math.min(8, options.matchCount ?? PROMPT_BUDGET.maxChunks)),
    options.maxContextTokens ?? PROMPT_BUDGET.sourceTokens,
  );
  const top = chunks[0];
  const topSimilarity = chunks.reduce<number | null>(
    (best, c) =>
      c.similarity !== null && (best === null || c.similarity > best) ? c.similarity : best,
    null,
  );
  const ftsMatched = Boolean(top && top.ftsRank !== null && top.ftsRank > 0);
  const confidence = embedding
    ? semanticConfidence(topSimilarity, options.simFloor, ftsMatched)
    : ftsConfidence(top?.ftsRank ?? null);
  return {
    query,
    corrections: spelling.corrections,
    chunks,
    confidence,
    confident: chunks.length > 0 && confidence >= options.threshold,
    semantic: embedding !== null,
    topSimilarity,
    ftsMatched,
  };
}
