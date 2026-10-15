import type { MatchedChunk, RelayStore } from "../db/types";
import type { Embedder } from "./embed";

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
  if (previous && words.length < 8 && PRONOUNS.test(question))
    return `${previous.trim()} ${question.trim()}`;
  return question.trim();
}

/**
 * Full-text-only confidence (no embeddings): ts_rank_cd of the best chunk mapped to [0, 1].
 * Calibrated with `pnpm relay:eval --retrieval` on the bundled knowledge (ADR-033): ranks at or
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

function trimToBudget(chunks: MatchedChunk[], maxTokens: number): MatchedChunk[] {
  const out: MatchedChunk[] = [];
  let used = 0;
  for (const c of chunks) {
    const tokens = Math.ceil(
      (c.content.split(/\s+/).length + c.heading.split(/\s+/).length) * 1.33,
    );
    if (out.length > 0 && used + tokens > maxTokens) break;
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

/** Hybrid retrieval with confidence (ADR-033). Embedding failures fall back to full text. */
export async function retrieve(
  store: RelayStore,
  embedder: Embedder,
  options: RetrievalOptions,
): Promise<RetrievalResult> {
  const query = composeQuery(options.question, options.previousQuestion);
  const embedding = embedder.enabled
    ? ((await embedder.embed([query], { timeoutMs: options.embedTimeoutMs ?? 800 }))?.[0] ?? null)
    : null;
  const matched = await store.matchChunks({
    queryText: query,
    embedding,
    // Over-fetch so diversify() can still return `matchCount` distinct documents.
    matchCount: (options.matchCount ?? 6) * 2,
    pagePath: options.pagePath ?? null,
    pageBonus: options.pageBonus ?? 0.25,
  });
  const chunks = trimToBudget(
    diversify(matched, options.matchCount ?? 6),
    options.maxContextTokens ?? 2400,
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
    chunks,
    confidence,
    confident: chunks.length > 0 && confidence >= options.threshold,
    semantic: embedding !== null,
    topSimilarity,
    ftsMatched,
  };
}
