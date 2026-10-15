import type { Citation, NextStep, SourceType } from "../contract";
import type { MatchedChunk, StoredCitation } from "../db/types";

export const MAX_CITATIONS = 3;

const TYPE_TAG: Record<string, SourceType> = {
  offer: "OFFER",
  solution: "SOLUTION",
  practice: "PRACTICE",
  industry: "INDUSTRY",
  page: "PAGE",
  guide: "GUIDE",
  policy: "PAGE",
  company: "PAGE",
  faq: "FAQ",
};

export function sourceTypeOf(chunk: Pick<MatchedChunk, "source" | "type">): SourceType {
  return chunk.source === "faq" ? "FAQ" : (TYPE_TAG[chunk.type] ?? "PAGE");
}

/** Citation link: FAQ entries use their canonical path; others their page URL. */
export function linkOf(chunk: MatchedChunk): string | null {
  const link = chunk.source === "faq" ? (chunk.meta.canonical_path ?? null) : chunk.url;
  return link && link.startsWith("/") ? link : null;
}

/**
 * Keeps only citation numbers that exist in SOURCES, maps them to documents, de-duplicates by
 * document, keeps at most three, and renumbers the markers in the text to match the visible
 * source list (01, 02, 03). Markers that point nowhere are removed from the text.
 */
export function finaliseCitations(
  text: string,
  sources: readonly MatchedChunk[],
): { text: string; citations: StoredCitation[] } {
  const order: number[] = []; // original source numbers in order of first use, per document
  const docForN = new Map<number, string>();
  const renumber = new Map<string, number>(); // documentId -> new number
  const citations: StoredCitation[] = [];

  for (const m of text.matchAll(/\[(\d{1,2})\]/g)) {
    const n = Number(m[1]);
    const chunk = sources[n - 1];
    if (!chunk) continue;
    docForN.set(n, chunk.documentId);
    if (renumber.has(chunk.documentId) || citations.length >= MAX_CITATIONS) continue;
    order.push(n);
    renumber.set(chunk.documentId, citations.length + 1);
    citations.push({
      n: citations.length + 1,
      title: chunk.title,
      url: linkOf(chunk),
      type: sourceTypeOf(chunk),
      documentId: chunk.documentId,
      chunkId: chunk.chunkId,
    });
  }

  const rewritten = text
    .replace(/\[(\d{1,2})\]/g, (_, d: string) => {
      const doc = docForN.get(Number(d));
      const next = doc ? renumber.get(doc) : undefined;
      return next ? `[${next}]` : "";
    })
    // Collapse repeats such as "[1][1]" left by de-duplication.
    .replace(/(\[\d\])(?:\1)+/g, "$1")
    .replace(/ +([.,;:])/g, "$1")
    .replace(/ {2,}/g, " ")
    .trim();
  return { text: rewritten, citations };
}

/** Visitor-facing citations (no internal ids). */
export function publicCitations(citations: readonly StoredCitation[]): Citation[] {
  return citations.map(({ n, title, url, type }) => ({ n, title, url, type }));
}

/** NEXT STEP when the top cited source is a Master FAQ entry with a linked offer (follow-up §9). */
export function nextStepFor(
  citations: readonly StoredCitation[],
  sources: readonly MatchedChunk[],
): NextStep | null {
  const top = citations[0];
  if (!top) return null;
  const chunk = sources.find((s) => s.documentId === top.documentId);
  if (!chunk || chunk.source !== "faq") return null;
  return chunk.meta.next_step ?? null;
}
