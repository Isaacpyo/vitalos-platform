/**
 * Typo tolerance for retrieval (ADR-048, finding D2). A query word that does not occur in the
 * published knowledge is replaced by the nearest word that does, when one is close enough:
 * "what are your soultions?" searches for "solutions". Works the same for the memory store and
 * Postgres (the vocabulary comes from `RelayStore.kbVocabulary()`), and needs no extension.
 *
 * Conservative on purpose: words shorter than five letters are never changed, the first letter
 * must match, five to eight letters allow one edit (a swap of two neighbours counts as one) and
 * longer words two, and a tie between equally close candidates is broken by frequency.
 */
export type Vocabulary = ReadonlyMap<string, number>;

/** Lower-case words of three or more letters, with counts (the shape `kbVocabulary` returns). */
export function buildVocabulary(texts: Iterable<string>): Map<string, number> {
  const out = new Map<string, number>();
  for (const text of texts) {
    for (const w of text.toLowerCase().match(/[a-z]{3,}/g) ?? []) out.set(w, (out.get(w) ?? 0) + 1);
  }
  return out;
}

/** Words never corrected: question words and common English that the knowledge may not contain. */
const KEEP = new Set(
  (
    "about above after again against before being below between could doing during further " +
    "hello there their these those through under until where which while would yours yourself " +
    "thanks thank cheers goodbye please really should might maybe shall"
  ).split(" "),
);

/** Optimal string alignment distance (Damerau–Levenshtein without repeated edits), capped. */
export function editDistance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const rows = a.length + 1;
  const cols = b.length + 1;
  const d: number[][] = Array.from({ length: rows }, (_, i) =>
    Array.from({ length: cols }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );
  for (let i = 1; i < rows; i++) {
    let rowMin = Number.POSITIVE_INFINITY;
    for (let j = 1; j < cols; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const prev = d[i - 1] as number[];
      const row = d[i] as number[];
      let v = Math.min((prev[j] as number) + 1, (row[j - 1] as number) + 1, (prev[j - 1] as number) + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1])
        v = Math.min(v, ((d[i - 2] as number[])[j - 2] as number) + 1);
      row[j] = v;
      rowMin = Math.min(rowMin, v);
    }
    if (rowMin > max) return max + 1;
  }
  return (d[rows - 1] as number[])[cols - 1] as number;
}

const allowedEdits = (length: number) => (length < 5 ? 0 : length <= 8 ? 1 : 2);

/** The closest known word for `word`, or null when none is close enough. */
export function nearestWord(word: string, vocabulary: Vocabulary): string | null {
  const w = word.toLowerCase();
  const max = allowedEdits(w.length);
  if (max === 0 || vocabulary.has(w) || KEEP.has(w)) return null;
  let best: string | null = null;
  let bestDistance = max + 1;
  let bestCount = -1;
  for (const [candidate, count] of vocabulary) {
    if (candidate[0] !== w[0] || Math.abs(candidate.length - w.length) > max) continue;
    const distance = editDistance(w, candidate, max);
    if (distance < bestDistance || (distance === bestDistance && count > bestCount)) {
      best = candidate;
      bestDistance = distance;
      bestCount = count;
    }
  }
  return bestDistance <= max ? best : null;
}

/** Corrects every unknown word in `text`; returns the new text and the `[from, to]` pairs. */
export function correctSpelling(
  text: string,
  vocabulary: Vocabulary,
): { text: string; corrections: [string, string][] } {
  if (vocabulary.size === 0) return { text, corrections: [] };
  const corrections: [string, string][] = [];
  const out = text.replace(/[A-Za-z]+/g, (word) => {
    const fixed = nearestWord(word, vocabulary);
    if (!fixed) return word;
    corrections.push([word, fixed]);
    return fixed;
  });
  return { text: out, corrections };
}
