import type { RichText, RichTextBlock } from "@vitalos/cms";
import { normaliseRichText } from "../../lib/cms/rich-text";
import type { InlineNode } from "../../lib/cms/rich-text";

/**
 * Splits an article body into renderable segments and derives the table of contents from its
 * headings. Headings and code blocks are lifted out (headings need ids for the contents links;
 * code blocks render through the CodeBlock island); every other block stays in order inside
 * rich-text segments, so lists remain folded and nothing is rewritten.
 *
 * Pure and framework-free. Content is never invented: headings keep their own text, and the
 * contents list is simply those headings.
 */

export type ArticleSegment =
  | { type: "blocks"; key: string; blocks: RichTextBlock[] }
  | { type: "heading"; key: string; id: string; level: 2 | 3 | 4; text: string }
  | { type: "code"; key: string; code: string; language?: string };

export interface ArticleTocEntry {
  id: string;
  label: string;
  level: 2 | 3;
}

export interface ArticleBodyModel {
  segments: ArticleSegment[];
  toc: ArticleTocEntry[];
}

/** A contents list is shown from this many headings (long pieces only). */
export const TOC_MIN_ENTRIES = 3;

/** Ids the page itself uses; headings must never collide with them. */
const RESERVED_IDS: ReadonlySet<string> = new Set(["main", "authors", "related", "contents"]);

const plain = (nodes: readonly InlineNode[]) =>
  nodes
    .map((node) => node.text)
    .join("")
    .trim();

export function slugifyHeading(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function buildArticleBody(body: RichText): ArticleBodyModel {
  const segments: ArticleSegment[] = [];
  const toc: ArticleTocEntry[] = [];
  const used = new Set<string>(RESERVED_IDS);
  let pending: RichTextBlock[] = [];

  const flush = () => {
    if (pending.length === 0) return;
    segments.push({ type: "blocks", key: `blocks-${segments.length}`, blocks: pending });
    pending = [];
  };
  const uniqueId = (text: string, ordinal: number) => {
    const base = slugifyHeading(text) || `section-${ordinal}`;
    let id = base;
    for (let n = 2; used.has(id); n += 1) id = `${base}-${n}`;
    used.add(id);
    return id;
  };

  body.forEach((block, index) => {
    const [node, ...rest] = normaliseRichText([block]);
    if (node?.type === "heading" && rest.length === 0) {
      const text = plain(node.children);
      if (text === "") return;
      flush();
      const id = uniqueId(text, index + 1);
      segments.push({ type: "heading", key: `heading-${index}`, id, level: node.level, text });
      if (node.level !== 4) toc.push({ id, label: text, level: node.level });
      return;
    }
    if (node?.type === "codeBlock" && rest.length === 0) {
      flush();
      segments.push({
        type: "code",
        key: `code-${index}`,
        code: node.code,
        ...(node.language ? { language: node.language } : {}),
      });
      return;
    }
    pending.push(block);
  });
  flush();
  return { segments, toc };
}

/** The contents entries to show, or none when the piece is too short to need them. */
export const tocForDisplay = (model: ArticleBodyModel): ArticleTocEntry[] =>
  model.toc.length >= TOC_MIN_ENTRIES ? model.toc : [];
