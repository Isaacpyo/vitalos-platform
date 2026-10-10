import type { ImageView, RichText, RichTextBlock } from "@vitalos/cms";
import { isSafeRelativeRedirect } from "@vitalos/security/url";
import { classifyImageUrl } from "./images";

/**
 * Framework-free model of a rich-text field: portable-text-like blocks are normalised into a
 * small tree that `components/rich-text.tsx` renders. Everything unsafe or unknown is dropped
 * here, so the component only ever sees renderable, vetted nodes.
 *
 * Supported blocks: normal paragraphs, h2/h3/h4 (an h1 in content is downgraded to h2 so a page
 * keeps exactly one h1), blockquote, bullet/number lists (nested), and the custom blocks
 * `callout`, `pullQuote` (attribution required), `codeBlock` and `figure` (alt required).
 * Marks: strong, em, code, links (https or same-site paths only).
 * `dataTable` is supported: the caption is required (it is the table's accessible name), there must
 * be at least two non-blank column headings, every row needs exactly one cell per column, and the
 * first cell of each row must be non-blank because it becomes the row header. A table that fails
 * any of these is dropped (never rendered unlabelled or ragged) and, outside production, logged.
 */

export interface InlineNode {
  text: string;
  strong?: true;
  em?: true;
  code?: true;
  /** Vetted: https URL or same-site path. */
  href?: string;
}

export interface ListItemNode {
  children: InlineNode[];
  lists: ListNode[];
}
export interface ListNode {
  type: "list";
  key: string;
  ordered: boolean;
  items: ListItemNode[];
}

export type RichTextNode =
  | { type: "paragraph"; key: string; children: InlineNode[] }
  | { type: "heading"; key: string; level: 2 | 3 | 4; children: InlineNode[] }
  | { type: "blockquote"; key: string; children: InlineNode[] }
  | ListNode
  | { type: "callout"; key: string; title?: string; text: string }
  | { type: "pullQuote"; key: string; quote: string; attribution: string }
  | { type: "codeBlock"; key: string; code: string; language?: string }
  | { type: "figure"; key: string; image: ImageView; caption?: string }
  | DataTableNode;

export interface DataTableNode {
  type: "dataTable";
  key: string;
  caption: string;
  /** At least two headings; the first heads the row-header column. */
  columns: [string, string, ...string[]];
  /** One entry per row, each with exactly `columns.length` cells; cell 0 is the row header. */
  rows: string[][];
}

const asString = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim() !== "" ? value : undefined;

const asRecord = (value: unknown): Record<string, unknown> | undefined =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;

/** https URLs and same-site absolute paths only; no javascript:, data:, mailto: or `//host`. */
export function isSafeLink(href: string): boolean {
  if (href.startsWith("/")) return isSafeRelativeRedirect(href);
  if (!URL.canParse(href)) return false;
  const url = new URL(href);
  return url.protocol === "https:" && !url.username && !url.password;
}

function inlineNodes(block: RichTextBlock): InlineNode[] {
  const markDefs = new Map<string, string>();
  const defs = Array.isArray(block["markDefs"]) ? (block["markDefs"] as unknown[]) : [];
  for (const def of defs) {
    const record = asRecord(def);
    const key = asString(record?.["_key"]);
    const href = asString(record?.["href"]);
    if (key && href && isSafeLink(href)) markDefs.set(key, href);
  }
  const children = Array.isArray(block["children"]) ? (block["children"] as unknown[]) : [];
  const out: InlineNode[] = [];
  for (const child of children) {
    const span = asRecord(child);
    const text = typeof span?.["text"] === "string" ? span["text"] : "";
    if (text === "") continue;
    const node: InlineNode = { text };
    const marks = Array.isArray(span?.["marks"]) ? (span["marks"] as unknown[]) : [];
    for (const mark of marks) {
      if (mark === "strong") node.strong = true;
      else if (mark === "em") node.em = true;
      else if (mark === "code") node.code = true;
      else if (typeof mark === "string" && markDefs.has(mark)) node.href = markDefs.get(mark)!;
    }
    out.push(node);
  }
  return out;
}

const plainText = (nodes: readonly InlineNode[]) => nodes.map((node) => node.text).join("");

/** Plain text of a rich-text value (paragraph per block). Used for structured data and summaries. */
export function richTextToPlainText(blocks: RichText): string {
  const parts: string[] = [];
  for (const block of blocks) {
    if (block._type === "block") {
      const text = plainText(inlineNodes(block)).trim();
      if (text) parts.push(text);
    } else if (block._type === "callout") {
      const text = asString(block["text"]);
      if (text) parts.push(text);
    }
  }
  return parts.join("\n\n");
}

function devWarn(message: string) {
  if (process.env["NODE_ENV"] !== "production") console.warn(`[rich-text] ${message}`);
}

