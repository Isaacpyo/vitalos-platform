import GithubSlugger from "github-slugger";
import type { Element, ElementContent, Root as HastRoot, Text } from "hast";
import { toString as hastToString } from "hast-util-to-string";
import type { Heading, Image, Root as MdastRoot } from "mdast";
import rehypeSanitize from "rehype-sanitize";
import rehypeStringify from "rehype-stringify";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";
import { SKIP, visit } from "unist-util-visit";
import { grammarFor, highlightToPre } from "./highlight";
import { sanitizeSchema } from "./sanitize-schema";

/**
 * The site's one Markdown renderer (brief 4.4, ADR-039): the admin previews through
 * `POST /api/content/render` and the pages render with the same function, so preview and
 * production cannot differ. Server-only by use (it is imported by route handlers and server
 * components only, and pulls Shiki).
 *
 * Pipeline: remark-parse + GFM (tables, footnotes, strikethrough, autolinks) → inspection of the
 * Markdown tree (warnings; h1 demoted; images checked against the media host and dropped when
 * they fail; raw HTML removed) → remark-rehype WITHOUT `allowDangerousHtml` → rehype-sanitize with
 * a strict allowlist → trusted structure (heading ids and TOC, callouts, table regions, figures,
 * link `rel`, Shiki highlighting) → HTML.
 *
 * Contexts: `post` gets the full feature set. `role`, `author` and `settings` get a smaller one:
 * no images (dropped with an `image_host` warning) and no syntax highlighting (plain code blocks);
 * headings, lists, links, tables, callouts and footnotes still render.
 */

export type RenderContext = "post" | "role" | "author" | "settings";

export type RenderWarningCode =
  "missing_alt" | "h1_in_body" | "image_host" | "html_stripped" | "heading_level";

export interface RenderWarning {
  code: RenderWarningCode;
  message: string;
  blocking: boolean;
}

export interface TocEntry {
  id: string;
  text: string;
  depth: 2 | 3 | 4;
}

export interface FaqEntry {
  question: string;
  answer: string;
}

export interface RenderResult {
  html: string;
  toc: TocEntry[];
  footnotes: number;
  warnings: RenderWarning[];
  /** The body's "Frequently asked questions" section, for FAQPage structured data (post context). */
  faq: FaqEntry[];
}

export interface RenderOptions {
  context: RenderContext;
  /** Origin images must come from (`CONTENT_MEDIA_HOST`); undefined allows no images. */
  mediaOrigin?: string | undefined;
  /** Hosts whose links are internal (same tab, no `rel`), e.g. `vitalos.co.uk`. */
  siteHosts?: readonly string[];
}

const blockingCodes: Record<RenderWarningCode, boolean> = {
  missing_alt: true,
  h1_in_body: true,
  image_host: true,
  html_stripped: false,
  heading_level: false,
};

const MAX_WARNINGS = 50;
const MAX_ID_LENGTH = 80;
const MAX_TOC_TEXT = 200;

class Warnings {
  readonly list: RenderWarning[] = [];
  private readonly seen = new Set<string>();
  add(code: RenderWarningCode, message: string): void {
    const key = `${code}:${message}`;
    if (this.seen.has(key) || this.list.length >= MAX_WARNINGS) return;
    this.seen.add(key);
    this.list.push({ code, message: message.slice(0, 300), blocking: blockingCodes[code] });
  }
}

// ---------------------------------------------------------------------------------------------
// Markdown tree (before HTML): warnings and the decisions that must happen before sanitising
// ---------------------------------------------------------------------------------------------

/** Whether an image URL is on the media host (https unless the host itself is http) and not SVG. */
export function isAllowedImage(url: string, mediaOrigin: string | undefined): boolean {
  if (!mediaOrigin || !URL.canParse(url)) return false;
  const parsed = new URL(url);
  if (parsed.origin !== mediaOrigin) return false;
  if (parsed.username || parsed.password) return false;
  return !/\.svgz?$/i.test(parsed.pathname);
}

