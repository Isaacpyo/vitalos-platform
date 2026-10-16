import type { Options as SanitizeSchema } from "rehype-sanitize";

/**
 * The renderer's strict allowlist (brief 4.4). It runs on the hast that `remark-rehype` builds
 * from Markdown, with raw HTML already dropped (`allowDangerousHtml` is never set), so it only has
 * to admit what Markdown, GFM tables and GFM footnotes produce, and nothing else:
 *
 * - no `div`, `span`, `iframe`, `script`, `style`, `svg`, `form`, `input`, `object` or `embed`;
 * - no event handlers, `style` or `class` attributes (except the footnote and code-language
 *   classes that the pipeline itself sets);
 * - links only to http(s), mailto or relative URLs; images only from http(s) (the media host
 *   check runs before this, and the image is dropped when it fails).
 *
 * Structure the site needs (heading ids, callouts, the table region, figures, highlighted code)
 * is added AFTER sanitising, by trusted transforms that never copy attributes from input.
 */
export const sanitizeSchema: SanitizeSchema = {
  strip: ["script", "style", "template", "noscript", "iframe", "object", "embed", "svg", "math"],
  // Footnote ids come from remark-rehype, already prefixed `user-content-`; nothing else carries
  // an id before the trusted transforms run, so no second prefix is applied.
  clobber: [],
  clobberPrefix: "",
  ancestors: {
    li: ["ol", "ul"],
    tbody: ["table"],
    td: ["table"],
    th: ["table"],
    thead: ["table"],
    tr: ["table"],
  },
  protocols: {
    href: ["http", "https", "mailto"],
    src: ["http", "https"],
  },
  tagNames: [
    "a",
    "blockquote",
    "br",
    "code",
    "del",
    "em",
    "h2",
    "h3",
    "h4",
    "hr",
    "img",
    "li",
    "ol",
    "p",
    "pre",
    "section",
    "strong",
    "sup",
    "table",
    "tbody",
    "td",
    "th",
    "thead",
    "tr",
    "ul",
  ],
  attributes: {
    a: [
      "href",
      ["id", /^user-content-fnref-[a-z0-9%._~-]{1,100}$/i],
      "ariaLabel",
      "dataFootnoteRef",
      "dataFootnoteBackref",
      ["ariaDescribedBy", "footnote-label"],
      ["className", "data-footnote-backref"],
    ],
    code: [["className", /^language-[a-z0-9+#._-]{1,40}$/i]],
    h2: [
      ["id", "footnote-label"],
      ["className", "footnotes-label"],
    ],
    img: ["src", "alt", "title"],
    li: [["id", /^user-content-fn-[a-z0-9%._~-]{1,100}$/i]],
    ol: ["start"],
    section: ["dataFootnotes", ["className", "footnotes"]],
    td: [["align", "left", "right", "center"]],
    th: [["align", "left", "right", "center"]],
  },
  required: {},
};