function dataTableNode(block: RichTextBlock, key: string): DataTableNode | undefined {
  const caption = asString(block["caption"])?.trim();
  if (!caption) {
    devWarn(`dataTable "${key}" skipped: a caption is required.`);
    return undefined;
  }
  const rawColumns = Array.isArray(block["columns"]) ? (block["columns"] as unknown[]) : [];
  const columns = rawColumns.map((column) => asString(column)?.trim() ?? "");
  if (columns.length < 2 || columns.some((column) => column === "")) {
    devWarn(`dataTable "${key}" skipped: needs at least two non-blank column headings.`);
    return undefined;
  }
  const rawRows = Array.isArray(block["rows"]) ? (block["rows"] as unknown[]) : [];
  const rows: string[][] = [];
  for (const rawRow of rawRows) {
    const rawCells = asRecord(rawRow)?.["cells"];
    const cells = Array.isArray(rawCells)
      ? rawCells.map((cell) => (typeof cell === "string" ? cell.trim() : ""))
      : [];
    if (cells.length !== columns.length || cells[0] === "") {
      devWarn(`dataTable "${key}" skipped: every row needs one cell per column and a row header.`);
      return undefined;
    }
    rows.push(cells);
  }
  if (rows.length === 0) {
    devWarn(`dataTable "${key}" skipped: no rows.`);
    return undefined;
  }
  return { type: "dataTable", key, caption, columns: columns as DataTableNode["columns"], rows };
}

function blockKey(block: RichTextBlock, index: number): string {
  return typeof block._key === "string" ? block._key : `block-${index}`;
}

function toListItem(children: InlineNode[]): ListItemNode {
  return { children, lists: [] };
}

/** Normalises blocks into renderable nodes; unknown or unsafe blocks are dropped. */
export function normaliseRichText(blocks: RichText | undefined | null): RichTextNode[] {
  const out: RichTextNode[] = [];
  // Open list per nesting level while consecutive list blocks are folded together.
  let stack: { level: number; list: ListNode; last: ListItemNode | undefined }[] = [];
  const closeLists = () => {
    stack = [];
  };

  (blocks ?? []).forEach((block, index) => {
    const key = blockKey(block, index);

    if (block._type === "block") {
      const children = inlineNodes(block);
      if (children.length === 0) return;

      const listItem = block["listItem"];
      if (listItem === "bullet" || listItem === "number") {
        const ordered = listItem === "number";
        const level =
          typeof block["level"] === "number" && block["level"] >= 1 ? block["level"] : 1;
        // Pop deeper (or mismatched) lists.
        while (stack.length > 0) {
          const top = stack[stack.length - 1]!;
          if (top.level > level || (top.level === level && top.list.ordered !== ordered)) {
            stack.pop();
          } else break;
        }
        const item = toListItem(children);
        const top = stack[stack.length - 1];
        if (top && top.level === level) {
          top.list.items.push(item);
          top.last = item;
        } else {
          const list: ListNode = { type: "list", key, ordered, items: [item] };
          if (top?.last) top.last.lists.push(list);
          else out.push(list);
          stack.push({ level, list, last: item });
        }
        return;
      }

      closeLists();
      const style = asString(block["style"]) ?? "normal";
      if (style === "h1" || style === "h2") {
        out.push({ type: "heading", key, level: 2, children });
      } else if (style === "h3") {
        out.push({ type: "heading", key, level: 3, children });
      } else if (style === "h4") {
        out.push({ type: "heading", key, level: 4, children });
      } else if (style === "blockquote") {
        out.push({ type: "blockquote", key, children });
      } else {
        out.push({ type: "paragraph", key, children });
      }
      return;
    }

    closeLists();
    switch (block._type) {
      case "callout": {
        const body = Array.isArray(block["body"])
          ? richTextToPlainText(block["body"] as RichText)
          : "";
        const text = asString(block["text"]) ?? asString(body);
        if (!text) return;
        const title = asString(block["title"]);
        out.push({ type: "callout", key, text, ...(title ? { title } : {}) });
        return;
      }
      case "pullQuote": {
        const quote = asString(block["quote"]) ?? asString(block["text"]);
        const attribution = asString(block["attribution"]);
        // No anonymous quotes (Stage 8 §8, Stage 11): a quote without attribution is dropped.
        if (quote && attribution) out.push({ type: "pullQuote", key, quote, attribution });
        return;
      }
      case "codeBlock": {
        const code = asString(block["code"]);
        const language = asString(block["language"]);
        if (code) out.push({ type: "codeBlock", key, code, ...(language ? { language } : {}) });
        return;
      }
      case "figure": {
        const image = asRecord(block["image"]);
        const url = asString(image?.["url"]);
        const alt = typeof image?.["alt"] === "string" ? image["alt"] : "";
        const width = Number(image?.["width"]);
        const height = Number(image?.["height"]);
        if (!url || !classifyImageUrl(url) || alt.trim() === "" || !(width > 0) || !(height > 0)) {
          return;
        }
        const caption = asString(block["caption"]);
        out.push({
          type: "figure",
          key,
          image: { url, alt, width, height },
          ...(caption ? { caption } : {}),
        });
        return;
      }
      case "dataTable": {
        const table = dataTableNode(block, key);
        if (table) out.push(table);
        return;
      }
      default:
        return;
    }
  });

  return out;
}