function inspectMarkdown(tree: MdastRoot, options: RenderOptions, warnings: Warnings): void {
  const imagesAllowed = options.context === "post";

  // Reference-style images become plain images so one check covers both forms.
  const definitions = new Map<string, { url: string; title: string | null | undefined }>();
  visit(tree, "definition", (node) => {
    definitions.set(node.identifier, { url: node.url, title: node.title });
  });
  visit(tree, "imageReference", (node, index, parent) => {
    if (!parent || index === undefined) return;
    const definition = definitions.get(node.identifier);
    if (!definition) return;
    const image: Image = {
      type: "image",
      url: definition.url,
      alt: node.alt ?? "",
      title: definition.title ?? null,
    };
    parent.children.splice(index, 1, image);
  });

  let imageNumber = 0;
  visit(tree, "image", (node, index, parent) => {
    imageNumber += 1;
    if (!parent || index === undefined) return;
    if (!imagesAllowed) {
      warnings.add("image_host", "Images are not supported here; the image was removed.");
      parent.children.splice(index, 1);
      return [SKIP, index];
    }
    if (!isAllowedImage(node.url, options.mediaOrigin)) {
      warnings.add(
        "image_host",
        `Image ${imageNumber} is not on the media host (or is an SVG or data URI); it was removed.`,
      );
      parent.children.splice(index, 1);
      return [SKIP, index];
    }
    if (!node.alt || node.alt.trim() === "") {
      warnings.add("missing_alt", `Image ${imageNumber} has no alt text.`);
    }
    return undefined;
  });

  // Raw HTML is never rendered: remove it (with a warning) rather than let it reach the output.
  visit(tree, "html", (_node, index, parent) => {
    if (!parent || index === undefined) return;
    warnings.add("html_stripped", "HTML in the text was removed; use Markdown instead.");
    parent.children.splice(index, 1);
    return [SKIP, index];
  });

  // Paragraphs left empty by the removals above are dropped.
  visit(tree, "paragraph", (node, index, parent) => {
    if (!parent || index === undefined) return;
    if (node.children.every((child) => child.type === "text" && child.value.trim() === "")) {
      parent.children.splice(index, 1);
      return [SKIP, index];
    }
    return undefined;
  });

  // Headings: h1 is the page title (demoted, blocking); h5 and h6 become h4; skipped levels warn.
  let previous = 1;
  visit(tree, "heading", (node: Heading) => {
    if (node.depth === 1) {
      warnings.add("h1_in_body", "The text has a level 1 heading; the title is the only one.");
      node.depth = 2;
    } else if (node.depth > 4) {
      warnings.add("heading_level", "Headings below level 4 are shown as level 4.");
      node.depth = 4;
    }
    if (node.depth > previous + 1) {
      warnings.add("heading_level", `A level ${node.depth} heading skips a level.`);
    }
    previous = node.depth;
  });
}

// ---------------------------------------------------------------------------------------------
// HTML tree (after sanitising): trusted structure only
// ---------------------------------------------------------------------------------------------

const isElement = (node: unknown, tagName?: string): node is Element =>
  typeof node === "object" &&
  node !== null &&
  (node as Element).type === "element" &&
  (tagName === undefined || (node as Element).tagName === tagName);

const classList = (node: Element): string[] => {
  const value = node.properties["className"];
  return Array.isArray(value) ? value.map(String) : typeof value === "string" ? [value] : [];
};

const text = (value: string): Text => ({ type: "text", value });

const element = (
  tagName: string,
  properties: Element["properties"],
  children: ElementContent[],
): Element => ({ type: "element", tagName, properties, children });

function isInFootnotes(ancestors: Element[]): boolean {
  return ancestors.some((node) => node.tagName === "section" && node.properties["dataFootnotes"]);
}

/** Heading ids (stable, de-duplicated slugs) and the h2 to h4 table of contents. */
function addHeadingIds(tree: HastRoot): TocEntry[] {
  const slugger = new GithubSlugger();
  // Ids that already exist (footnotes) are reserved so a heading can never take one.
  visit(tree, "element", (node) => {
    const id = node.properties["id"];
    if (typeof id === "string") slugger.slug(id);
  });
  const toc: TocEntry[] = [];
  const walk = (node: Element | HastRoot, ancestors: Element[]) => {
    for (const child of node.children) {
      if (!isElement(child)) continue;
      const depth = /^h([2-4])$/.exec(child.tagName)?.[1];
      if (depth && !isInFootnotes(ancestors) && child.properties["id"] === undefined) {
        const label = hastToString(child).replace(/\s+/g, " ").trim();
        const base = slugger.slug(label.slice(0, MAX_ID_LENGTH)) || slugger.slug("section");
        child.properties["id"] = base.slice(0, 100);
        toc.push({
          id: base.slice(0, 100),
          text: label.slice(0, MAX_TOC_TEXT),
          depth: Number(depth) as 2 | 3 | 4,
        });
      }
      walk(child, [...ancestors, child]);
    }
  };
  walk(tree, []);
  return toc;
}

const calloutMarker = /^\s*\[!(NOTE|WARNING)\][ \t]*(?:\r?\n)?/i;

