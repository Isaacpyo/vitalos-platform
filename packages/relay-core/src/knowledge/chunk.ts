/**
 * Markdown chunking for retrieval (ADR-037): split by headings, keep the heading path, cap each
 * chunk at about 300 words with about 40 words of overlap.
 */
export interface Chunk {
  ix: number;
  heading: string;
  content: string;
  tokenCount: number;
}

export const MAX_WORDS = 300;
export const OVERLAP_WORDS = 40;

const wordCount = (text: string) => (text.match(/\S+/g) ?? []).length;

/** Rough token estimate for English prose (about 1.33 tokens per word). */
export const estimateTokens = (text: string) => Math.ceil(wordCount(text) * 1.33);

interface Section {
  path: string[];
  lines: string[];
}

function sections(title: string, body: string): Section[] {
  const out: Section[] = [];
  let path: string[] = [title];
  let current: Section = { path, lines: [] };
  for (const raw of body.replace(/\r\n?/g, "\n").split("\n")) {
    const heading = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(raw);
    if (heading) {
      if (current.lines.join("").trim()) out.push(current);
      const level = (heading[1] as string).length;
      const text = (heading[2] as string).trim();
      // `#` is the document title itself; deeper levels nest under it.
      path = level <= 1 ? [title] : [...path.slice(0, Math.max(1, level - 1)), text];
      current = { path, lines: [] };
      continue;
    }
    current.lines.push(raw);
  }
  if (current.lines.join("").trim()) out.push(current);
  return out;
}

function windows(words: string[]): string[] {
  if (words.length <= MAX_WORDS) return [words.join(" ")];
  const out: string[] = [];
  const step = MAX_WORDS - OVERLAP_WORDS;
  for (let start = 0; start < words.length; start += step) {
    out.push(words.slice(start, start + MAX_WORDS).join(" "));
    if (start + MAX_WORDS >= words.length) break;
  }
  return out;
}

/** Splits a markdown document into retrieval chunks. Empty documents yield no chunks. */
export function chunkMarkdown(title: string, body: string): Chunk[] {
  const chunks: Chunk[] = [];
  for (const section of sections(title, body)) {
    const text = section.lines
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
    if (!text) continue;
    const heading = section.path.join(" › ");
    for (const content of windows(text.split(/\s+/))) {
      chunks.push({ ix: chunks.length, heading, content, tokenCount: estimateTokens(content) });
    }
  }
  return chunks;
}

/** Text sent to the embedding model for a chunk (ADR-037): "{title} — {heading}: {content}". */
export function embeddingInput(title: string, heading: string, content: string): string {
  const lastHeading = heading.split(" › ").at(-1) ?? heading;
  const prefix = lastHeading && lastHeading !== title ? `${title} — ${lastHeading}` : title;
  return `${prefix}: ${content}`.slice(0, 7900);
}