/** `> [!NOTE]` and `> [!WARNING]` blockquotes become labelled callouts. */
function addCallouts(tree: HastRoot): void {
  visit(tree, "element", (node) => {
    if (node.tagName !== "blockquote") return;
    const first = node.children.find((child) => isElement(child));
    if (!isElement(first, "p")) return;
    const lead = first.children[0];
    if (!lead || lead.type !== "text") return;
    const match = calloutMarker.exec(lead.value);
    if (!match) return;
    const kind = (match[1] as string).toLowerCase() as "note" | "warning";
    lead.value = lead.value.slice(match[0].length);
    if (lead.value === "") first.children.shift();
    // A marker on its own line leaves `<br>` or an empty paragraph behind: drop them.
    while (isElement(first.children[0], "br")) first.children.shift();
    const body =
      first.children.length === 0 ? node.children.filter((c) => c !== first) : node.children;
    node.tagName = "div";
    node.properties = { className: ["callout", `callout-${kind}`], role: "note" };
    node.children = [
      element("p", { className: ["callout-title"] }, [text(kind === "note" ? "Note" : "Warning")]),
      ...body,
    ];
  });
}

/** Tables scroll inside a labelled, focusable region. */
function wrapTables(tree: HastRoot): void {
  visit(tree, "element", (node, index, parent) => {
    if (node.tagName !== "table" || !parent || index === undefined) return;
    parent.children[index] = element(
      "div",
      { className: ["table-scroll"], role: "region", ariaLabel: "Table", tabIndex: 0 },
      [node],
    );
    return [SKIP, index + 1];
  });
}

/**
 * Dimensions the admin stores at upload travel as a URL fragment: `…/{uuid}.jpg#w=1600&h=900`.
 * Returns the URL without its fragment and, when both are positive integers up to 10000, the
 * dimensions. Anything else in the fragment is ignored (and dropped with it).
 */
export function imageDimensions(src: string): { src: string; width?: number; height?: number } {
  const hashAt = src.indexOf("#");
  if (hashAt === -1) return { src };
  const params = new URLSearchParams(src.slice(hashAt + 1));
  const read = (key: string) => {
    const value = params.get(key);
    if (!value || !/^[1-9][0-9]{0,4}$/.test(value)) return undefined;
    const number = Number(value);
    return number <= 10_000 ? number : undefined;
  };
  const width = read("w");
  const height = read("h");
  return {
    src: src.slice(0, hashAt),
    ...(width !== undefined && height !== undefined ? { width, height } : {}),
  };
}

/**
 * Images: lazy, async decoding, stored dimensions when known (no layout shift); a standalone
 * image with a title becomes a captioned figure.
 */
function shapeImages(tree: HastRoot, mediaOrigin: string | undefined): void {
  visit(tree, "element", (node, index, parent) => {
    if (node.tagName !== "img" || !parent || index === undefined) return;
    const src = node.properties["src"];
    if (typeof src !== "string" || !isAllowedImage(src, mediaOrigin)) {
      parent.children.splice(index, 1);
      return [SKIP, index];
    }
    const title = node.properties["title"];
    const alt = typeof node.properties["alt"] === "string" ? node.properties["alt"] : "";
    const sized = imageDimensions(src);
    node.properties = {
      src: sized.src,
      alt,
      ...(sized.width !== undefined ? { width: sized.width, height: sized.height } : {}),
      loading: "lazy",
      decoding: "async",
    };
    const standalone =
      isElement(parent, "p") &&
      parent.children.every(
        (child) => child === node || (child.type === "text" && !child.value.trim()),
      );
    if (standalone) {
      const figure = parent as Element;
      figure.tagName = "figure";
      figure.properties = {};
      figure.children = [node];
      if (typeof title === "string" && title.trim()) {
        figure.children.push(element("figcaption", {}, [text(title.trim())]));
      }
      return SKIP;
    }
    return undefined;
  });
}

/**
 * Links: a link without a usable `href` (refused by the sanitiser) is unwrapped to its text.
 * Internal and same-site links stay as they are; external links get `rel="noopener noreferrer"`.
 * Every link opens in the same tab.
 */
function shapeLinks(tree: HastRoot, siteHosts: readonly string[]): void {
  visit(tree, "element", (node, index, parent) => {
    if (node.tagName !== "a" || !parent || index === undefined) return;
    const href = node.properties["href"];
    if (typeof href !== "string" || href.trim() === "") {
      parent.children.splice(index, 1, ...node.children);
      return [SKIP, index];
    }
    if (/^https?:\/\//i.test(href) || href.startsWith("//")) {
      const host = URL.canParse(href, "https://placeholder.invalid")
        ? new URL(href, "https://placeholder.invalid").hostname.toLowerCase()
        : "";
      if (!siteHosts.includes(host)) node.properties["rel"] = ["noopener", "noreferrer"];
    }
    delete node.properties["target"];
    return undefined;
  });
}

/** Code blocks: Shiki for known languages (post context), plain escaped text otherwise. */
async function shapeCode(tree: HastRoot, highlight: boolean): Promise<void> {
  const blocks: { parent: Element | HastRoot; index: number; pre: Element }[] = [];
  visit(tree, "element", (node, index, parent) => {
    if (node.tagName !== "pre" || !parent || index === undefined) return;
    blocks.push({ parent, index, pre: node });
    return SKIP;
  });
  for (const { parent, index, pre } of blocks) {
    const code = pre.children.find((child) => isElement(child, "code"));
    const language = code
      ? classList(code)
          .find((name) => name.startsWith("language-"))
          ?.slice("language-".length)
      : undefined;
    const source = code ? hastToString(code) : hastToString(pre);
    const grammar = highlight ? grammarFor(language) : undefined;
    const highlighted = grammar
      ? await highlightToPre(source.replace(/\n$/, ""), grammar)
      : undefined;
    const block = highlighted ?? pre;
    block.properties = {
      className: ["code-block"],
      tabIndex: 0,
      ...(grammar ? { dataLanguage: grammar } : {}),
    };
    if (!highlighted && code) code.properties = {};
    parent.children[index] = block;
  }
}

const FAQ_HEADING = "frequently asked questions";
const MAX_FAQ = 50;
const MAX_QUESTION = 300;
const MAX_ANSWER = 5000;

const plain = (node: Element) => hastToString(node).replace(/\s+/g, " ").trim();

/**
 * The questions of a level 2 "Frequently asked questions" section: each level 3 heading is a
 * question, and the text of the blocks after it (up to the next h3 or h2) is its answer. Only the
 * top level of the body is read, so a heading inside a callout or the footnotes never counts.
 */
function extractFaq(tree: HastRoot): FaqEntry[] {
  const blocks = tree.children.filter((child): child is Element => isElement(child));
  const start = blocks.findIndex(
    (node) => node.tagName === "h2" && plain(node).toLowerCase() === FAQ_HEADING,
  );
  if (start === -1) return [];
  const faq: { question: string; parts: string[] }[] = [];
  for (const node of blocks.slice(start + 1)) {
    if (node.tagName === "h2" || node.tagName === "section") break;
    if (node.tagName === "h3") {
      faq.push({ question: plain(node), parts: [] });
      continue;
    }
    const current = faq.at(-1);
    const value = plain(node);
    if (current && value) current.parts.push(value);
  }
  return faq
    .map((item) => ({ question: item.question, answer: item.parts.join(" ") }))
    .filter((item) => item.question !== "" && item.answer !== "")
    .slice(0, MAX_FAQ)
    .map((item) => ({
      question: item.question.slice(0, MAX_QUESTION),
      answer: item.answer.slice(0, MAX_ANSWER),
    }));
}

function countFootnotes(tree: HastRoot): number {
  let count = 0;
  visit(tree, "element", (node) => {
    if (node.tagName === "section" && node.properties["dataFootnotes"]) {
      const list = node.children.find((child) => isElement(child, "ol"));
      count = list ? list.children.filter((child) => isElement(child, "li")).length : 0;
      return SKIP;
    }
    return undefined;
  });
  return count;
}

// ---------------------------------------------------------------------------------------------

const DEFAULT_SITE_HOSTS = ["vitalos.co.uk", "www.vitalos.co.uk"];

export async function renderMarkdown(
  markdown: string,
  options: RenderOptions,
): Promise<RenderResult> {
  const warnings = new Warnings();
  const siteHosts = (options.siteHosts ?? DEFAULT_SITE_HOSTS).map((host) => host.toLowerCase());

  const processor = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(() => (tree: MdastRoot) => inspectMarkdown(tree, options, warnings))
    .use(remarkRehype, {
      allowDangerousHtml: false,
      footnoteLabel: "Sources",
      footnoteLabelTagName: "h2",
      footnoteLabelProperties: { className: ["footnotes-label"] },
    })
    .use(rehypeSanitize, sanitizeSchema)
    .use(rehypeStringify);

  const mdast = processor.parse(markdown);
  const hast = (await processor.run(mdast)) as HastRoot;

  const toc = addHeadingIds(hast);
  addCallouts(hast);
  wrapTables(hast);
  shapeImages(hast, options.context === "post" ? options.mediaOrigin : undefined);
  shapeLinks(hast, siteHosts);
  await shapeCode(hast, options.context === "post");

  return {
    html: processor.stringify(hast),
    toc,
    footnotes: countFootnotes(hast),
    warnings: warnings.list,
    faq: options.context === "post" ? extractFaq(hast) : [],
  };
}
